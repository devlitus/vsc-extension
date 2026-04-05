import { Character, CharacterState, Position } from '../types';
import { TileMap } from '../layout/tileMap';
import { ANIMATIONS } from '../sprites';
import { OfficeState } from './officeState';

const WALK_SPEED = 2; // tiles per second

export function updateCharacters(state: OfficeState, deltaMs: number): void {
  const deltaSec = deltaMs / 1000;
  
  for (const character of state.characters.values()) {
    updateCharacterAnimation(character, deltaMs);
    
    if (character.targetPath.length > 0 && character.state === 'walk') {
      const target = character.targetPath[0];
      const dx = target.x - character.position.x;
      const dy = target.y - character.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 0.05) {
        character.position = { ...target };
        character.targetPath.shift();
        
        if (character.targetPath.length === 0) {
          character.state = 'idle';
          // Orient toward desk (default down)
          character.facingDir = 'down';
        }
      } else {
        const move = WALK_SPEED * deltaSec;
        character.position.x += (dx / dist) * Math.min(move, dist);
        character.position.y += (dy / dist) * Math.min(move, dist);
        
        // Update facing direction based on movement
        if (Math.abs(dx) > Math.abs(dy)) {
          character.facingDir = dx > 0 ? 'right' : 'left';
        } else {
          character.facingDir = dy > 0 ? 'down' : 'up';
        }
      }
    }
  }
}

function updateCharacterAnimation(character: Character, deltaMs: number): void {
  const animKey = character.state === 'walk' 
    ? `walk-${character.facingDir}` 
    : character.state;
  
  const anim = ANIMATIONS[animKey] ?? ANIMATIONS.idle;
  
  character.animTimer += deltaMs;
  
  if (character.animTimer >= anim.frameDuration) {
    character.animTimer = 0;
    const frameIndex = (character.animFrame + 1) % anim.frames.length;
    character.animFrame = anim.frames[anim.loop ? frameIndex : 0];
  }
}

export function bfsPath(
  tileMap: TileMap,
  from: Position,
  to: Position,
  obstacles: Position[] = []
): Position[] {
  if (from.x === to.x && from.y === to.y) return [];
  
  const queue: Array<{ pos: Position; path: Position[] }> = [];
  const visited = new Set<string>();
  
  // Build obstacle set for O(1) lookup
  const obstacleSet = new Set<string>();
  for (const obs of obstacles) {
    obstacleSet.add(`${obs.x},${obs.y}`);
  }
  
  queue.push({ pos: { ...from }, path: [] });
  visited.add(`${from.x},${from.y}`);
  
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  
  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    
    for (const dir of dirs) {
      const nx = pos.x + dir.x;
      const ny = pos.y + dir.y;
      const key = `${nx},${ny}`;
      
      if (visited.has(key)) continue;
      if (obstacleSet.has(key)) continue;
      if (tileMap.get(nx, ny) === 'wall' || tileMap.get(nx, ny) === 'empty') continue;
      
      const newPath = [...path, { x: nx, y: ny }];
      
      if (nx === to.x && ny === to.y) {
        return newPath;
      }
      
      visited.add(key);
      queue.push({ pos: { x: nx, y: ny }, path: newPath });
    }
  }
  
  return [];
}

export function setCharacterTool(character: Character, toolName: string): void {
  switch (toolName.toLowerCase()) {
    case 'write':
    case 'edit':
    case 'bash':
      character.state = 'type';
      break;
    case 'read':
    case 'glob':
    case 'grep':
    case 'search':
      character.state = 'read';
      break;
    default:
      character.state = 'idle';
  }
}

export function clearCharacterTools(character: Character): void {
  character.state = 'idle';
}

export function setCharacterWaiting(character: Character, waiting: boolean): void {
  character.state = waiting ? 'waiting' : 'idle';
}
