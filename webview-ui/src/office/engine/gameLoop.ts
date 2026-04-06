import { OfficeState, createOfficeState, addCharacter, addSubagent, removeSubagent } from './officeState';
import { updateCharacters } from './characters';
import { render } from './renderer';
import { SPEECH_BUBBLE_DURATION_MS } from '../../../../src/kanbanTypes';

let rafId: number | null = null;
let lastTime = 0;
let canvas: HTMLCanvasElement | null = null;
let state: OfficeState | null = null;
let messageQueue: unknown[] = [];

export function startGameLoop(canvasEl: HTMLCanvasElement, initialState?: OfficeState): () => void {
  canvas = canvasEl;
  state = initialState ?? createOfficeState();
  lastTime = performance.now();
  messageQueue = [];
  
  function loop(time: number) {
    const deltaMs = Math.min(time - lastTime, 100); // Cap at 100ms
    lastTime = time;
    
    if (state && canvas) {
      processMessageQueue(state);
      updateCharacters(state, deltaMs);

      // Clear expired speech bubbles
      const now = Date.now();
      for (const char of state.characters.values()) {
        if (char.bubbleTextTimer && now > char.bubbleTextTimer) {
          char.bubbleText = undefined;
          char.bubbleTextTimer = undefined;
        }
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        render(ctx, state);
      }
    }
    
    rafId = requestAnimationFrame(loop);
  }
  
  rafId = requestAnimationFrame(loop);
  
  return stopGameLoop;
}

export function stopGameLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function enqueueMessage(message: unknown): void {
  messageQueue.push(message);
}

function processMessageQueue(state: OfficeState): void {
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift();
    if (!msg || typeof msg !== 'object') continue;
    
    const message = msg as Record<string, unknown>;
    const agentId = message.agentId as number | undefined;
    
    switch (message.type) {
      case 'agentAdded':
        if (typeof message.agentId === 'number') {
          addCharacter(state, message.agentId, message.folderName as string | undefined);
        }
        break;
        
      case 'turnEnd':
      case 'permissionRequest':
        // Set specific character to waiting state
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char) {
            char.bubbleType = message.type === 'permissionRequest' ? 'permission' : 'waiting';
            char.state = 'waiting';
          }
        } else {
          // Fallback: set all characters if no agentId
          for (const char of state.characters.values()) {
            char.bubbleType = message.type === 'permissionRequest' ? 'permission' : 'waiting';
            char.state = 'waiting';
          }
        }
        break;
        
      case 'toolStart':
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char && message.toolName) {
            char.state = 'type';
          }
        } else {
          for (const char of state.characters.values()) {
            if (message.toolName) {
              char.state = 'type';
            }
          }
        }
        break;
        
      case 'toolEnd':
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char) {
            char.state = 'idle';
            char.bubbleType = undefined;
          }
        } else {
          for (const char of state.characters.values()) {
            char.state = 'idle';
            char.bubbleType = undefined;
          }
        }
        break;

      case 'subagentToolStart':
        if (typeof message.agentId === 'number' && typeof message.toolId === 'string') {
          const parentId = message.parentId as number | undefined ?? message.agentId;
          addSubagent(state, message.agentId, message.toolId, parentId);
        }
        break;

      case 'subagentToolDone':
      case 'subagentClear':
        if (typeof message.agentId === 'number' && typeof message.toolId === 'string') {
          removeSubagent(state, message.agentId, message.toolId);
        }
        break;

      case 'contextUpdate':
        if (typeof message.agentId === 'number') {
          const char = state.characters.get(message.agentId);
          if (char) {
            char.contextUsed = message.contextUsed as number | undefined;
            char.contextMax = message.contextMax as number | undefined;
          }
        }
        break;

      case 'rateLimitEnter':
        if (typeof message.agentId === 'number') {
          const char = state.characters.get(message.agentId);
          if (char) {
            char.isRateLimited = true;
            char.bubbleType = 'zzz';
          }
        }
        break;

      case 'rateLimitExit':
        if (typeof message.agentId === 'number') {
          const char = state.characters.get(message.agentId);
          if (char) {
            char.isRateLimited = false;
            if (char.bubbleType === 'zzz') {
              char.bubbleType = undefined;
            }
          }
        }
        break;

      case 'kanbanTaskAssigned':
        if (typeof message.agentId === 'number' && typeof message.taskTitle === 'string') {
          const char = state.characters.get(message.agentId);
          if (char) {
            char.bubbleText = message.taskTitle.slice(0, 30); // Truncate to 30 chars
            char.bubbleTextTimer = Date.now() + SPEECH_BUBBLE_DURATION_MS;
          }
        }
        break;
    }
  }
}
