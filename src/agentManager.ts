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
const MAX_TURN_HISTORY = 20;

export class AgentManager {
  private agents = new Map<number, AgentState>();
  private nextPositiveId = 1;
  private nextNegativeId = -1;

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
    };

    if (terminal) {
      agent.terminalRef = terminal;
    }

    this.agents.set(id, agent);
    return agent;
  }

  getAgent(id: number): AgentState | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentState[] {
    return [...this.agents.values()];
  }

  removeAgent(id: number): void {
    this.agents.delete(id);
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
    try {
      const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD']);
      agent.branch = stdout.trim();
      return agent.branch;
    } catch {
      agent.branch = null;
      return null;
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
      tokensUsed: 0,
    };
    if (agent.turnHistory.length >= MAX_TURN_HISTORY) {
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
