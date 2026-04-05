import { describe, it, expect, beforeEach } from 'vitest';
import { paintTile, eraseTile } from '../src/office/editor/editorActions';
import { createEditorState, pushUndo, undo, redo, clearRedo } from '../src/office/editor/editorState';
import { OfficeLayout } from '../src/office/types';

function createLayout(): OfficeLayout {
  return {
    version: 1,
    width: 5,
    height: 5,
    tiles: [
      ['floor', 'floor', 'floor', 'floor', 'floor'],
      ['floor', 'floor', 'floor', 'floor', 'floor'],
      ['floor', 'floor', 'floor', 'floor', 'floor'],
      ['floor', 'floor', 'floor', 'floor', 'floor'],
      ['floor', 'floor', 'floor', 'floor', 'floor'],
    ],
    furniture: [],
    seats: [],
  };
}

describe('editorActions', () => {
  describe('paintTile', () => {
    it('returns new layout with modified tile', () => {
      const original = createLayout();

      const result = paintTile(original, { x: 2, y: 2 }, 'wall');

      expect(result.tiles[2][2]).toBe('wall');
    });

    it('does not mutate original layout (immutability)', () => {
      const original = createLayout();

      paintTile(original, { x: 2, y: 2 }, 'wall');

      expect(original.tiles[2][2]).toBe('floor');
    });

    it('returns new tiles array (not same reference)', () => {
      const original = createLayout();

      const result = paintTile(original, { x: 2, y: 2 }, 'wall');

      expect(result.tiles).not.toBe(original.tiles);
    });

    it('preserves other tiles unchanged', () => {
      const original = createLayout();

      const result = paintTile(original, { x: 0, y: 0 }, 'wall');

      expect(result.tiles[0][1]).toBe('floor');
      expect(result.tiles[1][0]).toBe('floor');
      expect(result.tiles[4][4]).toBe('floor');
    });
  });

  describe('eraseTile', () => {
    it('sets tile to empty', () => {
      const original = createLayout();
      original.tiles[2][2] = 'wall';

      const result = eraseTile(original, { x: 2, y: 2 });

      expect(result.tiles[2][2]).toBe('empty');
    });

    it('does not mutate original layout', () => {
      const original = createLayout();
      original.tiles[2][2] = 'wall';

      eraseTile(original, { x: 2, y: 2 });

      expect(original.tiles[2][2]).toBe('wall');
    });
  });
});

describe('undo/redo', () => {
  let state: ReturnType<typeof createEditorState>;
  let layout: OfficeLayout;

  beforeEach(() => {
    state = createEditorState();
    layout = createLayout();
  });

  describe('undo/redo cycle', () => {
    it('undo returns previous layout', () => {
      const original = createLayout();
      layout = original;

      pushUndo(state, layout);
      const modified = paintTile(layout, { x: 0, y: 0 }, 'wall');
      layout = modified;

      const restored = undo(state, layout);

      expect(restored).not.toBeNull();
      expect(restored!.tiles[0][0]).toBe('floor'); // back to original
    });

    it('redo returns next layout', () => {
      const original = createLayout();
      layout = original;

      pushUndo(state, layout);
      const modified = paintTile(layout, { x: 0, y: 0 }, 'wall');
      layout = modified;

      const restored = undo(state, layout); // undo to original

      const redoResult = redo(state, restored!);

      expect(redoResult).not.toBeNull();
      expect(redoResult!.tiles[0][0]).toBe('wall'); // back to modified
    });

    it('multiple undo/redo steps work correctly', () => {
      pushUndo(state, layout);

      const state1 = paintTile(layout, { x: 0, y: 0 }, 'wall');
      layout = state1;
      pushUndo(state, layout);

      const state2 = paintTile(layout, { x: 1, y: 1 }, 'wall');
      layout = state2;
      pushUndo(state, layout);

      const state3 = paintTile(layout, { x: 2, y: 2 }, 'wall');
      layout = state3;

      // Undo twice
      const afterUndo1 = undo(state, layout);
      const afterUndo2 = undo(state, afterUndo1!);

      expect(afterUndo2!.tiles[0][0]).toBe('wall');
      expect(afterUndo2!.tiles[1][1]).toBe('floor');

      // Redo once
      const afterRedo = redo(state, afterUndo2!);
      expect(afterRedo!.tiles[0][0]).toBe('wall');
      expect(afterRedo!.tiles[1][1]).toBe('wall');
      expect(afterRedo!.tiles[2][2]).toBe('floor');
    });
  });

  describe('redo stack cleared after new action', () => {
    it('redo stack is cleared when new action is pushed', () => {
      pushUndo(state, layout);

      const state1 = paintTile(layout, { x: 0, y: 0 }, 'wall');
      layout = state1;
      pushUndo(state, layout);

      const state2 = paintTile(layout, { x: 1, y: 1 }, 'wall');
      layout = state2;

      // Undo once
      const afterUndo = undo(state, layout);

      // New action should clear redo stack
      const state3 = paintTile(layout, { x: 2, y: 2 }, 'wall');
      pushUndo(state, state3);

      const redoResult = redo(state, state3);

      // Redo should be empty since redo stack was cleared
      expect(redoResult).toBeNull();
    });

    it('clearRedo empties the redo stack', () => {
      pushUndo(state, layout);

      const state1 = paintTile(layout, { x: 0, y: 0 }, 'wall');
      layout = state1;
      pushUndo(state, layout);

      undo(state, layout);

      clearRedo(state);

      const redoResult = redo(state, layout);
      expect(redoResult).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('undo returns null when undo stack is empty', () => {
      const result = undo(state, layout);
      expect(result).toBeNull();
    });

    it('redo returns null when redo stack is empty', () => {
      const result = redo(state, layout);
      expect(result).toBeNull();
    });
  });
});