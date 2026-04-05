export interface ServerConfig {
  port: number;
  token: string;
  pid: number;
}

export interface HookEvent {
  type: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'SubagentStop';
  sessionId: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

export interface HealthResponse {
  uptime: number;
  pid: number;
}

export interface SettingsHooks {
  hooks?: {
    PreToolUse?: Array<{ matcher?: string; hooks: Array<{ type: 'command'; command: string }> }>;
    PostToolUse?: Array<{ matcher?: string; hooks: Array<{ type: 'command'; command: string }> }>;
    Stop?: Array<{ hooks: Array<{ type: 'command'; command: string }> }>;
    SubagentStop?: Array<{ hooks: Array<{ type: 'command'; command: string }> }>;
  };
}