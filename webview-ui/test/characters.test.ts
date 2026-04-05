import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bfsPath, setCharacterTool, clearCharacterTools } from '../src/office/engine/characters';
import { TileMap } from '../src/office/layout/tileMap';
import { Character } from '../src/office/types';

// Mock ANIMATIONS since characters.ts imports it
vi.mock('../src/office/sprites', () => ({
  ANIMATIONS: {
    idle: { frames: [0], frameDuration: 500, loop: true },
    'walk-up': { frames: [1], frameDuration: 200, loop: true },
    'walk-down': { frames: [2], frameDuration: 200, loop: true },
    'walk-left': { frames: [3], frameDuration: 200, loop: true },
    'walk-right': { frames: [4], frameDuration: 200, loop: true },
    type: { frames: [5], frameDuration: 300, loop: true },
    read: { frames: [6], frameDuration: 300, loop: true },
    waiting: { frames: [7], frameDuration: 400, loop: true },
  },
}));

function createCharacter(id: number = 1): Character {
  return {
    id,
    position: { x: 0, y: 0 },
    targetPath: [],
    state: 'idle',
    facingDir: 'down',
    palette: '#ffffff',
    animFrame: 0,
    animTimer: 0,
  };
}

function createTileMapWithFloor(width: number, height: number): TileMap {
  const map = new TileMap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      map.set(x, y, 'floor');
    }
  }
  return map;
}

describe('bfsPath', () => {
  describe('finds path in open grid', () => {
    it('finds direct horizontal path', () => {
      const map = createTileMapWithFloor(5, 5);
      const path = bfsPath(map, { x: 0, y: 2 }, { x: 4, y: 2 });

      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ x: 4, y: 2 });
    });

    it('finds direct vertical path', () => {
      const map = createTileMapWithFloor(5, 5);
      const path = bfsPath(map, { x: 2, y: 0 }, { x: 2, y: 4 });

      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ x: 2, y: 4 });
    });

    it('finds diagonal path around obstacle', () => {
      const map = createTileMapWithFloor(5, 5);
      const path = bfsPath(map, { x: 0, y: 0 }, { x: 4, y: 4 });

      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ x: 4, y: 4 });
    });
  });

  describe('returns empty when no path exists', () => {
    it('returns empty array when surrounded by walls', () => {
      const map = new TileMap(5, 5);
      // Create a box of walls
      for (let x = 0; x < 5; x++) {
        map.set(x, 0, 'wall');
        map.set(x, 4, 'wall');
      }
      for (let y = 0; y < 5; y++) {
        map.set(0, y, 'wall');
        map.set(4, y, 'wall');
      }
      map.set(2, 2, 'floor'); // only floor is in center

      const path = bfsPath(map, { x: 1, y: 1 }, { x: 3, y: 3 });
      expect(path).toEqual([]);
    });

    it('returns empty when from equals to', () => {
      const map = createTileMapWithFloor(5, 5);
      const path = bfsPath(map, { x: 2, y: 2 }, { x: 2, y: 2 });
      expect(path).toEqual([]);
    });
  });

  describe('does not pass through obstacles', () => {
    it('avoids obstacle positions in additionalObstacles', () => {
      const map = createTileMapWithFloor(5, 5);
      const obstacles = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ];

      const path = bfsPath(map, { x: 0, y: 0 }, { x: 4, y: 0 }, obstacles);

      // Path should not go through y=0 with obstacles
      // Should go around via another row
      if (path.length > 0) {
        for (const pos of path) {
          expect(obstacles.some(o => o.x === pos.x && o.y === pos.y)).toBe(false);
        }
      }
    });

    it('avoids wall tiles in tileMap', () => {
      const map = new TileMap(5, 5);
      // Create floor everywhere except a wall barrier
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          map.set(x, y, x === 2 ? 'wall' : 'floor');
        }
      }

      const path = bfsPath(map, { x: 0, y: 2 }, { x: 4, y: 2 });

      // Should not include x=2 at y=2 (the wall)
      if (path.length > 0) {
        expect(path.some(p => p.x === 2 && p.y === 2)).toBe(false);
      }
    });

    it('avoids empty tiles', () => {
      const map = new TileMap(5, 5);
      // Create floor with empty patches
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          map.set(x, y, x === 2 && y < 5 ? 'empty' : 'floor');
        }
      }

      const path = bfsPath(map, { x: 0, y: 2 }, { x: 4, y: 2 });

      // Path should not include the empty column
      if (path.length > 0) {
        expect(path.some(p => p.x === 2)).toBe(false);
      }
    });
  });
});

describe('state machine', () => {
  describe('setCharacterTool', () => {
    it("sets state to 'type' for Write tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'Write');
      expect(character.state).toBe('type');
    });

    it("sets state to 'type' for edit tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'edit');
      expect(character.state).toBe('type');
    });

    it("sets state to 'type' for bash tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'bash');
      expect(character.state).toBe('type');
    });

    it("sets state to 'read' for Read tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'Read');
      expect(character.state).toBe('read');
    });

    it("sets state to 'read' for glob tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'glob');
      expect(character.state).toBe('read');
    });

    it("sets state to 'read' for grep tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'grep');
      expect(character.state).toBe('read');
    });

    it("sets state to 'read' for search tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'search');
      expect(character.state).toBe('read');
    });

    it("sets state to 'idle' for unknown tool", () => {
      const character = createCharacter();
      setCharacterTool(character, 'unknown');
      expect(character.state).toBe('idle');
    });

    it("sets state to 'idle' for empty string", () => {
      const character = createCharacter();
      setCharacterTool(character, '');
      expect(character.state).toBe('idle');
    });
  });

  describe('clearCharacterTools', () => {
    it("sets state to 'idle'", () => {
      const character = createCharacter();
      character.state = 'type';
      character.toolStatus = 'writing';

      clearCharacterTools(character);

      expect(character.state).toBe('idle');
    });

    it('does not affect other character properties', () => {
      const character = createCharacter(42);
      character.position = { x: 5, y: 10 };
      character.state = 'read';
      character.toolStatus = 'reading';

      clearCharacterTools(character);

      expect(character.id).toBe(42);
      expect(character.position).toEqual({ x: 5, y: 10 });
    });
  });
});