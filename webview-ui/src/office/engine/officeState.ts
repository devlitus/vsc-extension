import { Character, Seat, OfficeLayout, Position } from '../types';
import { TileMap } from '../layout/tileMap';
import { bfsPath } from './characters';

export interface OfficeState {
  characters: Map<number, Character>;
  seats: Seat[];
  layout: OfficeLayout;
  tileMap: TileMap;
  zoom: number;
  pan: Position;
  selectedCharacterId: number | null;
}

const DEFAULT_CHARACTER_POSITION: Position = { x: 5, y: 5 };

export function createOfficeState(layout?: OfficeLayout): OfficeState {
  const defaultLayout: OfficeLayout = layout ?? {
    version: 1,
    width: 20,
    height: 15,
    tiles: [],
    furniture: [],
    seats: [],
  };
  
  const tileMap = TileMap.fromArray(defaultLayout.tiles);
  
  return {
    characters: new Map(),
    seats: [...(defaultLayout.seats ?? [])],
    layout: defaultLayout,
    tileMap,
    zoom: 2,
    pan: { x: 0, y: 0 },
    selectedCharacterId: null,
  };
}

export function addCharacter(state: OfficeState, id: number, _folderName?: string): Character {
  const seat = state.seats.find((s, i) => {
    const occupied = [...state.characters.values()].some(c => c.position.x === s.position.x && c.position.y === s.position.y);
    return !occupied;
  });
  
  const position = seat?.position ?? DEFAULT_CHARACTER_POSITION;
  
  const character: Character = {
    id,
    position: { ...position },
    targetPath: [],
    state: 'idle',
    facingDir: 'down',
    palette: 'default',
    animFrame: 0,
    animTimer: 0,
  };
  
  state.characters.set(id, character);
  return character;
}

export function removeCharacter(state: OfficeState, id: number): void {
  state.characters.delete(id);
  if (state.selectedCharacterId === id) {
    state.selectedCharacterId = null;
  }
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
  
  // Calculate path to seat
  const path = bfsPath(state.tileMap, character.position, seat.position, obstacles);
  
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
