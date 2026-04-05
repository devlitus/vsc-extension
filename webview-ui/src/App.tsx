import React, { useEffect, useRef, useState } from 'react';
import { init, postMessage, onMessage } from './runtime';
import { createOfficeState } from './office/engine/officeState';
import type { OfficeState } from './office/engine/officeState';
import { startGameLoop, enqueueMessage } from './office/engine/gameLoop';
import { createEditorState } from './office/editor/editorState';
import type { EditorState } from './office/editor/editorState';
import { EditorToolbar } from './office/editor/EditorToolbar';

interface SettingsData {
  soundEnabled: boolean;
  alwaysShowLabels: boolean;
  watchAllSessions: boolean;
  hooksEnabled: boolean;
}

init();

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [officeState] = useState<OfficeState>(() => createOfficeState());
  const [editorState] = useState<EditorState>(() => createEditorState());
  const [isEditorMode] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    soundEnabled: true,
    alwaysShowLabels: false,
    watchAllSessions: false,
    hooksEnabled: true,
  });
  const [versionUpgrade, setVersionUpgrade] = useState<{ oldVersion: string; newVersion: string } | null>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const stop = startGameLoop(canvas, officeState);
    
    const handleMessage = (msg: unknown) => {
      if (!msg || typeof msg !== 'object') {
        return;
      }
      
      const message = msg as Record<string, unknown>;
      
      // Handle settings and version messages directly
      if (message.type === 'settingsLoaded' && typeof message.settings === 'object') {
        setSettings(message.settings as SettingsData);
        return;
      }
      
      if (message.type === 'versionUpgraded') {
        setVersionUpgrade({
          oldVersion: String(message.oldVersion ?? ''),
          newVersion: String(message.newVersion ?? ''),
        });
        return;
      }
      
      // Pass all other messages to the game loop
      enqueueMessage(msg);
    };
    
    onMessage(handleMessage);
    
    // Request initial settings
    postMessage({ type: 'settingsLoaded' });
    
    // Mouse events
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (16 * officeState.zoom));
      const y = Math.floor((e.clientY - rect.top) / (16 * officeState.zoom));
      
      postMessage({ type: 'canvasClick', x, y });
    };
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      officeState.zoom = Math.max(1, Math.min(4, officeState.zoom + delta));
    };
    
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      stop();
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef, officeState, editorState]);
  
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        id="office-canvas"
        width={800}
        height={600}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isEditorMode ? 'crosshair' : 'default' }}
      />
      {isEditorMode && (
        <EditorToolbar
          editorState={editorState}
          onToolChange={() => {}}
          onTileTypeChange={() => {}}
          onFurnitureSelect={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      )}
    </div>
  );
}
