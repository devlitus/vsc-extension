import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { POLL_INTERVAL_MS, READ_CHUNK_BYTES } from './constants';
import { AgentManager } from './agentManager';
import { processTranscriptLine } from './transcriptParser';
import { AgentUpdateCallback, AgentState } from './types';

const PROJECT_DIR = path.join(os.homedir(), '.claude', 'projects');
const STALE_CHECK_INTERVAL_MS = 30000;

// Security: Resolve symlinks using fs.realpathSync.native() to prevent path traversal attacks
function isSafePath(filePath: string): boolean {
  try {
    const resolved = fs.realpathSync.native(filePath);
    const realBaseDir = fs.realpathSync.native(PROJECT_DIR);
    // Compare resolved path against resolved base directory with path separator to prevent partial matches
    return resolved.startsWith(realBaseDir + path.sep);
  } catch {
    return false;
  }
}

export class FileWatcher {
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private externalScanTicks = 0;
  private _disposables: vscode.Disposable[] = [];
  private _watchAllSessions = false;
  private knownExternalFiles = new Set<string>();
  private staleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private realpathCache: Map<string, { path: string; mtime: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(
    private readonly agentManager: AgentManager,
    private readonly onAgentUpdate: AgentUpdateCallback
  ) {}

  async setWatchAllSessions(enabled: boolean): Promise<void> {
    this._watchAllSessions = enabled;
    if (enabled) {
      await this.startExternalSessionScanning();
      this.startStaleExternalAgentCheck();
    } else {
      this.stopStaleExternalAgentCheck();
    }
  }

  start(): void {
    if (this.pollingInterval) {
      return;
    }

    // Performance: Use async polling to avoid blocking the event loop
    this.pollingInterval = setInterval(async () => {
      await this.poll();
    }, POLL_INTERVAL_MS);

    this._disposables.push(
      vscode.window.onDidOpenTerminal(this.onDidOpenTerminal, this)
    );
    this._disposables.push(
      vscode.window.onDidCloseTerminal(this.onDidCloseTerminal, this)
    );

    const terminals = vscode.window.terminals;
    for (const terminal of terminals) {
      if (terminal.name === 'claude') {
        this.associateTerminal(terminal);
      }
    }
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  dispose(): void {
    this.stop();
    this.stopStaleExternalAgentCheck();
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables = [];
    this.realpathCache.clear();
  }

  private async startExternalSessionScanning(): Promise<void> {
    try {
      await fs.promises.access(PROJECT_DIR);
    } catch {
      return;
    }

    try {
      const entries = await fs.promises.readdir(PROJECT_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const projectDir = path.join(PROJECT_DIR, entry.name);
        if (!this.isSafeProjectDir(projectDir)) {
          continue;
        }

        try {
          const projectEntries = await fs.promises.readdir(projectDir, { withFileTypes: true });
          for (const projectEntry of projectEntries) {
            if (!projectEntry.isFile() || !projectEntry.name.endsWith('.jsonl')) {
              continue;
            }
            const jsonlFile = path.join(projectDir, projectEntry.name);
            if (!this.knownExternalFiles.has(jsonlFile)) {
              this.knownExternalFiles.add(jsonlFile);
              this.processProjectDir(projectDir, jsonlFile);
            }
          }
        } catch (err) {
          if (err instanceof Error) {
            if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
              console.warn(`[Security] Permission denied while scanning: ${err.message}`);
            } else {
              console.error(`[Error] File watcher error: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
          console.warn(`[Security] Permission denied while scanning: ${err.message}`);
        } else {
          console.error(`[Error] File watcher error: ${err.message}`);
        }
      }
    }
  }

  private startStaleExternalAgentCheck(): void {
    if (this.staleCheckInterval) {
      return;
    }

    // Performance: Use async check to avoid blocking the event loop
    this.staleCheckInterval = setInterval(async () => {
      await this.checkStaleExternalAgents();
    }, STALE_CHECK_INTERVAL_MS);
  }

  private stopStaleExternalAgentCheck(): void {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }
  }

  private async checkStaleExternalAgents(): Promise<void> {
    const agents = this.agentManager.getAllAgents();
    for (const agent of agents) {
      if (!agent.isExternal) {
        continue;
      }

      try {
        await fs.promises.access(agent.jsonlFile);
      } catch {
        // File doesn't exist, remove agent
        this.agentManager.removeAgent(agent.id);
        this.knownExternalFiles.delete(agent.jsonlFile);
      }
    }
  }

  private async poll(): Promise<void> {
    try {
      await fs.promises.access(PROJECT_DIR);
    } catch {
      return;
    }

    try {
      const entries = await fs.promises.readdir(PROJECT_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const projectDir = path.join(PROJECT_DIR, entry.name);
        if (!this.isSafeProjectDir(projectDir)) {
          continue;
        }

        try {
          const projectEntries = await fs.promises.readdir(projectDir, { withFileTypes: true });
          for (const projectEntry of projectEntries) {
            if (!projectEntry.isFile() || !projectEntry.name.endsWith('.jsonl')) {
              continue;
            }
            const jsonlFile = path.join(projectDir, projectEntry.name);
            this.processProjectDir(projectDir, jsonlFile);
          }
        } catch (err) {
          if (err instanceof Error) {
            if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
              console.warn(`[Security] Permission denied while scanning: ${err.message}`);
            } else {
              console.error(`[Error] File watcher error: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
          console.warn(`[Security] Permission denied while scanning: ${err.message}`);
        } else {
          console.error(`[Error] File watcher error: ${err.message}`);
        }
      }
    }

    this.externalScanTicks++;
    if (this.externalScanTicks >= 2) {
      this.externalScanTicks = 0;
    }
  }

  private isSafeProjectDir(projectDir: string): boolean {
    try {
      if (!isSafePath(projectDir)) {
        return false;
      }
      const resolved = path.resolve(projectDir);
      return resolved.startsWith(path.resolve(PROJECT_DIR));
    } catch {
      return false;
    }
  }

  private async processProjectDir(projectDir: string, sessionsFile: string): Promise<void> {
    const agents = this.agentManager.getAllAgents();
    let agent = agents.find(a => a.projectDir === projectDir);

    if (!agent && this._watchAllSessions) {
      // Only create external agents when watchAllSessions is enabled
      // and we haven't already created one for this file
      if (!this.knownExternalFiles.has(sessionsFile)) {
        agent = this.agentManager.createAgent(
          '',
          projectDir,
          sessionsFile
        );
        agent.isExternal = true;
        this.knownExternalFiles.add(sessionsFile);
      } else {
        // File was already processed as external, skip
        return;
      }
    }

    if (!agent) {
      // No agent associated with this project dir
      return;
    }

    try {
      await fs.promises.access(sessionsFile);
    } catch {
      return;
    }

    this.readNewLines(agent);
  }

  private async readNewLines(agent: AgentState): Promise<void> {
    let fileHandle: any | undefined;
    try {
      fileHandle = await fs.promises.open(agent.jsonlFile, 'r');
      const stat = await fileHandle.stat();
      const fileSize = stat.size;

      if (agent.fileOffset >= fileSize) {
        return;
      }

      const bytesToRead = Math.min(READ_CHUNK_BYTES, fileSize - agent.fileOffset);
      const buffer = Buffer.alloc(bytesToRead);
      const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, agent.fileOffset);

      if (bytesRead === 0) {
        return;
      }

      const text = buffer.toString('utf-8', 0, bytesRead);
      // Performance: Use array-based string accumulation to avoid memory churn
      agent.lineChunks.push(text);
      agent.fileOffset += bytesRead;

      // Join chunks and process lines
      const lineBuffer = agent.lineChunks.join('');
      const lines = lineBuffer.split('\n');
      agent.lineBuffer = lines.pop() || '';

      for (const line of lines) {
        processTranscriptLine(line, agent, this.onAgentUpdate);
      }

      // Clear chunks after processing (lineBuffer holds the incomplete line)
      agent.lineChunks = [];
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
          console.warn(`[Security] Permission denied while reading: ${err.message}`);
        } else {
          console.error(`[Error] File watcher read error: ${err.message}`);
        }
      }
    } finally {
      if (fileHandle) {
        try { await fileHandle.close(); } catch { /* ignore */ }
      }
    }
  }

  private onDidOpenTerminal(terminal: vscode.Terminal): void {
    if (terminal.name === 'claude') {
      // Fire and forget - we don't want to block the event handler
      this.associateTerminal(terminal).catch(() => {});
    }
  }

  private onDidCloseTerminal(terminal: vscode.Terminal): void {
    if (terminal.name === 'claude') {
      this.disassociateTerminal(terminal);
    }
  }

  private async associateTerminal(terminal: vscode.Terminal): Promise<void> {
    const agents = this.agentManager.getAllAgents();
    const existingAgent = agents.find(a => a.terminalRef === terminal);

    if (existingAgent) {
      return;
    }

    // Try to find the correct project directory for this terminal
    const projectDir = await this.findProjectDirForTerminal(terminal);

    if (projectDir) {
      // Find the most recent *.jsonl file using mtime
      try {
        const jsonlEntries = await fs.promises.readdir(projectDir, { withFileTypes: true });
        let mostRecentFile: string | null = null;
        let mostRecentMtime = 0;

        for (const entry of jsonlEntries) {
          if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
            continue;
          }
          const filePath = path.join(projectDir, entry.name);
          const stat = await fs.promises.stat(filePath);
          if (stat.mtimeMs > mostRecentMtime) {
            mostRecentMtime = stat.mtimeMs;
            mostRecentFile = filePath;
          }
        }

        if (mostRecentFile) {
          const agent = this.agentManager.createAgent(
            '',
            projectDir,
            mostRecentFile,
            terminal
          );
          agent.fileOffset = 0;
          agent.lineBuffer = '';
          agent.lineChunks = [];
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
            console.warn(`[Security] Permission denied while accessing: ${err.message}`);
          } else {
            console.error(`[Error] File watcher error: ${err.message}`);
          }
        }
      }
    }
  }

  private disassociateTerminal(terminal: vscode.Terminal): void {
    const agents = this.agentManager.getAllAgents();
    for (const agent of agents) {
      if (agent.terminalRef === terminal) {
        this.agentManager.removeAgent(agent.id);
        break;
      }
    }
  }

  private async findProjectDirForTerminal(terminal: vscode.Terminal): Promise<string | null> {
    try {
      await fs.promises.access(PROJECT_DIR);
    } catch {
      return null;
    }

    // Try to get the terminal's working directory from shell integration
    let terminalCwd: string | undefined;
    if (terminal.shellIntegration && terminal.shellIntegration.cwd) {
      terminalCwd = terminal.shellIntegration.cwd.fsPath;
    }

    // Collect all project directories with their sessionIds
    type ProjectDirInfo = {
      dir: string;
      sessionId: string | null;
    };

    const projectDirs: ProjectDirInfo[] = [];

    try {
      const entries = await fs.promises.readdir(PROJECT_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const projectDir = path.join(PROJECT_DIR, entry.name);
        if (!this.isSafeProjectDir(projectDir)) {
          continue;
        }

        try {
          const jsonlFiles = await fs.promises.readdir(projectDir, { withFileTypes: true });
          let hasJsonlFile = false;
          for (const jsonlEntry of jsonlFiles) {
            if (jsonlEntry.isFile() && jsonlEntry.name.endsWith('.jsonl')) {
              hasJsonlFile = true;
              // Get the first jsonl file for extractSessionId
              const jsonlFile = path.join(projectDir, jsonlEntry.name);
              const sessionId = await this.extractSessionId(jsonlFile);
              projectDirs.push({ dir: projectDir, sessionId });
              break;
            }
          }
          if (!hasJsonlFile) continue;
        } catch {
          // Skip directories without accessible *.jsonl files
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
          console.warn(`[Security] Permission denied while scanning: ${err.message}`);
        } else {
          console.error(`[Error] File watcher error: ${err.message}`);
        }
      }
    }

    // Strategy 1: If we have a terminal CWD, try to match it to a project directory
    // The project directory name is typically a hash of the directory path
    if (terminalCwd) {
      for (const info of projectDirs) {
        // The project dir name is the hash, and the directory might contain a file
        // that references the actual path. For now, try to match based on heuristic:
        // check if any file in the project dir contains the terminal CWD
        try {
          const files = await fs.promises.readdir(info.dir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filePath = path.join(info.dir, file);
              try {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                if (content.includes(terminalCwd)) {
                  return info.dir;
                }
              } catch {
                // Skip files that can't be read
              }
            }
          }
        } catch {
          // Skip directories that can't be read
        }
      }
    }

    // Strategy 2: If we have only one project directory, use it
    if (projectDirs.length === 1) {
      return projectDirs[0].dir;
    }

    // Strategy 3: If we have multiple directories and no terminal CWD, use the most recently modified one
    if (projectDirs.length > 1) {
      let mostRecentDir: ProjectDirInfo | null = null;
      let mostRecentMtime = 0;

      for (const info of projectDirs) {
        try {
          const jsonlEntries = await fs.promises.readdir(info.dir, { withFileTypes: true });
          for (const entry of jsonlEntries) {
            if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
              continue;
            }
            const filePath = path.join(info.dir, entry.name);
            const stat = await fs.promises.stat(filePath);
            if (stat.mtimeMs > mostRecentMtime) {
              mostRecentMtime = stat.mtimeMs;
              mostRecentDir = info;
            }
          }
        } catch {
          // Skip directories that can't be read
        }
      }

      if (mostRecentDir) {
        return mostRecentDir.dir;
      }
    }

    // Strategy 4: Fallback to the first available directory
    if (projectDirs.length > 0) {
      return projectDirs[0].dir;
    }

    return null;
  }

  /**
   * Extract the sessionId from the first 'start' record in the sessions.jsonl file
   */
  private async extractSessionId(sessionsFile: string): Promise<string | null> {
    try {
      const fileHandle = await fs.promises.open(sessionsFile, 'r');
      try {
        // Read first chunk (should be enough to get the first line)
        const buffer = Buffer.alloc(4096);
        const { bytesRead } = await fileHandle.read(buffer, 0, 4096, 0);

        if (bytesRead === 0) {
          return null;
        }

        const text = buffer.toString('utf-8', 0, bytesRead);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'start' && typeof parsed.sessionId === 'string') {
              return parsed.sessionId;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      } finally {
        await fileHandle.close();
      }
    } catch {
      // Return null if file can't be read
    }

    return null;
  }

  private async getRealPath(filePath: string): Promise<string> {
    const cached = this.realpathCache.get(filePath);
    const now = Date.now();

    if (cached && (now - cached.mtime) < this.CACHE_TTL) {
      return cached.path;
    }

    try {
      const realPath = await fs.promises.realpath(filePath);
      this.realpathCache.set(filePath, { path: realPath, mtime: now });
      return realPath;
    } catch {
      return filePath;
    }
  }
}
