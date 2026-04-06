import React, { useEffect, useRef, useState } from 'react';
import { init, postMessage, onMessage } from './runtime';
import { createOfficeState } from './office/engine/officeState';
import type { OfficeState } from './office/engine/officeState';
import { startGameLoop, enqueueMessage } from './office/engine/gameLoop';
import { createEditorState } from './office/editor/editorState';
import type { EditorState } from './office/editor/editorState';
import { EditorToolbar } from './office/editor/EditorToolbar';
import { InspectionPanel } from './components/InspectionPanel';
import type { InspectionPanelData, SubagentInfo } from './components/InspectionPanel';

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
  const [inspectionPanelOpen, setInspectionPanelOpen] = useState(false);
  const [inspectionAgentId, setInspectionAgentId] = useState<number | null>(null);
  const [inspectionData, setInspectionData] = useState<InspectionPanelData | null>(null);
  
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
      
      if (message.type === 'inspectionData' && typeof message.agentId === 'number') {
        setInspectionData(message as unknown as InspectionPanelData);
        setInspectionAgentId(message.agentId as number);
        setInspectionPanelOpen(true);
        return;
      }
      
      if (message.type === 'agentDisconnected') {
        if (inspectionAgentId === message.agentId) {
          setInspectionPanelOpen(false);
          setInspectionAgentId(null);
          setInspectionData(null);
        }
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
      
      // Check if clicked on a character
      for (const char of officeState.characters.values()) {
        if (char.position.x === x && char.position.y === y) {
          // Open inspection panel for this agent
          setInspectionAgentId(char.id);
          setInspectionPanelOpen(true);
          setInspectionData(null);
          postMessage({ type: 'openInspectionPanel', agentId: char.id });
          return; // Don't process seat selection
        }
      }
      
      // Seat selection logic only if editor mode or shift key
      if (isEditorMode || e.shiftKey) {
        postMessage({ type: 'canvasClick', x, y });
      }
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
  }, [canvasRef, officeState, editorState, inspectionAgentId]);
  
  const handleInterrupt = () => {
    if (inspectionAgentId !== null) {
      postMessage({ type: 'agentAction', agentId: inspectionAgentId, action: 'interrupt' });
    }
  };

  const handleChat = (text: string) => {
    if (inspectionAgentId !== null) {
      postMessage({ type: 'agentChatMessage', agentId: inspectionAgentId, text });
    }
  };

  const handleRedirect = () => {
    if (inspectionAgentId !== null) {
      postMessage({ type: 'agentAction', agentId: inspectionAgentId, action: 'redirect' });
    }
  };

  const handleInspectionClose = () => {
    setInspectionPanelOpen(false);
    setInspectionAgentId(null);
    setInspectionData(null);
  };

  // Compute subagents for the current inspection agent
  const subagentsForInspection: SubagentInfo[] = inspectionAgentId !== null
    ? Array.from(officeState.subagents.values())
        .filter(sa => sa.agentId === inspectionAgentId)
        .map(sa => ({
          agentId: sa.agentId,
          toolId: sa.toolId,
          state: sa.state,
        }))
    : [];

  const breadcrumb = inspectionAgentId !== null ? `Agent #${inspectionAgentId}` : '';
  
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
      <InspectionPanel
        isOpen={inspectionPanelOpen}
        onClose={handleInspectionClose}
        inspectionData={inspectionData}
        onInterrupt={handleInterrupt}
        onChat={handleChat}
        onRedirect={handleRedirect}
        subagents={subagentsForInspection}
        onSubagentClick={(agentId) => {
          setInspectionAgentId(agentId);
          postMessage({ type: 'openInspectionPanel', agentId });
        }}
        breadcrumb={breadcrumb}
      />
    </div>
  );
}
