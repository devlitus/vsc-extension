import { WebviewMessage } from '../types';
import { HookEvent } from './types';
import { AgentManager } from '../agentManager';

/**
 * Validates a raw JSON object as a HookEvent.
 *
 * Checks that the object is a non-null record with a `type` field containing
 * one of the valid hook event types, and a `sessionId` string that does not
 * exceed 256 characters.
 *
 * @param obj - Raw parsed JSON object to validate
 * @returns true if the object conforms to the HookEvent interface
 *
 * @example
 * if (validateHookEvent(parsedBody)) {
 *   handleHookEvent(parsedBody as HookEvent, agentManager, postMessage);
 * }
 */
export function validateHookEvent(obj: unknown): obj is HookEvent {
  if (typeof obj !== 'object' || obj === null) return false;
  const event = obj as Record<string, unknown>;
  if (typeof event.type !== 'string') return false;
  if (!['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop'].includes(event.type)) return false;
  if (typeof event.sessionId !== 'string') return false;
  if (event.sessionId.length > 256) return false; // Prevent oversized sessionId
  return true;
}

/**
 * Routes a hook event from Claude Code to the appropriate webview message.
 *
 * Finds the agent by `sessionId` and dispatches based on event type:
 * - `PreToolUse` → sends `permissionRequest` message, marks `permissionSent`
 * - `PostToolUse` → sends `toolEnd` message
 * - `Stop` / `SubagentStop` → sends `turnEnd` with `source: 'hook'`,
 *   marks `hookDelivered` to prevent duplicate turnEnd from polling
 *
 * Silently ignores events when no matching agent is found (e.g., agent
 * was removed or sessionId doesn't match).
 *
 * @param event - The hook event from Claude Code
 * @param agentManager - AgentManager instance for O(1) agent lookups
 * @param postMessage - Callback to send messages to the webview
 */
export function handleHookEvent(
  event: HookEvent,
  agentManager: AgentManager,
  postMessage: (agentId: number, msg: WebviewMessage) => void
): void {
  // Find agent by sessionId - silently ignore if not found
  const agent = agentManager.getAgentBySessionId(event.sessionId);
  if (!agent) {
    return;
  }

  switch (event.type) {
    case 'PreToolUse':
      agent.permissionSent = true;
      postMessage(agent.id, { type: 'permissionRequest', agentId: agent.id });
      break;

    case 'PostToolUse':
      postMessage(agent.id, { type: 'toolEnd', agentId: agent.id });
      break;

    case 'Stop':
    case 'SubagentStop':
      agent.hookDelivered = true;
      postMessage(agent.id, { type: 'turnEnd', agentId: agent.id, source: 'hook' });
      break;
  }
}