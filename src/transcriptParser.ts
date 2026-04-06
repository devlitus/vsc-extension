import * as os from 'os';
import * as path from 'path';
import { AgentState, WebviewMessage, TurnSummary } from './types';

const POLL_PROTOTYPE_KEYS = ['__proto__', 'constructor', 'prototype'];

// Performance: Fast path shallow clone with prototype pollution protection
// Use structuredClone() for deep cloning only when necessary (Node 17+)
export function deepCloneWithProtection<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Performance: Try structuredClone first (fast native implementation, Node 17+)
  if (typeof structuredClone !== 'undefined') {
    try {
      const cloned = structuredClone(obj);
      // Double-check no prototype pollution in the clone
      if (typeof cloned === 'object' && cloned !== null) {
        for (const key of POLL_PROTOTYPE_KEYS) {
          if (key in cloned) {
            // Fall back to manual clone if structuredClone didn't filter properly
            break;
          }
        }
        return cloned as T;
      }
    } catch {
      // structuredClone may fail for some objects, fall back to manual clone
    }
  }

  // Fallback: Fast path shallow copy with protection
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
    const arr = obj.map(item => deepCloneWithProtection(item));
    Object.freeze(arr);
    return arr as T;
  }

  const cloned: any = {};
  for (const key in obj) {
    if (!POLL_PROTOTYPE_KEYS.includes(key)) {
      cloned[key] = deepCloneWithProtection((obj as Record<string, unknown>)[key]);
    }
  }
  Object.freeze(cloned);
  return cloned as T;
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

function finalizeTurn(agentState: AgentState): void {
  if (agentState.currentTurnStartTime === undefined) {
    return;
  }

  const duration = Date.now() - agentState.currentTurnStartTime;
  const turnSummary: TurnSummary = {
    startedAt: agentState.currentTurnStartTime,
    endedAt: Date.now(),
    toolsUsed: agentState.toolsThisTurn.map(t => ({ name: t.name, count: t.count })),
    tokensUsed: agentState.contextUsed ?? 0,
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

export function deriveStatusFromToolInput(toolName: string, input: Record<string, unknown>): string {
  if (!input || typeof input !== 'object') return '';
  if (toolName === 'Bash') return typeof input.command === 'string' ? input.command : '';
  if (['Read', 'Write', 'Edit', 'Create'].includes(toolName)) {
    return typeof input.file_path === 'string' ? input.file_path : '';
  }
  if (toolName === 'WebFetch') return typeof input.url === 'string' ? input.url : '';
  if (toolName === 'WebSearch') return typeof input.query === 'string' ? input.query : '';
  return '';
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

    if (POLL_PROTOTYPE_KEYS.some(key => Object.prototype.hasOwnProperty.call(record, key))) {
      return;
    }

    const type = record.type;

    if (typeof type !== 'string') {
      return;
    }

    console.log(`[PixelAgents] parse: agent=${agentState.id} type=${type}`);

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

        // Old format: turn_duration field with token counts
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

        // New format (v2.x): stop_hook_summary marks end of a conversation turn
        if (record.subtype === 'stop_hook_summary') {
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

      // --- New-format JSONL handlers (Claude Code v2.x) ---

      case 'permission-mode': {
        // First line of every new session — use as agent registration event
        if (typeof record.sessionId === 'string') {
          agentState.sessionId = record.sessionId;
        }
        if (!agentState.agentRegistered) {
          agentState.agentRegistered = true;
          console.log(`[PixelAgents] permission-mode → agentAdded id=${agentState.id} session=${agentState.sessionId}`);
          const msg: WebviewMessage = {
            type: 'agentAdded',
            agentId: agentState.id,
            sessionId: agentState.sessionId,
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        }
        break;
      }

      case 'user': {
        // New format (Claude Code CLI v2+): Register agent on first user record.
        // Some sessions (e.g. after /clear or resumed sessions) do NOT start with a
        // 'permission-mode' line, so permissionMode is absent from user records too.
        // We still need to emit agentAdded so the character appears in the webview.
        if (!agentState.agentRegistered) {
          agentState.agentRegistered = true;
          if (typeof record.sessionId === 'string') {
            agentState.sessionId = record.sessionId;
          }
          console.log(`[PixelAgents] user → agentAdded id=${agentState.id} session=${agentState.sessionId}`);
          const msg: WebviewMessage = {
            type: 'agentAdded',
            agentId: agentState.id,
            sessionId: agentState.sessionId,
          };
          if (isWebviewMessage(msg)) {
            onUpdate(msg);
          }
        }

        const userMsg = record.message as Record<string, unknown> | undefined;
        const content = userMsg?.content;

        if (typeof content === 'string' && typeof record.promptId === 'string' && record.promptId) {
          // New human-turn start — reset state like old 'turn' action:'start'
          agentState.hookDelivered = false;
          agentState.toolsThisTurn = [];
          agentState.currentTurnStartTime = Date.now();
          agentState.currentTurnAssistantContent = '';
        } else if (Array.isArray(content)) {
          // Tool results — emit toolEnd for each completed tool
          for (const item of content) {
            if (
              typeof item === 'object' && item !== null &&
              (item as Record<string, unknown>).type === 'tool_result'
            ) {
              const toolUseId = (item as Record<string, unknown>).tool_use_id;
              const toolId = typeof toolUseId === 'string' ? toolUseId : '';
              agentState.activeToolIds.delete(toolId);
              agentState.activeToolStatuses.delete(toolId);
              agentState.activeToolNames.delete(toolId);

              const msg: WebviewMessage = { type: 'toolEnd', agentId: agentState.id };
              if (isWebviewMessage(msg)) {
                onUpdate(msg);
              }
            }
          }
        }
        break;
      }

      case 'assistant': {
        const assistantMsg = record.message as Record<string, unknown> | undefined;
        if (!assistantMsg) {
          break;
        }

        const msgContent = assistantMsg.content;
        if (Array.isArray(msgContent)) {
          for (const item of msgContent) {
            if (
              typeof item === 'object' && item !== null &&
              (item as Record<string, unknown>).type === 'tool_use'
            ) {
              const toolEntry = item as Record<string, unknown>;
              const toolId = typeof toolEntry.id === 'string' ? toolEntry.id : '';
              const toolName = typeof toolEntry.name === 'string' ? toolEntry.name : '';
              const toolInput = toolEntry.input as Record<string, unknown> | undefined ?? {};

              // Dedup: only emit toolStart for tool_ids we haven't seen yet
              console.log(`[PixelAgents] assistant tool_use: id=${toolId} name=${toolName} registered=${agentState.agentRegistered}`);
              if (toolId && !agentState.activeToolIds.has(toolId)) {
                agentState.activeToolIds.add(toolId);
                agentState.activeToolNames.set(toolId, toolName);

                const rawStatus = deriveStatusFromToolInput(toolName, toolInput);
                const status = formatToolStatus(toolName, rawStatus);
                agentState.activeToolStatuses.set(toolId, status);
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
                  status,
                };
                if (isWebviewMessage(msg)) {
                  onUpdate(msg);
                }
              }
            }
          }
        }

        // Extract context usage from the final assistant message
        const usage = assistantMsg.usage as Record<string, unknown> | undefined;
        if (usage && typeof usage === 'object') {
          const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
          const cacheRead = typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0;
          const total = inputTokens + cacheRead;
          if (total > 0) {
            agentState.contextUsed = total;
            if (agentState.contextMax === undefined) {
              agentState.contextMax = 200000; // Default for Claude Sonnet/Opus context window
            }
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

      // --- End new-format handlers ---

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
