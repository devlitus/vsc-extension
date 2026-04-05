import React from 'react';
import { EditorState } from './editorState';
import type { EditorTool } from '../types';

interface EditorToolbarProps {
  editorState: EditorState;
  onToolChange: (tool: EditorTool) => void;
  onTileTypeChange: (type: 'floor' | 'wall') => void;
  onFurnitureSelect: (id: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function EditorToolbar({
  editorState,
  onToolChange,
  onTileTypeChange,
  onFurnitureSelect,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  const tools: Array<{ tool: EditorTool; label: string }> = [
    { tool: 'select', label: 'Select' },
    { tool: 'paint', label: 'Paint' },
    { tool: 'erase', label: 'Erase' },
    { tool: 'place', label: 'Place' },
    { tool: 'eyedropper', label: 'Eyedrop' },
    { tool: 'pick', label: 'Pick' },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      background: 'rgba(0,0,0,0.8)',
      padding: 10,
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {tools.map(({ tool, label }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            style={{
              padding: '4px 8px',
              background: editorState.tool === tool ? '#6a6' : '#3a3a3a',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      
      {editorState.tool === 'paint' && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onTileTypeChange('floor')}
            style={{
              padding: '4px 8px',
              background: editorState.selectedTileType === 'floor' ? '#6a6' : '#3a3a3a',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Floor
          </button>
          <button
            onClick={() => onTileTypeChange('wall')}
            style={{
              padding: '4px 8px',
              background: editorState.selectedTileType === 'wall' ? '#6a6' : '#3a3a3a',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Wall
          </button>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onUndo} style={{ padding: '4px 8px' }}>Undo</button>
        <button onClick={onRedo} style={{ padding: '4px 8px' }}>Redo</button>
      </div>
    </div>
  );
}
