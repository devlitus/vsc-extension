import { OfficeState, createOfficeState, addCharacter } from './officeState';
import { updateCharacters } from './characters';
import { render } from './renderer';

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
    }
  }
}
