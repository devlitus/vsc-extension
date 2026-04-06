export interface Position {
  x: number;
  y: number;
}

export type CharacterState = 'idle' | 'walk' | 'type' | 'read' | 'waiting';

export type FacingDir = 'up' | 'down' | 'left' | 'right';

export interface Character {
  id: number;
  position: Position;
  targetPath: Position[];
  state: CharacterState;
  facingDir: FacingDir;
  palette: string;
  animFrame: number;
  animTimer: number;
  toolStatus?: string;
  bubbleType?: 'permission' | 'waiting' | 'zzz';
  bubbleText?: string;
  bubbleTextTimer?: number;
  contextUsed?: number;
  contextMax?: number;
  isRateLimited?: boolean;
}

export interface SubagentCharacter {
  id: string; // composite key: "<agentId>:<toolId>"
  agentId: number;
  toolId: string;
  position: Position;
  state: 'animating' | 'idle';
  linkedToParentId: number;
  animFrame: number;
  animTimer: number;
}

export interface Seat {
  id: number;
  position: Position;
  facingDir: FacingDir;
}

export interface FurnitureInstance {
  id: string;
  itemId: string;
  position: Position;
  rotation: number;
  state: string;
}

export interface OfficeLayout {
  version: number;
  width: number;
  height: number;
  tiles: TileType[][];
  furniture: FurnitureInstance[];
  seats: Seat[];
}

export type EditorTool = 'select' | 'paint' | 'erase' | 'place' | 'eyedropper' | 'pick';

export type TileType = 'empty' | 'floor' | 'wall';

export interface SpriteEntry {
  url: string;
  palette?: string;
}

export interface FloorTile {
  id: string;
  name: string;
  imageUrl: string;
}
