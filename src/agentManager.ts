import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentState, TurnSummary } from './types';

const execAsync = promisify(exec);
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
    try {
      const { stdout } = await execAsync(`git -C "${agent.projectDir}" rev-parse --abbrev-ref HEAD`);
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
    agent.terminalRef.sendText('\x03');
    agent.isInterrupted = true;
    return true;
  }

  sendChatMessage(agentId: number, text: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.terminalRef) {
      return false;
    }
    agent.terminalRef.sendText(text, true);
    return true;
  }
}
