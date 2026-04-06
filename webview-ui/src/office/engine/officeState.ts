import { Character, Seat, OfficeLayout, Position, SubagentCharacter, TileType } from '../types';
import { TileMap } from '../layout/tileMap';
import { bfsPath } from './characters';

export interface OfficeState {
  characters: Map<number, Character>;
  subagents: Map<string, SubagentCharacter>;
  seats: Seat[];
  layout: OfficeLayout;
  tileMap: TileMap;
  zoom: number;
  pan: Position;
  selectedCharacterId: number | null;
}

const DEFAULT_CHARACTER_POSITION: Position = { x: 5, y: 5 };

const OFFICE_W = 24;
const OFFICE_H = 17;

// Explicit entrance position for new agents (door at bottom of main office)
const ENTRANCE_POSITION: Position = { x: 7, y: 14 };

const DEFAULT_SEATS: Seat[] = [
  { id: 1, position: { x: 3, y: 6 }, facingDir: 'up' },
  { id: 2, position: { x: 8, y: 6 }, facingDir: 'up' },
  { id: 3, position: { x: 3, y: 12 }, facingDir: 'up' },
  { id: 4, position: { x: 8, y: 12 }, facingDir: 'up' },
];

function createDefaultTiles(width: number, height: number): TileType[][] {
  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'empty' as TileType)
  );

  // Outer walls
  for (let x = 0; x < width; x++) {
    tiles[0][x] = 'wall';
    tiles[height - 1][x] = 'wall';
  }
  for (let y = 0; y < height; y++) {
    tiles[y][0] = 'wall';
    tiles[y][width - 1] = 'wall';
  }

  // Main office floor (left zone): x=1..14, y=1..height-2
  for (let y = 1; y <= height - 2; y++) {
    for (let x = 1; x <= 14; x++) {
      tiles[y][x] = 'floor';
    }
  }

  // Internal divider wall at x=15 with door gaps
  for (let y = 1; y <= height - 2; y++) {
    tiles[y][15] = 'wall';
  }
  tiles[4][15] = 'floor';   // door to break room
  tiles[5][15] = 'floor';
  tiles[10][15] = 'floor';  // door to conference room
  tiles[11][15] = 'floor';

  // Break room (top-right): x=16..22, y=1..7
  for (let y = 1; y <= 7; y++) {
    for (let x = 16; x <= 22; x++) {
      tiles[y][x] = 'floor2';
    }
  }

  // Horizontal wall between break and conference: y=8, x=16..22 with door gap
  for (let x = 16; x <= 22; x++) {
    tiles[8][x] = 'wall';
  }
  tiles[8][18] = 'floor2';
  tiles[8][19] = 'floor2';

  // Conference room (bottom-right): x=16..22, y=9..height-2
  for (let y = 9; y <= height - 2; y++) {
    for (let x = 16; x <= 22; x++) {
      tiles[y][x] = 'carpet';
    }
  }

  return tiles;
}

export function createOfficeState(layout?: OfficeLayout): OfficeState {
  const defaultTiles = createDefaultTiles(OFFICE_W, OFFICE_H);
  const defaultLayout: OfficeLayout = layout ?? {
    version: 1,
    width: OFFICE_W,
    height: OFFICE_H,
    tiles: defaultTiles,
    furniture: [],
    seats: DEFAULT_SEATS,
  };

  const tileMap = TileMap.fromArray(defaultLayout.tiles);

  return {
    characters: new Map(),
    subagents: new Map(),
    seats: [...(defaultLayout.seats ?? [])],
    layout: defaultLayout,
    tileMap,
    zoom: 2,
    pan: { x: 0, y: 0 },
    selectedCharacterId: null,
  };
}

export function addCharacter(state: OfficeState, id: number, _folderName?: string): Character {
  const seat = state.seats.find(s => {
    const occupied = [...state.characters.values()].some(
      c => c.position.x === s.position.x && c.position.y === s.position.y
    );
    return !occupied;
  });

  const homePos = seat?.position ?? DEFAULT_CHARACTER_POSITION;
  // Spawn from explicit entrance, with slight spread for multiple agents
  const spreadOffset = (Math.abs(id) % 5) - 2; // -2 to +2 offset
  const spawnPos = {
    x: Math.max(2, Math.min(13, ENTRANCE_POSITION.x + spreadOffset)),
    y: ENTRANCE_POSITION.y
  };

  const character: Character = {
    id,
    position: { ...spawnPos },
    targetPath: [],
    state: 'idle',
    facingDir: 'up',
    palette: 'default',
    animFrame: 0,
    animTimer: 0,
    homePosition: { ...homePos },
    targetFacingDir: seat?.facingDir ?? 'up',
  };

  // Walk from entrance to break area (idle zone); desk walk happens on first toolStart
  state.characters.set(id, character);
  return character;
}

export function removeCharacter(state: OfficeState, id: number): void {
  state.characters.delete(id);
  if (state.selectedCharacterId === id) {
    state.selectedCharacterId = null;
  }
}

export function addSubagent(state: OfficeState, agentId: number, toolId: string, parentId: number): SubagentCharacter {
  const parent = state.characters.get(parentId);
  const id = `${agentId}:${toolId}`;

  // Offset position from parent in a random direction
  const offsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  const position: Position = parent
    ? { x: parent.position.x + offset.x, y: parent.position.y + offset.y }
    : { x: 5, y: 5 };

  const subagent: SubagentCharacter = {
    id,
    agentId,
    toolId,
    position,
    state: 'animating',
    linkedToParentId: parentId,
    animFrame: 0,
    animTimer: 0,
  };

  state.subagents.set(id, subagent);
  return subagent;
}

export function removeSubagent(state: OfficeState, agentId: number, toolId: string): void {
  const id = `${agentId}:${toolId}`;
  state.subagents.delete(id);
}

export function setLayout(state: OfficeState, layout: OfficeLayout): void {
  state.layout = layout;
  state.tileMap = TileMap.fromArray(layout.tiles);
  state.seats = [...layout.seats];
}

export function assignSeat(state: OfficeState, characterId: number, seatId: number): void {
  const character = state.characters.get(characterId);
  const seat = state.seats.find(s => s.id === seatId);
  if (!character || !seat) return;

  // Gather obstacles: furniture positions and occupied seats
  const obstacles: Position[] = [];

  // Add furniture positions as obstacles
  for (const furn of state.layout.furniture) {
    obstacles.push(furn.position);
  }

  // Add occupied seat positions (excluding the target seat)
  for (const char of state.characters.values()) {
    if (char.id !== characterId) {
      obstacles.push(char.position);
    }
  }

  // Calculate path to seat, avoiding other characters
  const otherChars = [...state.characters.values()].filter(c => c.id !== characterId);
  const path = bfsPath(state.tileMap, character.position, seat.position, obstacles, otherChars);

  if (path.length > 0) {
    character.targetPath = path;
    character.state = 'walk';
  } else {
    // Fallback: direct teleport if no path found
    character.targetPath = [];
    character.position = { ...seat.position };
    character.facingDir = seat.facingDir;
  }
}

export function setZoom(state: OfficeState, level: number): void {
  state.zoom = Math.max(1, Math.min(4, level));
}
