export interface DebugAgentInfo {
  id: number;
  sessionId: string;
  jsonlFile: string;
  linesProcessed: number;
  lastDataAt: number;
  hookDelivered: boolean;
  isExternal: boolean;
}
