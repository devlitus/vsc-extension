import { OfficeState, createOfficeState, addCharacter, addSubagent, removeSubagent } from './officeState';
import { updateCharacters } from './characters';
import { render } from './renderer';
import { MessageQueue } from './messageQueue';
import { SPEECH_BUBBLE_DURATION_MS } from '../../../../src/kanbanTypes';

let rafId: number | null = null;
let lastTime = 0;
let canvas: HTMLCanvasElement | null = null;
let state: OfficeState | null = null;
let messageQueue = new MessageQueue<unknown>();
let bubbleCheckInterval: NodeJS.Timeout | null = null;

// Tool name to character state mapping
// Reading tools -> 'read', Writing/Running tools -> 'type'
const TOOL_TO_STATE_MAP: Record<string, 'read' | 'type'> = {
  'Read': 'read',
  'Grep': 'read',
  'Glob': 'read',
  'LS': 'read',
  'WebSearch': 'read',
  'WebFetch': 'read',
  'TodoRead': 'read',
  // Writing/Running tools
  'Write': 'type',
  'Edit': 'type',
  'MultiEdit': 'type',
  'Bash': 'type',
  'Run': 'type',
  'TodoWrite': 'type',
};

function getCharacterStateForTool(toolName: string): 'read' | 'type' {
  return TOOL_TO_STATE_MAP[toolName] ?? 'type';
}

export function startGameLoop(canvasEl: HTMLCanvasElement, initialState?: OfficeState): () => void {
  canvas = canvasEl;
  state = initialState ?? createOfficeState();
  lastTime = performance.now();
  messageQueue = new MessageQueue<unknown>();

  // Start separate bubble check interval
  bubbleCheckInterval = setInterval(() => {
    const now = Date.now();
    if (state) {
      for (const [id, character] of state.characters) {
        // Dismiss speech bubbles after timer expires
        if (character.bubbleTextTimer && now > character.bubbleTextTimer) {
          character.bubbleText = undefined;
          character.bubbleTextTimer = undefined;
        }
        // Dismiss 'done' bubbles after timer expires
        if (character.bubbleType === 'done' && character.bubbleTextTimer && now > character.bubbleTextTimer) {
          character.bubbleType = undefined;
          character.bubbleTextTimer = undefined;
        }
      }
    }
  }, 100);

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
  if (bubbleCheckInterval) {
    clearInterval(bubbleCheckInterval);
    bubbleCheckInterval = null;
  }
}

export function enqueueMessage(message: unknown): void {
  messageQueue.enqueue(message);
}

function processMessageQueue(state: OfficeState): void {
  while (!messageQueue.isEmpty()) {
    const msg = messageQueue.dequeue();
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
        // Show celebration bubble (done) instead of waiting bubble
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char) {
            char.bubbleType = 'done';
            char.bubbleTextTimer = Date.now() + SPEECH_BUBBLE_DURATION_MS;
            char.state = 'waiting';
          }
        } else {
          // Fallback: set all characters if no agentId
          for (const char of state.characters.values()) {
            char.bubbleType = 'done';
            char.bubbleTextTimer = Date.now() + SPEECH_BUBBLE_DURATION_MS;
            char.state = 'waiting';
          }
        }
        break;

      case 'permissionRequest':
        // Set specific character to waiting state with permission bubble
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char) {
            char.bubbleType = 'permission';
            char.state = 'waiting';
          }
        } else {
          // Fallback: set all characters if no agentId
          for (const char of state.characters.values()) {
            char.bubbleType = 'permission';
            char.state = 'waiting';
          }
        }
        break;

      case 'toolStart':
        const toolName = message.toolName as string | undefined;
        const charState = toolName ? getCharacterStateForTool(toolName) : 'type';

        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char && toolName) {
            char.state = charState;
          }
        } else {
          for (const char of state.characters.values()) {
            if (toolName) {
              char.state = charState;
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
