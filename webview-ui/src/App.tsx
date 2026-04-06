import React, { useEffect, useRef, useState, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { init, postMessage, onMessage } from './runtime';
import { createOfficeState } from './office/engine/officeState';
import type { OfficeState } from './office/engine/officeState';
import { startGameLoop, enqueueMessage } from './office/engine/gameLoop';
import { createEditorState } from './office/editor/editorState';
import type { EditorState } from './office/editor/editorState';
import { EditorToolbar } from './office/editor/EditorToolbar';
import { InspectionPanel } from './components/InspectionPanel';
import type { InspectionPanelData, SubagentInfo } from './components/InspectionPanel';
import { KanbanBoard, draggedKanbanTaskId } from './components/KanbanBoard';
import type { KanbanBoard as KanbanBoardType } from '../../src/kanbanTypes';
import { isSafeKanbanBoard } from '../../src/kanbanPersistence';
import { BottomToolbar } from './components/BottomToolbar';
import { SettingsModal } from './components/SettingsModal';

interface SettingsData {
  soundEnabled: boolean;
  alwaysShowLabels: boolean;
  watchAllSessions: boolean;
  hooksEnabled: boolean;
  autoAssignEnabled: boolean;
  githubRepo: string;
  hasGithubToken: boolean;
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
    autoAssignEnabled: false,
    githubRepo: '',
    hasGithubToken: false,
  });
  const [versionUpgrade, setVersionUpgrade] = useState<{ oldVersion: string; newVersion: string } | null>(null);
  const [inspectionPanelOpen, setInspectionPanelOpen] = useState(false);
  const [inspectionAgentId, setInspectionAgentId] = useState<number | null>(null);
  const [inspectionData, setInspectionData] = useState<InspectionPanelData | null>(null);
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [kanbanBoard, setKanbanBoard] = useState<KanbanBoardType | null>(null);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [agentIdleNotification, setAgentIdleNotification] = useState<{ agentId: number; taskTitle: string } | null>(null);
  const [taskCompleteSuggestion, setTaskCompleteSuggestion] = useState<{ agentId: number; taskId: string; taskTitle: string } | null>(null);
  const [githubSyncStatus, setGithubSyncStatus] = useState<{ result: 'success' | 'error'; message?: string } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  // Sync officeState.zoom with React state
  useEffect(() => {
    officeState.zoom = zoom;
  }, [zoom, officeState]);

  // Refs for values that message handlers need but don't reactively depend on
  const inspectionAgentIdRef = useRef(inspectionAgentId);
  const kanbanBoardRef = useRef(kanbanBoard);
  const autoAssignEnabledRef = useRef(autoAssignEnabled);

  // Keep refs in sync with state
  useEffect(() => {
    inspectionAgentIdRef.current = inspectionAgentId;
  }, [inspectionAgentId]);

  useEffect(() => {
    kanbanBoardRef.current = kanbanBoard;
  }, [kanbanBoard]);

  useEffect(() => {
    autoAssignEnabledRef.current = autoAssignEnabled;
  }, [autoAssignEnabled]);

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
        // Use ref to get current value
        if (inspectionAgentIdRef.current === message.agentId) {
          // Don't close panel; set inspectionData to null to show "Agent disconnected" banner
          setInspectionData(null);
        }
        return;
      }

      if (message.type === 'kanbanLoaded' && typeof message.board === 'object' && isSafeKanbanBoard(message.board)) {
        setKanbanBoard(message.board as KanbanBoardType);
        return;
      }

      if (message.type === 'kanbanUpdated' && typeof message.board === 'object') {
        setKanbanBoard(message.board as KanbanBoardType);
        return;
      }

      if (message.type === 'kanbanTaskAssigned' && typeof message.agentId === 'number' && typeof message.taskTitle === 'string') {
        // Pass to game loop to show speech bubble
        enqueueMessage(message);
        return;
      }

      if (message.type === 'agentIdle' && typeof message.agentId === 'number') {
        // Find first unassigned task in backlog - use refs to get current values
        const currentKanbanBoard = kanbanBoardRef.current;
        const currentAutoAssignEnabled = autoAssignEnabledRef.current;
        if (currentKanbanBoard && currentAutoAssignEnabled) {
          const backlogTask = currentKanbanBoard.tasks.find(t => t.status === 'backlog' && !t.assignedAgentId);
          if (backlogTask) {
            unstable_batchedUpdates(() => {
              setAgentIdleNotification({ agentId: message.agentId as number, taskTitle: backlogTask.title });
            });
          }
        }
        return;
      }

      if (message.type === 'taskMaybeComplete' && typeof message.agentId === 'number' && typeof message.taskId === 'string') {
        // Use ref to get current value
        const currentKanbanBoard = kanbanBoardRef.current;
        if (currentKanbanBoard) {
          const task = currentKanbanBoard.tasks.find(t => t.id === message.taskId);
          if (task) {
            unstable_batchedUpdates(() => {
              setTaskCompleteSuggestion({ agentId: message.agentId as number, taskId: message.taskId as string, taskTitle: task.title });
            });
          }
        }
        return;
      }

      if (message.type === 'githubSync' && typeof message.result === 'string') {
        setGithubSyncStatus({ result: message.result as 'success' | 'error', message: message.message as string | undefined });
        setTimeout(() => setGithubSyncStatus(null), 3000);
        return;
      }

      if (message.type === 'assetsLoaded') {
        const manifest = message.manifest as { tilesetUri?: string } | null;
        if (manifest?.tilesetUri) {
          enqueueMessage({ type: 'tilesetReady', uri: manifest.tilesetUri });
        }
        return;
      }

      // Pass all other messages to the game loop
      enqueueMessage(msg);
    };

    const disposeMessage = onMessage(handleMessage);

    // Request initial settings
    postMessage({ type: 'settingsLoaded' });

    // Mouse events
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (16 * zoom));
      const y = Math.floor((e.clientY - rect.top) / (16 * zoom));

      // Check if clicked on a character
      for (const char of officeState.characters.values()) {
        if (char.position.x === x && char.position.y === y) {
          // Check if a kanban task is being dragged onto this character
          if (typeof draggedKanbanTaskId === 'string' && draggedKanbanTaskId) {
            const taskId = draggedKanbanTaskId;
            // Note: Can't null out the imported var, but we can proceed with the assignment
            // The drag state will reset when drag ends naturally
            // Confirm assignment
            const task = kanbanBoard?.tasks.find(t => t.id === taskId);
            if (task && confirm(`Send this task to Agent #${char.id}?\n\n"${task.title}"`)) {
              handleTaskAssign(taskId, char.id);
            }
            return;
          }
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
      setZoom(z => Math.max(1, Math.min(4, z + delta * 0.1)));
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      stop();
      disposeMessage();
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleKanbanBoardChange = (newBoard: KanbanBoardType) => {
    setKanbanBoard(newBoard);
    postMessage({ type: 'kanbanUpdate', board: newBoard });
  };

  const handleTaskAssign = (taskId: string, agentId: number) => {
    if (!kanbanBoard) return;
    const task = kanbanBoard.tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedTasks = kanbanBoard.tasks.map(t => 
      t.id === taskId ? { ...t, assignedAgentId: agentId, status: 'in-progress' as const, updatedAt: Date.now() } : t
    );
    const newBoard = { ...kanbanBoard, tasks: updatedTasks };
    handleKanbanBoardChange(newBoard);
    const promptText = task.description
      ? `New task: ${task.title}\nDescription: ${task.description}`
      : `New task: ${task.title}`;
    const truncated = promptText.length > 500 ? promptText.slice(0, 497) + '...' : promptText;
    postMessage({ type: 'agentChatMessage', agentId, text: truncated });
  };

  const handleGithubSync = () => {
    postMessage({ type: 'githubSync' });
  };

  const handleIdleAssignYes = () => {
    if (agentIdleNotification && kanbanBoard) {
      const task = kanbanBoard.tasks.find(t => t.status === 'backlog' && !t.assignedAgentId);
      if (task) {
        const agentId = agentIdleNotification.agentId;
        handleTaskAssign(task.id, agentId);
      }
    }
    setAgentIdleNotification(null);
  };

  const handleTaskCompleteMove = () => {
    if (taskCompleteSuggestion && kanbanBoard) {
      const updatedTasks = kanbanBoard.tasks.map(t =>
        t.id === taskCompleteSuggestion.taskId
          ? { ...t, status: 'done' as const, assignedAgentId: undefined, updatedAt: Date.now() }
          : t
      );
      const newBoard = { ...kanbanBoard, tasks: updatedTasks };
      handleKanbanBoardChange(newBoard);
    }
    setTaskCompleteSuggestion(null);
  };

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

  // Toolbar handlers
  const handleZoomIn = () => setZoom(z => Math.min(4, z + 1));
  const handleZoomOut = () => setZoom(z => Math.max(1, z - 1));
  const handleToggleEditor = () => setIsEditorOpen(e => !e);
  const handleOpenSettings = () => setSettingsModalOpen(true);
  const handleOpenChangelog = () => setChangelogOpen(true);
  const handleToggleKanban = () => setKanbanOpen(k => !k);

  // Settings modal handlers
  const handleToggleSound = (v: boolean) => setSettings(s => ({ ...s, soundEnabled: v }));
  const handleToggleLabels = (v: boolean) => setSettings(s => ({ ...s, alwaysShowLabels: v }));
  const handleToggleWatchAll = (v: boolean) => setSettings(s => ({ ...s, watchAllSessions: v }));
  const handleToggleHooks = (v: boolean) => setSettings(s => ({ ...s, hooksEnabled: v }));
  const handleToggleAutoAssign = (v: boolean) => {
    setAutoAssignEnabled(v);
    setSettings(s => ({ ...s, autoAssignEnabled: v }));
  };
  const handleGithubRepoChange = (v: string) => setSettings(s => ({ ...s, githubRepo: v }));
  const handleGithubTokenChange = (v: string) => postMessage({ type: 'setGithubToken', value: v });
  const handleAddAssetDir = () => postMessage({ type: 'addAssetDirectory' });

  // Compute subagents for the current inspection agent
  const subagentsForInspection = useMemo(() => {
    if (!inspectionAgentId) return [];
    return Array.from(officeState.subagents.values()).filter(
      s => s.linkedToParentId === inspectionAgentId
    ).map(sa => ({
      agentId: sa.agentId,
      toolId: sa.toolId,
      state: sa.state,
    }));
  }, [officeState.subagents, inspectionAgentId]);

  const breadcrumb = inspectionAgentId !== null ? `Agent #${inspectionAgentId}` : '';
  
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Canvas - left half when kanban open */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: kanbanOpen ? '50%' : '100%',
        height: '100%',
      }}>
        <canvas
          ref={canvasRef}
          id="office-canvas"
          width={800}
          height={600}
          style={{ width: '100%', height: '100%', display: 'block', cursor: isEditorMode ? 'crosshair' : 'default' }}
        />
      </div>
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
      {kanbanOpen && kanbanBoard && (
        <KanbanBoard
          board={kanbanBoard}
          characters={officeState.characters}
          isOpen={kanbanOpen}
          onClose={() => setKanbanOpen(false)}
          onBoardChange={handleKanbanBoardChange}
          onTaskAssign={handleTaskAssign}
          onGithubSync={handleGithubSync}
          autoAssignEnabled={autoAssignEnabled}
        />
      )}
      {agentIdleNotification && (
        <div style={{
          position: 'fixed',
          top: 60,
          right: 16,
          background: '#2a2a2a',
          border: '1px solid #4a9eff',
          borderRadius: 8,
          padding: '12px 16px',
          zIndex: 1001,
          maxWidth: 300,
        }}>
          <div style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>
            Agent #{agentIdleNotification.agentId} is free. Assign "{agentIdleNotification.taskTitle}"?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleIdleAssignYes} style={{ padding: '4px 12px', background: '#4a9eff', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Yes</button>
            <button onClick={() => setAgentIdleNotification(null)} style={{ padding: '4px 12px', background: '#3a3a3a', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>No</button>
          </div>
        </div>
      )}
      {taskCompleteSuggestion && (
        <div style={{
          position: 'fixed',
          top: 60,
          right: 16,
          background: '#2a2a2a',
          border: '1px solid #6bcb77',
          borderRadius: 8,
          padding: '12px 16px',
          zIndex: 1001,
          maxWidth: 300,
        }}>
          <div style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>
            Did Agent #{taskCompleteSuggestion.agentId} complete "{taskCompleteSuggestion.taskTitle}"?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleTaskCompleteMove} style={{ padding: '4px 12px', background: '#6bcb77', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Move to Done</button>
            <button onClick={() => setTaskCompleteSuggestion(null)} style={{ padding: '4px 12px', background: '#3a3a3a', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Ignore</button>
          </div>
        </div>
      )}
      {settingsModalOpen && (
        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          soundEnabled={settings.soundEnabled}
          alwaysShowLabels={settings.alwaysShowLabels}
          watchAllSessions={settings.watchAllSessions}
          hooksEnabled={settings.hooksEnabled}
          debugViewEnabled={false}
          externalAssetDirs={[]}
          serverPort={null}
          autoAssignEnabled={autoAssignEnabled}
          githubRepo={settings.githubRepo}
          hasGithubToken={settings.hasGithubToken}
          onToggleSound={handleToggleSound}
          onToggleLabels={handleToggleLabels}
          onToggleWatchAll={handleToggleWatchAll}
          onToggleHooks={handleToggleHooks}
          onToggleDebugView={() => {}}
          onAddAssetDir={handleAddAssetDir}
          onRemoveAssetDir={() => {}}
          onToggleAutoAssign={handleToggleAutoAssign}
          onGithubRepoChange={handleGithubRepoChange}
          onGithubTokenChange={handleGithubTokenChange}
        />
      )}
      <BottomToolbar
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        isEditorOpen={isEditorOpen}
        onToggleEditor={handleToggleEditor}
        onOpenSettings={handleOpenSettings}
        onOpenChangelog={handleOpenChangelog}
        isKanbanOpen={kanbanOpen}
        onToggleKanban={handleToggleKanban}
        lastSeenVersion={versionUpgrade?.newVersion || null}
      />
    </div>
  );
}
