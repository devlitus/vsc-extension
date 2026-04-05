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

function isSafePath(filePath: string): boolean {
  try {
    const resolved = path.resolve(filePath);
    const realPath = fs.realpathSync(filePath);
    // Also verify the real path stays within PROJECT_DIR
    return resolved === realPath && 
           realPath.startsWith(path.resolve(PROJECT_DIR) + path.sep);
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

  constructor(
    private readonly agentManager: AgentManager,
    private readonly onAgentUpdate: AgentUpdateCallback
  ) {}

  setWatchAllSessions(enabled: boolean): void {
    this._watchAllSessions = enabled;
    if (enabled) {
      this.startExternalSessionScanning();
      this.startStaleExternalAgentCheck();
    } else {
      this.stopStaleExternalAgentCheck();
    }
  }

  start(): void {
    if (this.pollingInterval) {
      return;
    }

    this.pollingInterval = setInterval(() => {
      this.poll();
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
  }

  private startExternalSessionScanning(): void {
    if (!fs.existsSync(PROJECT_DIR)) {
      return;
    }

    try {
      const entries = fs.readdirSync(PROJECT_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const projectDir = path.join(PROJECT_DIR, entry.name);
        if (!this.isSafeProjectDir(projectDir)) {
          continue;
        }

        const sessionsFile = path.join(projectDir, 'sessions.jsonl');
        if (fs.existsSync(sessionsFile)) {
          this.knownExternalFiles.add(sessionsFile);
          this.processProjectDir(projectDir, sessionsFile);
        }
      }
    } catch {
      // Ignore scanning errors
    }
  }

  private startStaleExternalAgentCheck(): void {
    if (this.staleCheckInterval) {
      return;
    }

    this.staleCheckInterval = setInterval(() => {
      this.checkStaleExternalAgents();
    }, STALE_CHECK_INTERVAL_MS);
  }

  private stopStaleExternalAgentCheck(): void {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }
  }

  private checkStaleExternalAgents(): void {
    const agents = this.agentManager.getAllAgents();
    for (const agent of agents) {
      if (!agent.isExternal) {
        continue;
      }

      if (!fs.existsSync(agent.jsonlFile)) {
        this.agentManager.removeAgent(agent.id);
        this.knownExternalFiles.delete(agent.jsonlFile);
      }
    }
  }

  private poll(): void {
    if (!fs.existsSync(PROJECT_DIR)) {
      return;
    }

    try {
      const entries = fs.readdirSync(PROJECT_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const projectDir = path.join(PROJECT_DIR, entry.name);
        if (!this.isSafeProjectDir(projectDir)) {
          continue;
        }

        const sessionsFile = path.join(projectDir, 'sessions.jsonl');
        if (fs.existsSync(sessionsFile)) {
          this.processProjectDir(projectDir, sessionsFile);
        }
      }
    } catch {
      // Ignore polling errors
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

  private processProjectDir(projectDir: string, sessionsFile: string): void {
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

    if (!fs.existsSync(sessionsFile)) {
      return;
    }

    this.readNewLines(agent);
  }

  private readNewLines(agent: AgentState): void {
    let fd: number | undefined;
    try {
      fd = fs.openSync(agent.jsonlFile, 'r');
      const stat = fs.fstatSync(fd);
      const fileSize = stat.size;

      if (agent.fileOffset >= fileSize) {
        return;
      }

      const bytesToRead = Math.min(READ_CHUNK_BYTES, fileSize - agent.fileOffset);
      const buffer = Buffer.alloc(bytesToRead);
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, agent.fileOffset);

      if (bytesRead === 0) {
        return;
      }

      const text = buffer.toString('utf-8', 0, bytesRead);
      agent.lineBuffer += text;
      agent.fileOffset += bytesRead;

      const lines = agent.lineBuffer.split('\n');
      agent.lineBuffer = lines.pop() || '';

      for (const line of lines) {
        processTranscriptLine(line, agent, this.onAgentUpdate);
      }
    } catch {
      // Ignore read errors
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* ignore */ }
      }
    }
  }

  private onDidOpenTerminal(terminal: vscode.Terminal): void {
    if (terminal.name === 'claude') {
      this.associateTerminal(terminal);
    }
  }

  private onDidCloseTerminal(terminal: vscode.Terminal): void {
    if (terminal.name === 'claude') {
      this.disassociateTerminal(terminal);
    }
  }

  private associateTerminal(terminal: vscode.Terminal): void {
    const agents = this.agentManager.getAllAgents();
    const existingAgent = agents.find(a => a.terminalRef === terminal);

    if (existingAgent) {
      return;
    }

    const projectDirs = this.findProjectDirsForTerminal(terminal);

    for (const projectDir of projectDirs) {
      const sessionsFile = path.join(projectDir, 'sessions.jsonl');
      if (fs.existsSync(sessionsFile)) {
        const agent = this.agentManager.createAgent(
          '',
          projectDir,
          sessionsFile,
          terminal
        );
        agent.fileOffset = 0;
        agent.lineBuffer = '';
        break;
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

  private findProjectDirsForTerminal(_terminal: vscode.Terminal): string[] {
    const dirs: string[] = [];

    if (!fs.existsSync(PROJECT_DIR)) {
      return dirs;
    }

    try {
      const entries = fs.readdirSync(PROJECT_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.push(path.join(PROJECT_DIR, entry.name));
        }
      }
    } catch {
      // Ignore errors
    }

    return dirs;
  }
}
