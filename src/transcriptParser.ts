import * as os from 'os';
import * as path from 'path';
import { AgentState, WebviewMessage } from './types';

const POLL_PROTOTYPE_KEYS = ['__proto__', 'constructor', 'prototype'];

export function deepCloneWithProtection<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Set) {
    return new Set([...obj].map(item => deepCloneWithProtection(item))) as unknown as T;
  }

  if (obj instanceof Map) {
    const result = new Map();
    for (const [k, v] of obj.entries()) {
      result.set(deepCloneWithProtection(k), deepCloneWithProtection(v));
    }
    return result as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepCloneWithProtection(item)) as unknown as T;
  }

  const clone = {} as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (POLL_PROTOTYPE_KEYS.includes(key)) {
      continue;
    }
    clone[key] = deepCloneWithProtection((obj as Record<string, unknown>)[key]);
  }
  return clone as T;
}

export function formatToolStatus(toolName: string, status: string): string {
  if (toolName === 'Bash') {
    const truncated = status.length > 60 ? status.substring(0, 60) + '...' : status;
    return truncated;
  }

  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
    const parts = status.split(' ');
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
    return status;
  }

  if (toolName === 'WebFetch' || toolName === 'WebSearch') {
    const urlOrQuery = status.split('?')[0] || status;
    return urlOrQuery;
  }

  return status;
}

interface TranscriptRecord {
  type?: string;
  [key: string]: unknown;
}

function isValidTranscriptRecord(obj: unknown): obj is TranscriptRecord {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  return true;
}

function isWebviewMessage(msg: unknown): msg is WebviewMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }

  const record = msg as Record<string, unknown>;

  if (!('type' in record) || typeof record.type !== 'string') {
    return false;
  }

  switch (record.type) {
    case 'agentAdded':
      return (
        'agentId' in record && typeof record.agentId === 'number' &&
        'sessionId' in record && typeof record.sessionId === 'string'
      );
    case 'agentRemoved':
      return 'agentId' in record && typeof record.agentId === 'number';
    case 'toolStart':
      return (
        'agentId' in record && typeof record.agentId === 'number' &&
        'toolName' in record && typeof record.toolName === 'string' &&
        'status' in record && typeof record.status === 'string'
      );
    case 'toolEnd':
      return 'agentId' in record && typeof record.agentId === 'number';
    case 'toolProgress':
      return (
        'agentId' in record && typeof record.agentId === 'number' &&
        'status' in record && typeof record.status === 'string'
      );
    case 'turnEnd':
      return 'agentId' in record && typeof record.agentId === 'number';
    case 'permissionRequest':
      return 'agentId' in record && typeof record.agentId === 'number';
    case 'layoutLoaded':
    case 'assetsLoaded':
      return 'layout' in record || 'manifest' in record;
    case 'contextUpdate':
      return (
        'agentId' in record && typeof record.agentId === 'number' &&
        'contextUsed' in record && typeof record.contextUsed === 'number' &&
        'contextMax' in record && typeof record.contextMax === 'number'
      );
    case 'rateLimitEnter':
    case 'rateLimitExit':
      return 'agentId' in record && typeof record.agentId === 'number';
    default:
      return false;
  }
}

interface ToolSummary {
  name: string;
  count: number;
}

interface TurnSummary {
  startedAt: number;
  endedAt: number;
  toolsUsed: ToolSummary[];
  tokensUsed: number;
}

function finalizeTurn(agentState: AgentState): void {
  if (agentState.currentTurnStartTime === undefined) {
    return;
  }

  const duration = Date.now() - agentState.currentTurnStartTime;
  const turnSummary: TurnSummary = {
    startedAt: agentState.currentTurnStartTime,
    endedAt: Date.now(),
    toolsUsed: agentState.toolsThisTurn.map(t => ({ name: t.name, count: t.count })),
    tokensUsed: 0,
  };

  // Circular buffer: keep last 20 turn summaries
  if (agentState.turnHistory.length >= 20) {
    agentState.turnHistory.shift();
  }
  agentState.turnHistory.push(turnSummary);

  // Reset turn state
  agentState.toolsThisTurn = [];
  agentState.currentTurnStartTime = undefined;
}

export function processTranscriptLine(
  line: string,
  agentState: AgentState,
  onUpdate: (message: WebviewMessage) => void
): void {
  if (!line.trim()) {
    return;
  }

  try {
    const parsed = JSON.parse(line);

    if (!isValidTranscriptRecord(parsed)) {
      return;
    }

    const record = deepCloneWithProtection(parsed);

    if (POLL_PROTOTYPE_KEYS.some(key => key in record)) {
      return;
    }

    const type = record.type;

    if (typeof type !== 'string') {
      return;
    }

    switch (type) {
      case 'start': {
        if (typeof record.sessionId === 'string') {
          agentState.sessionId = record.sessionId;
        }
        const msg: WebviewMessage = {
          type: 'agentAdded',
          agentId: agentState.id,
          sessionId: agentState.sessionId,
        };
        if (isWebviewMessage(msg)) {
          onUpdate(msg);
        }
        break;
      }

      case 'tool': {
        const toolName = typeof record.tool === 'string' ? record.tool : '';
        const toolId = typeof record.toolId === 'string' ? record.toolId : '';
        const status = typeof record.status === 'string' ? record.status : '';

        if (record.action === 'start') {
          agentState.activeToolIds.add(toolId);
          agentState.activeToolStatuses.set(toolId, status);
          agentState.activeToolNames.set(toolId, toolName);
          agentState.hadToolsInTurn = true;

          // Track tools for inspection panel
          const existingTool = agentState.toolsThisTurn.find(t => t.name === toolName);
          if (existingTool) {
            existingTool.count++;
          } else {
            agentState.toolsThisTurn.push({ name: toolName, count: 1 });
          }

          const msg: WebviewMessage = {
            type: 'toolStart',
            agentId: agentState.id,
            toolName,
            status: formatToolStatus(toolName, status),
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        } else if (record.action === 'result' || record.action === 'end') {
          agentState.activeToolIds.delete(toolId);
          agentState.activeToolStatuses.delete(toolId);
          agentState.activeToolNames.delete(toolId);

          const msg: WebviewMessage = {
            type: 'toolEnd',
            agentId: agentState.id,
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        }
        break;
      }

      case 'progress': {
        const toolId = typeof record.toolId === 'string' ? record.toolId : '';
        const status = typeof record.status === 'string' ? record.status : '';

        if (agentState.activeToolIds.has(toolId)) {
          agentState.activeToolStatuses.set(toolId, status);

          const toolName = agentState.activeToolNames.get(toolId) || '';
          const msg: WebviewMessage = {
            type: 'toolProgress',
            agentId: agentState.id,
            status: formatToolStatus(toolName, status),
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        }
        break;
      }

      case 'message': {
        const role = typeof record.role === 'string' ? record.role : '';
        if (role === 'assistant') {
          const content = typeof record.content === 'string' ? record.content : '';
          if (content) {
            agentState.currentTurnAssistantContent = content;
          }
        }
        break;
      }

      case 'turn': {
        if (record.action === 'start') {
          agentState.hookDelivered = false;
          agentState.toolsThisTurn = [];
          agentState.currentTurnStartTime = Date.now();
          agentState.currentTurnAssistantContent = '';
        } else if (record.action === 'end') {
          finalizeTurn(agentState);
          if (!agentState.hookDelivered) {
            const msg: WebviewMessage = {
              type: 'turnEnd',
              agentId: agentState.id,
            };
            if (isWebviewMessage(msg)) {
              onUpdate(msg);
            }
          }
          agentState.hookDelivered = false;
          agentState.hadToolsInTurn = false;
        }
        break;
      }

      case 'permission': {
        if (record.tool !== undefined) {
          const msg: WebviewMessage = {
            type: 'permissionRequest',
            agentId: agentState.id,
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        }
        break;
      }

      case 'system': {
        // Extract model if not yet set
        if (!agentState.model && record.model) {
          agentState.model = record.model as string;
        }

        // Extract system prompt from init type or system_prompt field
        if ((record.type === 'init' || record.system_prompt !== undefined) && !agentState.systemPrompt) {
          agentState.systemPrompt = (record.system_prompt as string) ?? (record.prompt as string) ?? undefined;
        }

        if (record.turn_duration) {
          const duration = record.turn_duration as Record<string, number>;
          const inputTokens = duration.input_tokens ?? 0;
          const cacheReadTokens = duration.cache_read_input_tokens ?? 0;
          const contextWindow = duration.context_window ?? 0;
          
          if (contextWindow > 0) {
            agentState.contextUsed = inputTokens + cacheReadTokens;
            agentState.contextMax = contextWindow;
            
            const msg: WebviewMessage = {
              type: 'contextUpdate',
              agentId: agentState.id,
              contextUsed: agentState.contextUsed,
              contextMax: agentState.contextMax,
            };
            if (isWebviewMessage(msg)) {
              onUpdate(msg);
            }
          }
        }
        break;
      }

      case 'error': {
        if (record.subtype === 'rate_limit') {
          const msg: WebviewMessage = {
            type: 'rateLimitEnter',
            agentId: agentState.id,
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        }
        break;
      }

      default:
        if (!agentState.seenUnknownRecordTypes.has(type)) {
          agentState.seenUnknownRecordTypes.add(type);
        }
        break;
    }

    agentState.lastDataAt = Date.now();
    agentState.linesProcessed++;
  } catch {
    // Skip malformed JSON lines
  }
}
