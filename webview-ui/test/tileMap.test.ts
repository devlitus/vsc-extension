import { describe, it, expect } from 'vitest';
import { TileMap } from '../src/office/layout/tileMap';
import { TileType } from '../src/office/types';

describe('TileMap', () => {
  describe('get/set', () => {
    it('returns correct value after set', () => {
      const map = new TileMap(5, 5);
      map.set(2, 3, 'floor');
      expect(map.get(2, 3)).toBe('floor');
    });

    it('returns empty for unset tiles', () => {
      const map = new TileMap(3, 3);
      expect(map.get(0, 0)).toBe('empty');
    });

    it('set updates multiple tiles independently', () => {
      const map = new TileMap(5, 5);
      map.set(0, 0, 'floor');
      map.set(1, 1, 'wall');
      map.set(2, 2, 'floor');

      expect(map.get(0, 0)).toBe('floor');
      expect(map.get(1, 1)).toBe('wall');
      expect(map.get(2, 2)).toBe('floor');
      expect(map.get(3, 3)).toBe('empty');
    });
  });

  describe('out-of-bounds', () => {
    it('get returns empty for negative coordinates', () => {
      const map = new TileMap(5, 5);
      expect(map.get(-1, 0)).toBe('empty');
      expect(map.get(0, -1)).toBe('empty');
      expect(map.get(-5, -5)).toBe('empty');
    });

    it('get returns empty for coordinates beyond dimensions', () => {
      const map = new TileMap(5, 5);
      expect(map.get(5, 0)).toBe('empty');
      expect(map.get(0, 5)).toBe('empty');
      expect(map.get(100, 100)).toBe('empty');
    });

    it('set out-of-bounds does not throw', () => {
      const map = new TileMap(5, 5);
      expect(() => map.set(-1, 0, 'floor')).not.toThrow();
      expect(() => map.set(0, -1, 'wall')).not.toThrow();
      expect(() => map.set(5, 5, 'floor')).not.toThrow();
      expect(() => map.set(100, 100, 'wall')).not.toThrow();
    });

    it('set out-of-bounds does not modify existing valid tiles', () => {
      const map = new TileMap(5, 5);
      map.set(2, 2, 'floor');
      map.set(100, 100, 'wall'); // out of bounds
      expect(map.get(2, 2)).toBe('floor');
    });
  });

  describe('resize', () => {
    it('preserves existing tiles when expanding', () => {
      const map = new TileMap(3, 3);
      map.set(0, 0, 'floor');
      map.set(1, 1, 'wall');
      map.set(2, 2, 'floor');

      map.resize(5, 5);

      expect(map.get(0, 0)).toBe('floor');
      expect(map.get(1, 1)).toBe('wall');
      expect(map.get(2, 2)).toBe('floor');
      expect(map.get(3, 3)).toBe('empty'); // new area
    });

    it('preserves existing tiles when shrinking', () => {
      const map = new TileMap(5, 5);
      map.set(0, 0, 'floor');
      map.set(4, 4, 'wall');

      map.resize(3, 3);

      expect(map.get(0, 0)).toBe('floor');
      expect(map.get(4, 4)).toBe('empty'); // was trimmed
    });

    it('dimensions are updated correctly', () => {
      const map = new TileMap(3, 3);
      map.resize(10, 8);
      expect(map.width).toBe(10);
      expect(map.height).toBe(8);
    });
  });

  describe('toArray/fromArray', () => {
    it('toArray returns a copy of the data', () => {
      const map = new TileMap(3, 3);
      map.set(1, 1, 'floor');

      const arr = map.toArray();
      arr[1][1] = 'wall'; // modify the copy

      expect(map.get(1, 1)).toBe('floor'); // original unchanged
    });

    it('fromArray creates map with correct dimensions', () => {
      const data: TileType[][] = [
        ['floor', 'wall'],
        ['empty', 'floor'],
      ];

      const map = TileMap.fromArray(data);

      expect(map.width).toBe(2);
      expect(map.height).toBe(2);
      expect(map.get(0, 0)).toBe('floor');
      expect(map.get(1, 0)).toBe('wall');
      expect(map.get(0, 1)).toBe('empty');
    });

    it('round-trip: toArray → fromArray preserves values', () => {
      const original = new TileMap(5, 4);
      original.set(0, 0, 'floor');
      original.set(2, 1, 'wall');
      original.set(4, 3, 'floor');

      const arr = original.toArray();
      const restored = TileMap.fromArray(arr);

      expect(restored.get(0, 0)).toBe('floor');
      expect(restored.get(2, 1)).toBe('wall');
      expect(restored.get(4, 3)).toBe('floor');
      expect(restored.width).toBe(original.width);
      expect(restored.height).toBe(original.height);
    });
  });
});