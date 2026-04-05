# Phase 3 — Hooks: Tasks

## Tasks

- [ ] 1. Create server/src/constants.ts
  1. Define `SERVER_CONFIG_PATH = '~/.pixel-agents/server.json'`
  2. Define `SERVER_DIR = '~/.pixel-agents/'`
  3. Define `MAX_BODY_BYTES = 65536`
  4. Define `PROVIDER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/`
  5. Define `SHUTDOWN_TIMEOUT_MS = 5000`

- [ ] 2. Create server/src/server.ts — PixelAgentsServer class
  1. Define property `port: number` (dynamically assigned on bind to `0`)
  2. Define property `token: string` (32 random bytes in hex)
  3. Define property `httpServer: http.Server`
  4. Define property `callbacks: Map<string, (event: unknown) => void>`
  5. Implement `async start(): Promise<void>` — bind to `127.0.0.1:0`, write `~/.pixel-agents/server.json`
  6. Implement `async stop(): Promise<void>` — graceful shutdown, clear PID from config
  7. Implement `onEvent(providerId: string, cb: (event: unknown) => void): void`
  8. Implement static `static async findExisting(): Promise<{ port, token } | null>` — read server.json, verify PID is alive
  9. Implement endpoint `POST /api/hooks/:providerId`
     - Verify `Authorization: Bearer <token>` header with `crypto.timingSafeEqual`
     - Validate JSON body, maximum `MAX_BODY_BYTES`
     - Return 401 if invalid token, 400 if invalid providerId, 200 OK
     - Invoke registered callback for that providerId
  10. Implement endpoint `GET /api/health` — return `{ uptime, pid }` without auth
  11. Implement atomic config write: write to `.tmp`, then `rename`
  12. Implement `0o600` permissions for server.json
  13. Implement multi-window support: if an active server already exists (live PID), reuse its configuration

- [ ] 3. Create server/src/hookEventHandler.ts
  1. Define `HookEvent` interface with fields:
     - `type: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'SubagentStop'`
     - `sessionId: string`
     - `toolName?: string`
     - `toolInput?: unknown`
     - `toolResult?: unknown`
  2. Implement `handleHookEvent(event: HookEvent, agents: AgentState[], postMessage: (agentId: number, msg: unknown) => void): void`
  3. Handle `PreToolUse`: set `permissionSent = true`, call `postMessage(agentId, { type: 'permissionRequest' })`
  4. Handle `PostToolUse`: call `postMessage(agentId, { type: 'toolEnd' })`
  5. Handle `Stop` / `SubagentStop`: call `postMessage(agentId, { type: 'turnEnd', source: 'hook' })`, set `hookDelivered = true`

- [ ] 4. Create server/src/providers/file/claudeHookInstaller.ts
  1. Define `installHooks(serverPort: number, token: string): Promise<void>`
  2. Define `uninstallHooks(): Promise<void>`
  3. Read existing `~/.claude/settings.json`
  4. Insert hooks into structure:
     - `PreToolUse`: `[{ "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }]`
     - `PostToolUse`: `[{ "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }]`
     - `Stop`: `[{ "hooks": [{ "type": "command", "command": "..." }] }]`
  5. Generate inline curl command: `curl -s -X POST http://127.0.0.1:<port>/api/hooks/claude -H "Authorization: Bearer <token>" -d @-`
  6. Write updated settings.json atomically
  7. Implement uninstallHooks to remove only pixel-agents hooks from settings.json

- [ ] 5. Create server/src/providers/file/hooks/claude-hook.ts
  1. Create script that reads stdin (JSON event from Claude Code)
  2. POST to local server with the event
  3. Implement silent failure (must not block Claude Code)

- [ ] 6. Update PixelAgentsViewProvider.ts to integrate hooks
  1. On activate: instantiate `PixelAgentsServer` and call `await server.start()`
  2. Register callback: `server.onEvent('claude', (event) => handleHookEvent(event, ...))`
  3. Call `installHooks(server.port, server.token)` to install hooks in Claude Code
  4. In `dispose()`: call `uninstallHooks()` and `server.stop()`
  5. Coordinate with JSONL polling: if `hookDelivered === true`, do not emit duplicate `turnEnd`
  6. Reset `hookDelivered` flag at the start of each new turn

- [ ] 7. Verify build
  1. `bun run build` without errors
  2. TypeScript without type errors

- [ ] 8. Verify runtime
  1. `GET http://127.0.0.1:<port>/api/health` returns 200 with `{ uptime, pid }`
  2. When running Claude Code with hooks installed, the `Stop` event reaches the server
  3. No errors if Claude Code does not have hooks installed (graceful degradation)
