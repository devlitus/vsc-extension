import { OfficeState, createOfficeState, addCharacter, addSubagent, removeSubagent, removeCharacter } from './officeState';
import { updateCharacters, bfsPath } from './characters';
import { render } from './renderer';
import { MessageQueue } from './messageQueue';
import { SPEECH_BUBBLE_DURATION_MS } from '../../../../src/kanbanTypes';
import { initTileset } from '../sprites/kenneySprites';
import { Position } from '../types';

let rafId: number | null = null;
let lastTime = 0;
let canvas: HTMLCanvasElement | null = null;
let state: OfficeState | null = null;
let messageQueue = new MessageQueue<unknown>();
let bubbleCheckInterval: NodeJS.Timeout | null = null;

// Break spots: near the center rug in the main office
const BREAK_SPOTS = [
  { x: 6, y: 7 },
  { x: 7, y: 7 },
  { x: 8, y: 7 },
  { x: 7, y: 8 },
];

function breakSpotFor(agentId: number) {
  return BREAK_SPOTS[Math.abs(agentId) % BREAK_SPOTS.length];
}

const MIN_TOOL_DISPLAY_MS = 2000; // Minimum time to show tool animation before toolEnd

// Conference meeting spots: chairs around the conference table
const CONFERENCE_SPOTS: Position[] = [
  { x: 17, y: 10 }, // left side chairs
  { x: 17, y: 12 },
  { x: 17, y: 14 },
  { x: 20, y: 10 }, // right side chairs
  { x: 20, y: 12 },
  { x: 20, y: 14 },
];

function meetingSpotFor(agentId: number, index: number = 0): Position {
  const baseIndex = (Math.abs(agentId) + index) % CONFERENCE_SPOTS.length;
  return CONFERENCE_SPOTS[baseIndex];
}

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

// Meeting management: trigger conference meeting when ≥ 2 agents are idle
function checkAndTriggerMeeting(state: OfficeState): void {
  const idleAgents = [...state.characters.values()].filter(c =>
    c.state === 'idle' && !c.isInMeeting && !c.returnHomeAt && c.targetPath.length === 0
  );

  // Only trigger meeting if we have at least 2 idle agents
  if (idleAgents.length >= 2) {
    // Assign meeting spots and walk to conference room
    let spotIndex = 0;
    for (const agent of idleAgents) {
      if (spotIndex >= CONFERENCE_SPOTS.length) break; // No more spots available

      const meetingSpot = meetingSpotFor(agent.id, spotIndex);
      const otherChars = [...state.characters.values()].filter(c => c.id !== agent.id);
      const path = bfsPath(state.tileMap, agent.position, meetingSpot, [], otherChars);

      if (path.length > 0) {
        agent.targetPath = path;
        agent.state = 'walk';
        agent.targetFacingDir = 'up'; // Face inward toward table
        agent.isInMeeting = true;
      }

      spotIndex++;
    }
  }
}

// Return all agents from meeting when work arrives
function dismissMeeting(state: OfficeState): void {
  const meetingAgents = [...state.characters.values()].filter(c => c.isInMeeting);

  for (const agent of meetingAgents) {
    agent.isInMeeting = false;
    if (agent.homePosition) {
      const otherChars = [...state.characters.values()].filter(c => c.id !== agent.id);
      const path = bfsPath(state.tileMap, agent.position, agent.homePosition, [], otherChars);

      if (path.length > 0) {
        agent.targetPath = path;
        agent.state = 'walk';
        agent.targetFacingDir = 'up';
        agent.pendingState = 'idle'; // Will be overridden to working state by toolStart
      } else {
        agent.position = { ...agent.homePosition };
        agent.state = 'idle';
        agent.facingDir = 'up';
      }
    }
  }
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
      for (const [_id, character] of state.characters) {
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
        // Apply deferred toolEnd when minimum display time has elapsed
        if (character.toolEndAt && now >= character.toolEndAt) {
          character.toolEndAt = undefined;
          character.bubbleType = 'done';
          character.bubbleTextTimer = now + SPEECH_BUBBLE_DURATION_MS;
          character.bubbleText = undefined;
          character.pendingState = undefined;
          character.state = 'idle';
          const breakSpot = breakSpotFor(character.id);
          const otherChars = [...state.characters.values()].filter(c => c.id !== character.id);
          const breakPath = bfsPath(state.tileMap, character.position, breakSpot, [], otherChars);
          if (breakPath.length > 0) {
            character.targetPath = breakPath;
            character.state = 'walk';
            character.targetFacingDir = 'down';
          }
        }
        // Return home from break when timer expires
        if (character.returnHomeAt && now > character.returnHomeAt && character.homePosition) {
          character.returnHomeAt = undefined;
          const otherChars = [...state.characters.values()].filter(c => c.id !== character.id);
          const homePath = bfsPath(state.tileMap, character.position, character.homePosition, [], otherChars);
          if (homePath.length > 0) {
            character.targetPath = homePath;
            character.state = 'walk';
            character.targetFacingDir = 'up';
          } else {
            character.position = { ...character.homePosition };
            character.state = 'idle';
            character.facingDir = 'up';
          }
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
        if (typeof message.agentId === 'number' && !state.characters.has(message.agentId)) {
          const newChar = addCharacter(state, message.agentId, message.folderName as string | undefined);
          // Walk from entrance to idle break spot
          const idleSpot = breakSpotFor(message.agentId);
          const idlePath = bfsPath(state.tileMap, newChar.position, idleSpot, [], []);
          if (idlePath.length > 0) {
            newChar.targetPath = idlePath;
            newChar.state = 'walk';
          }
        }
        break;

      case 'agentRemoved':
        if (typeof message.agentId === 'number') {
          removeCharacter(state, message.agentId);
        }
        break;

      case 'turnEnd':
        // Dismiss any active conference meeting when turn ends
        dismissMeeting(state);

        // Show done bubble, then walk back to idle (break) spot
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char) {
            char.bubbleType = 'done';
            char.bubbleTextTimer = Date.now() + SPEECH_BUBBLE_DURATION_MS;
            char.bubbleText = undefined;
            char.pendingState = undefined;
            const breakSpot = breakSpotFor(agentId);
            const otherChars = [...state.characters.values()].filter(c => c.id !== agentId);
            const breakPath = bfsPath(state.tileMap, char.position, breakSpot, [], otherChars);
            if (breakPath.length > 0) {
              char.targetPath = breakPath;
              char.state = 'walk';
              char.targetFacingDir = 'down';
              // No returnHomeAt — character stays at break spot until next tool
            } else {
              char.state = 'idle';
            }
          }
        } else {
          for (const char of state.characters.values()) {
            char.bubbleType = 'done';
            char.bubbleTextTimer = Date.now() + SPEECH_BUBBLE_DURATION_MS;
            char.bubbleText = undefined;
            char.state = 'idle';
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

      case 'toolStart': {
        const toolName = message.toolName as string | undefined;
        const charState = toolName ? getCharacterStateForTool(toolName) : 'type';

        // Dismiss any active conference meeting when work arrives
        dismissMeeting(state);

        if (agentId !== undefined) {
          // Auto-create character if not yet registered (e.g. parallel subagent JSONL)
          if (!state.characters.has(agentId)) {
            const newChar = addCharacter(state, agentId);
            const idleSpot = breakSpotFor(agentId);
            const idlePath = bfsPath(state.tileMap, newChar.position, idleSpot, [], []);
            if (idlePath.length > 0) { newChar.targetPath = idlePath; newChar.state = 'walk'; }
          }
          const char = state.characters.get(agentId);
          if (char && toolName) {
            char.bubbleText = toolName;
            char.bubbleTextTimer = undefined;
            char.returnHomeAt = undefined; // cancel any idle timer
            char.bubbleType = undefined;
            char.toolEndAt = undefined; // cancel any pending toolEnd
            if (char.homePosition) {
              const atDesk =
                char.position.x === char.homePosition.x &&
                char.position.y === char.homePosition.y;
              if (!atDesk) {
                // Walk to desk first, then start typing when arrived
                const otherChars = [...state.characters.values()].filter(c => c.id !== agentId);
                const homePath = bfsPath(state.tileMap, char.position, char.homePosition, [], otherChars);
                if (homePath.length > 0) {
                  char.targetPath = homePath;
                  char.state = 'walk';
                  char.targetFacingDir = 'up';
                  char.pendingState = charState;
                } else {
                  char.state = charState;
                }
              } else {
                char.state = charState;
              }
            } else {
              char.state = charState;
            }
          }
        } else {
          for (const char of state.characters.values()) {
            if (toolName) {
              char.state = charState;
              char.bubbleText = toolName;
              char.bubbleTextTimer = undefined;
              char.returnHomeAt = undefined;
            }
          }
        }
        break;
      }

      case 'toolEnd':
        if (agentId !== undefined) {
          const char = state.characters.get(agentId);
          if (char) {
            // Defer toolEnd so animations are visible even for fast tools
            char.toolEndAt = Math.max(
              Date.now() + MIN_TOOL_DISPLAY_MS,
              char.toolEndAt ?? 0
            );
            // Check if we should trigger a conference meeting
            checkAndTriggerMeeting(state);
          }
        } else {
          for (const char of state.characters.values()) {
            char.toolEndAt = Math.max(Date.now() + MIN_TOOL_DISPLAY_MS, char.toolEndAt ?? 0);
          }
          checkAndTriggerMeeting(state);
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

      case 'tilesetReady':
        if (typeof message.uri === 'string') {
          initTileset(message.uri);
        }
        break;
    }
  }
}
