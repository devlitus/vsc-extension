import * as vscode from 'vscode';
import { AgentState } from './types';

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
}
