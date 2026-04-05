import { describe, it, expect } from 'vitest';
import { serialize, deserialize, migrate } from '../src/office/layout/layoutSerializer';
import { OfficeLayout } from '../src/office/types';

describe('layoutSerializer', () => {
  describe('serialize', () => {
    it('serializes a layout to JSON string', () => {
      const layout: OfficeLayout = {
        version: 1,
        width: 10,
        height: 8,
        tiles: [
          ['floor', 'floor', 'empty'],
          ['wall', 'floor', 'empty'],
        ],
        furniture: [],
        seats: [],
      };

      const json = serialize(layout);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.width).toBe(10);
      expect(parsed.height).toBe(8);
      expect(parsed.tiles).toEqual(layout.tiles);
    });
  });

  describe('deserialize', () => {
    it('parses valid JSON to layout object', () => {
      const layout: OfficeLayout = {
        version: 1,
        width: 5,
        height: 5,
        tiles: [['floor']],
        furniture: [],
        seats: [],
      };

      const json = serialize(layout);
      const result = deserialize(json);

      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.width).toBe(5);
    });

    it('returns null for invalid JSON', () => {
      const result = deserialize('not valid json {');
      expect(result).toBeNull();
    });

    it('sanitizes prototype pollution attempt', () => {
      const malicious = '{"__proto__":{"x":1},"version":1,"width":1,"height":1,"tiles":[],"furniture":[],"seats":[]}';
      const result = deserialize(malicious);

      expect(result).not.toBeNull();
      // Verify the pollutant didn't contaminate Object.prototype
      expect((Object.prototype as Record<string, unknown>).x).toBeUndefined();
    });
  });

  describe('round-trip', () => {
    it('serialize → deserialize → equals original', () => {
      const original: OfficeLayout = {
        version: 1,
        width: 20,
        height: 15,
        tiles: Array(15).fill(null).map(() => Array(20).fill('floor')),
        furniture: [
          {
            id: 'furn-1',
            itemId: 'desk',
            position: { x: 5, y: 5 },
            rotation: 0,
            state: 'default',
          },
        ],
        seats: [
          { id: 1, position: { x: 10, y: 10 }, facingDir: 'down' },
        ],
      };

      const json = serialize(original);
      const restored = deserialize(json);

      expect(restored).toEqual(original);
    });
  });

  describe('migrate', () => {
    it('migrates layout without version field', () => {
      const legacyLayout = {
        width: 20,
        height: 15,
        tiles: Array(15).fill(null).map(() => Array(20).fill('floor')),
        furniture: [],
        seats: [],
      };

      const migrated = migrate(legacyLayout);

      expect(migrated.version).toBe(1);
      expect(migrated.width).toBe(20);
      expect(migrated.height).toBe(15);
    });

    it('preserves existing version field', () => {
      const layout: OfficeLayout = {
        version: 2,
        width: 10,
        height: 10,
        tiles: [],
        furniture: [],
        seats: [],
      };

      const migrated = migrate(layout);
      expect(migrated.version).toBe(2);
    });

    it('throws on non-object input', () => {
      expect(() => migrate(null)).toThrow('Invalid layout');
      expect(() => migrate('string')).toThrow('Invalid layout');
      expect(() => migrate(123)).toThrow('Invalid layout');
    });
  });
});