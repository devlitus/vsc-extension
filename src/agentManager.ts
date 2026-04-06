import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AgentState, TurnSummary } from './types';

const execFileAsync = promisify(execFile);

async function validateCwd(input: string): Promise<string | null> {
  if (!input || input.length === 0 || input.length > 1024) return null;
  try {
    const real = fs.realpathSync(path.resolve(input));
    if (!fs.statSync(real).isDirectory()) return null;
    return real;
  } catch { return null; }
}

export class AgentManager {
  private agents = new Map<number, AgentState>();
  private agentsBySessionId: Map<string, AgentState> = new Map();
  private nextPositiveId = 1;
  private nextNegativeId = -1;
  private readonly MAX_TURN_HISTORY = 20;
  private readonly MAX_UNKNOWN_TYPES = 100;
  private gitBranchCache: Map<string, { branch: string; mtime: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds

  createAgent(
    sessionId: string,
    projectDir: string,
    jsonlFile: string,
    terminal?: vscode.Terminal
  ): AgentState {
    const id = terminal ? this.nextPositiveId++ : this.nextNegativeId--;

    const agent: AgentState = {
      id,
      sessionId,
      projectDir,
      jsonlFile,
      fileOffset: 0,
      lineBuffer: '',
      lineChunks: [], // Performance: Array-based string accumulation
      activeToolIds: new Set<string>(),
      activeToolStatuses: new Map<string, string>(),
      activeToolNames: new Map<string, string>(),
      subagentToolIds: new Set<string>(),
      backgroundAgentToolIds: new Set<string>(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
      hookDelivered: false,
      isExternal: false,
      lastDataAt: 0,
      linesProcessed: 0,
      seenUnknownRecordTypes: new Set<string>(),
      contextUsed: undefined,
      contextMax: undefined,
      model: undefined,
      systemPrompt: undefined,
      branch: undefined,
      toolsThisTurn: [],
      turnHistory: [],
      currentTurnStartTime: undefined,
      isInterrupted: false,
      currentTurnAssistantContent: '',
    };

    if (terminal) {
      agent.terminalRef = terminal;
    }

    this.agents.set(id, agent);
    this.agentsBySessionId.set(sessionId, agent);
    return agent;
  }

  updateSessionId(agentId: number, newSessionId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    if (agent.sessionId === newSessionId) return;
    if (this.agentsBySessionId.get(agent.sessionId) === agent) {
      this.agentsBySessionId.delete(agent.sessionId);
    }
    agent.sessionId = newSessionId;
    this.agentsBySessionId.set(newSessionId, agent);
  }

  getAgent(id: number): AgentState | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentState[] {
    return [...this.agents.values()];
  }

  getAgentBySessionId(sessionId: string): AgentState | undefined {
    return this.agentsBySessionId.get(sessionId);
  }

  removeAgent(id: number): void {
    const agent = this.agents.get(id);
    if (agent) {
      this.agentsBySessionId.delete(agent.sessionId);
    }
    this.cleanupAgent(id);
    this.agents.delete(id);
  }

  // Performance: Cleanup agent state to prevent unbounded memory growth
  private cleanupAgent(id: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    // Limit turn history
    if (agent.turnHistory.length > this.MAX_TURN_HISTORY) {
      agent.turnHistory = agent.turnHistory.slice(-this.MAX_TURN_HISTORY);
    }

    // Clear unknown types if too many
    if (agent.seenUnknownRecordTypes.size > this.MAX_UNKNOWN_TYPES) {
      const entries = Array.from(agent.seenUnknownRecordTypes).slice(-this.MAX_UNKNOWN_TYPES);
      agent.seenUnknownRecordTypes = new Set(entries);
    }

    // Clear line buffer and chunks
    agent.lineBuffer = '';
    agent.lineChunks = [];
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  getInspectionData(agentId: number): Record<string, unknown> | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return undefined;
    }
    return {
      agentId,
      model: agent.model,
      cwd: agent.projectDir,
      branch: agent.branch,
      systemPrompt: agent.systemPrompt,
      contextUsed: agent.contextUsed ?? 0,
      contextMax: agent.contextMax ?? 0,
      rateLimit: agent.isWaiting ?? false,
      currentTurnDuration: agent.currentTurnStartTime ? Date.now() - agent.currentTurnStartTime : 0,
      toolsThisTurn: agent.toolsThisTurn,
      turnHistory: agent.turnHistory.slice(-5),
    };
  }

  async getBranch(agentId: number): Promise<string | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }
    const cwd = await validateCwd(agent.projectDir);
    if (!cwd) {
      agent.branch = null;
      return null;
    }

    // Check cache
    const cached = this.gitBranchCache.get(cwd);
    const now = Date.now();

    if (cached && (now - cached.mtime) < this.CACHE_TTL) {
      agent.branch = cached.branch;
      return cached.branch;
    }

    try {
      const { execSync } = require('child_process');
      const gitPath = execSync('which git', { encoding: 'utf-8' }).trim();
      if (!gitPath) {
        throw new Error('Git not found');
      }
      const { stdout } = await execFileAsync(gitPath, ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD']);
      const branch = stdout.trim();

      // Update cache
      this.gitBranchCache.set(cwd, { branch, mtime: now });
      agent.branch = branch;
      return branch;
    } catch {
      agent.branch = null;
      return null;
    }
  }

  // Clear cache periodically or on git operations
  clearGitCache(cwd?: string): void {
    if (cwd) {
      this.gitBranchCache.delete(cwd);
    } else {
      this.gitBranchCache.clear();
    }
  }

  updateTurnEnd(agentId: number): void {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.currentTurnStartTime) {
      return;
    }
    const duration = Date.now() - agent.currentTurnStartTime;
    const summary: TurnSummary = {
      startedAt: agent.currentTurnStartTime,
      endedAt: Date.now(),
      toolsUsed: [...agent.toolsThisTurn],
      tokensUsed: agent.contextUsed ?? 0,
    };
    if (agent.turnHistory.length >= this.MAX_TURN_HISTORY) {
      agent.turnHistory.shift();
    }
    agent.turnHistory.push(summary);
    agent.toolsThisTurn = [];
    agent.currentTurnStartTime = undefined;
  }

  addToolToCurrentTurn(agentId: number, toolName: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }
    const existing = agent.toolsThisTurn.find((t) => t.name === toolName);
    if (existing) {
      existing.count++;
    } else {
      agent.toolsThisTurn.push({ name: toolName, count: 1 });
    }
  }

  interruptAgent(agentId: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.terminalRef) {
      return false;
    }
    agent.terminalRef.sendText('\x03', false);
    agent.isInterrupted = true;
    return true;
  }

  reassignTerminal(agentId: number, newTerminal: vscode.Terminal, newCwd: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }
    // Reassign the terminal reference to the new terminal
    agent.terminalRef = newTerminal;
    // Update the working directory to the new cwd
    agent.projectDir = newCwd;
    // Reset interrupted flag since we have a fresh session
    agent.isInterrupted = false;
    // Clear turn history since it's a new session
    agent.turnHistory = [];
    agent.toolsThisTurn = [];
    agent.currentTurnStartTime = undefined;
    // Note: sessionId and jsonlFile will be updated by the new terminal's session
    return true;
  }

  sendChatMessage(agentId: number, text: string): boolean {
    const clean = sanitizeChatInput(text);
    if (!clean) return false;
    const agent = this.agents.get(agentId);
    if (!agent || !agent.terminalRef) {
      return false;
    }
    agent.terminalRef.sendText(clean, true);
    return true;
  }
}

function sanitizeChatInput(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const clean = input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')                    // C0 controls
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')          // Unicode format/override chars
    .replace(/\r?\n/g, ' ')
    .trim();
  if (!clean || clean.length > 2000) return null;
  return clean;
}
