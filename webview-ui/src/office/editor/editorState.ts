import { EditorTool, OfficeLayout } from '../types';

export interface EditorState {
  tool: EditorTool;
  selectedTileType: 'floor' | 'wall';
  selectedFurnitureId: string | null;
  selectedRotation: number;
  undoStack: OfficeLayout[];
  redoStack: OfficeLayout[];
  isDragging: boolean;
  hoverPos: { x: number; y: number } | null;
}

const MAX_UNDO = 50;

export function createEditorState(): EditorState {
  return {
    tool: 'select',
    selectedTileType: 'floor',
    selectedFurnitureId: null,
    selectedRotation: 0,
    undoStack: [],
    redoStack: [],
    isDragging: false,
    hoverPos: null,
  };
}

export function pushUndo(state: EditorState, layout: OfficeLayout): void {
  state.undoStack.push(JSON.parse(JSON.stringify(layout)));
  if (state.undoStack.length > MAX_UNDO) {
    state.undoStack.shift();
  }
  state.redoStack = [];
}

export function undo(state: EditorState, currentLayout: OfficeLayout): OfficeLayout | null {
  const prev = state.undoStack.pop();
  if (!prev) return null;
  
  state.redoStack.push(JSON.parse(JSON.stringify(currentLayout)));
  return prev;
}

export function redo(state: EditorState, currentLayout: OfficeLayout): OfficeLayout | null {
  const next = state.redoStack.pop();
  if (!next) return null;
  
  state.undoStack.push(JSON.parse(JSON.stringify(currentLayout)));
  return next;
}

export function clearRedo(state: EditorState): void {
  state.redoStack = [];
}
