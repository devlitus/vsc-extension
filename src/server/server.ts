import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import {
  MAX_BODY_BYTES,
  PROVIDER_ID_REGEX,
  SERVER_CONFIG_PATH,
  SERVER_DIR,
  SERVER_REQUEST_TIMEOUT_MS,
  SHUTDOWN_TIMEOUT_MS,
} from './constants';
import { HookEvent, ServerConfig } from './types';

/**
 * HTTP server that receives hook events from Claude Code.
 *
 * The server binds to a random available port on 127.0.0.1 and stores its
 * configuration in `~/.pixel-agents/server.json`. Claude Code hooks POST
 * events to this server, which dispatches them to registered callbacks.
 *
 * @example
 * const server = new PixelAgentsServer();
 * await server.start();
 * server.onEvent('claude', (event) => {
 *   console.log('Hook event:', event.type);
 * });
 * console.log(`Server running on port ${server.port}`);
 */
export class PixelAgentsServer {
  /** Port assigned by the OS when binding to 127.0.0.1:0 */
  public port: number = 0;

  /** 32-byte random hex token used for Bearer authentication */
  public token: string = '';

  private httpServer: http.Server | null = null;
  private callbacks: Map<string, (event: HookEvent) => void> = new Map();
  private startTime: number = 0;

  /**
   * Starts the HTTP server on a randomly assigned port.
   *
   * Creates `~/.pixel-agents/` with mode 0o700 and writes `server.json` with
   * mode 0o600. The server binds to 127.0.0.1 (localhost only, not exposed
   * externally).
   *
   * @returns Resolves when server is ready and config is written
   * @throws Rejects if port binding fails or config write fails
   */
  async start(): Promise<void> {
    // Ensure directory exists with 0o700
    await fs.promises.mkdir(SERVER_DIR, { mode: 0o700, recursive: true });

    this.token = crypto.randomBytes(32).toString('hex');
    this.startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.httpServer.setTimeout(SERVER_REQUEST_TIMEOUT_MS);

      this.httpServer.on('error', (err) => {
        reject(err);
      });

      // Bind to 127.0.0.1:0 (OS assigns available port)
      this.httpServer.listen(0, '127.0.0.1', () => {
        const addr = this.httpServer?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }

        // Write config atomically with 0o600
        const config: ServerConfig = {
          port: this.port,
          token: this.token,
          pid: process.pid,
        };

        const configContent = JSON.stringify(config, null, 2);
        const tmpPath = `${SERVER_CONFIG_PATH}.tmp`;

        fs.promises.writeFile(tmpPath, configContent, { mode: 0o600 })
          .then(() => fs.promises.rename(tmpPath, SERVER_CONFIG_PATH))
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  /**
   * Gracefully stops the HTTP server.
   *
   * Closes all connections after at most `SHUTDOWN_TIMEOUT_MS` (5s). Also
   * deletes the `server.json` PID file. Safe to call multiple times.
   *
   * @returns Resolves when server is fully stopped
   */
  async stop(): Promise<void> {
    if (!this.httpServer) {
      return;
    }

    const server = this.httpServer;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        server.closeAllConnections();
        resolve();
      }, SHUTDOWN_TIMEOUT_MS);

      server.close(() => {
        clearTimeout(timeout);
        // Clear PID file
        fs.promises.unlink(SERVER_CONFIG_PATH).catch(() => {}).finally(() => resolve());
      });
    });
  }

  /**
   * Registers a callback for hook events from a specific provider.
   *
   * @param providerId - Provider identifier (e.g., 'claude')
   * @param cb - Callback invoked for each hook event from this provider
   *
   * @example
   * server.onEvent('claude', (event) => {
   *   if (event.type === 'Stop') {
   *     // Handle turn end
   *   }
   * });
   */
  onEvent(providerId: string, cb: (event: HookEvent) => void): void {
    this.callbacks.set(providerId, cb);
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set request timeout
    req.setTimeout(SERVER_REQUEST_TIMEOUT_MS);

    const url = req.url || '';

    // GET /api/health
    if (req.method === 'GET' && url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: Date.now() - this.startTime,
        pid: process.pid,
      }));
      return;
    }

    // POST /api/hooks/:providerId
    const hooksMatch = url.match(/^\/api\/hooks\/([^/]+)$/);
    if (req.method === 'POST' && hooksMatch) {
      const providerId = hooksMatch[1];

      // Validate providerId BEFORE any processing
      if (!PROVIDER_ID_REGEX.test(providerId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid providerId' }));
        return;
      }

      // Bearer auth
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing authorization' }));
        return;
      }

      const authToken = authHeader.slice(7);
      // Use timingSafeEqual with same length buffers
      const tokenBuf = Buffer.from(this.token);
      const authBuf = Buffer.from(authToken);
      if (tokenBuf.length !== authBuf.length || !crypto.timingSafeEqual(tokenBuf, authBuf)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }

      // Collect body with size limit
      let body = '';
      let bodySize = 0;
      let rejectTooLarge = false;

      req.on('data', (chunk: Buffer) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_BYTES) {
          rejectTooLarge = true;
          req.destroy();
          return;
        }
        body += chunk.toString();
      });

      req.on('end', () => {
        if (rejectTooLarge) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Body too large' }));
          return;
        }

        try {
          const event = JSON.parse(body);

          // Schema validation
          if (!this.validateHookEvent(event)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid hook event schema' }));
            return;
          }

          const callback = this.callbacks.get(providerId);
          if (callback) {
            callback(event as HookEvent);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

      req.on('error', () => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request error' }));
      });

      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Validates a parsed hook event object against the expected schema.
   *
   * Checks that the object has a valid `type` (one of PreToolUse, PostToolUse,
   * Stop, SubagentStop), a non-empty `sessionId` string, and that sessionId
   * length does not exceed 256 characters.
   *
   * @param obj - Raw parsed JSON object to validate
   * @returns true if the object matches the HookEvent schema
   */
  private validateHookEvent(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    const event = obj as Record<string, unknown>;
    if (typeof event.type !== 'string') return false;
    if (!['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop'].includes(event.type)) return false;
    if (typeof event.sessionId !== 'string') return false;
    if (event.sessionId.length > 256) return false; // Prevent oversized sessionId
    return true;
  }

  /**
   * Finds an existing PixelAgentsServer process and returns its configuration.
   *
   * Reads `~/.pixel-agents/server.json` and verifies the process is still
   * running via `process.kill(pid, 0)`. Used to support multiple VS Code
   * windows sharing the same server instance.
   *
   * @returns Configuration object with `port` and `token`, or `null` if no
   *          server is running or config file is inaccessible
   *
   * @example
   * const existing = await PixelAgentsServer.findExisting();
   * if (existing) {
   *   // Reuse existing server instead of starting a new one
   *   server = new PixelAgentsServer();
   *   server.port = existing.port;
   *   server.token = existing.token;
   * }
   */
  static async findExisting(): Promise<{ port: number; token: string } | null> {
    try {
      const content = await fs.promises.readFile(SERVER_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content) as ServerConfig;

      // Verify process is still running
      try {
        process.kill(config.pid, 0);
      } catch {
        // Process doesn't exist
        return null;
      }

      return { port: config.port, token: config.token };
    } catch {
      return null;
    }
  }
}