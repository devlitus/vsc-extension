import * as vscode from 'vscode';

export interface AgentState {
  id: number;
  sessionId: string;
  terminalRef?: vscode.Terminal;
  projectDir: string;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  subagentToolIds: Set<string>;
  backgroundAgentToolIds: Set<string>;
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
  hookDelivered: boolean;
  isExternal: boolean;
  lastDataAt: number;
  linesProcessed: number;
  seenUnknownRecordTypes: Set<string>;
}

export interface PersistedAgent {
  id: number;
  sessionId: string;
  jsonlFile: string;
  projectDir: string;
  terminalName: string;
  folderName?: string;
  isExternal: boolean;
}

export type WebviewMessage =
  | { type: 'agentAdded'; agentId: number; sessionId: string }
  | { type: 'agentRemoved'; agentId: number }
  | { type: 'toolStart'; agentId: number; toolName: string; status: string }
  | { type: 'toolEnd'; agentId: number }
  | { type: 'toolProgress'; agentId: number; status: string }
  | { type: 'turnEnd'; agentId: number }
  | { type: 'permissionRequest'; agentId: number }
  | { type: 'layoutLoaded'; layout: unknown }
  | { type: 'assetsLoaded'; manifest: unknown };

export type AgentUpdateCallback = (message: WebviewMessage) => void;

export interface AssetManifest {
  furniturePacks: Array<{
    id: string;
    name: string;
    uris: Record<string, string>;
  }>;
}
