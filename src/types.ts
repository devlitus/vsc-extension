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
  contextUsed?: number;
  contextMax?: number;
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
  | { type: 'turnEnd'; agentId: number; source?: 'hook' | 'polling' }
  | { type: 'permissionRequest'; agentId: number }
  | { type: 'layoutLoaded'; layout: unknown }
  | { type: 'assetsLoaded'; manifest: unknown }
  | { type: 'contextUpdate'; agentId: number; contextUsed: number; contextMax: number }
  | { type: 'rateLimitEnter'; agentId: number }
  | { type: 'rateLimitExit'; agentId: number }
  | { type: 'externalAssetsLoaded'; assets: unknown }
  | { type: 'versionUpgraded'; oldVersion: string; newVersion: string }
  | { type: 'settingsLoaded'; settings: SettingsData };

export type AgentUpdateCallback = (message: WebviewMessage) => void;

export interface AssetManifest {
  furniturePacks: Array<{
    id: string;
    name: string;
    uris: Record<string, string>;
  }>;
}

export interface SettingsData {
  soundEnabled: boolean;
  alwaysShowLabels: boolean;
  watchAllSessions: boolean;
  hooksEnabled: boolean;
}
