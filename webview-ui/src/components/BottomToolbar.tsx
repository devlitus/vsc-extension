import React, { useState, useRef, useEffect } from 'react';
import { postMessage } from '../runtime';
import { ZoomControls } from './ZoomControls';
import { VersionIndicator } from './VersionIndicator';

export interface BottomToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isEditorOpen: boolean;
  onToggleEditor: () => void;
  isKanbanOpen: boolean;
  onToggleKanban: () => void;
  onOpenSettings: () => void;
  onOpenChangelog: () => void;
  lastSeenVersion: string | null;
}

export function BottomToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  isEditorOpen,
  onToggleEditor,
  isKanbanOpen,
  onToggleKanban,
  onOpenSettings,
  onOpenChangelog,
  lastSeenVersion,
}: BottomToolbarProps) {
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuVisible(false);
      }
    }

    if (contextMenuVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenuVisible]);

  const handleLaunchAgent = (bypassPermissions: boolean) => {
    postMessage({ type: 'launchAgent', bypassPermissions });
    setContextMenuVisible(false);
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuVisible(true);
  };

  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'rgba(30, 30, 30, 0.9)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const leftSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const rightSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'sans-serif',
    transition: 'background 0.15s',
  };

  const agentButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    background: '#4a9eff',
    color: '#fff',
  };

  const layoutButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    background: isEditorOpen ? '#4a4a4a' : '#3a3a3a',
    color: '#fff',
  };

  const gearButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    background: 'transparent',
    color: '#888',
    padding: 6,
    fontSize: 16,
  };

  const contextMenuStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 4,
    background: '#2a2a2a',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
    padding: 4,
    minWidth: 180,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
  };

  const contextMenuItemStyle: React.CSSProperties = {
    padding: '8px 12px',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'sans-serif',
    cursor: 'pointer',
    borderRadius: 4,
  };

  return (
    <div style={toolbarStyle}>
      <div style={leftSectionStyle}>
        <div style={{ position: 'relative' }}>
          <button
            style={agentButtonStyle}
            onClick={() => handleLaunchAgent(false)}
            onContextMenu={handleContextMenu}
            title="Add a new agent (right-click for options)"
          >
            + Agent
          </button>
          {contextMenuVisible && (
            <div ref={contextMenuRef} style={contextMenuStyle}>
              <div
                style={contextMenuItemStyle}
                onClick={() => handleLaunchAgent(true)}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a3a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Launch (skip permissions)
              </div>
            </div>
          )}
        </div>

        <button
          style={layoutButtonStyle}
          onClick={onToggleEditor}
          title={isEditorOpen ? 'Close layout editor' : 'Open layout editor'}
        >
          {isEditorOpen ? '✓ Layout' : 'Layout'}
        </button>

        <button
          style={{
            ...buttonBaseStyle,
            background: isKanbanOpen ? '#4a4a4a' : '#3a3a3a',
            color: '#fff',
          }}
          onClick={onToggleKanban}
          title={isKanbanOpen ? 'Close Kanban board' : 'Open Kanban board'}
        >
          {isKanbanOpen ? '✓ Board' : 'Board'}
        </button>
      </div>

      <div style={rightSectionStyle}>
        <ZoomControls zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />

        <button
          style={gearButtonStyle}
          onClick={onOpenSettings}
          title="Settings"
        >
          ⚙
        </button>

        <VersionIndicator lastSeenVersion={lastSeenVersion} onOpenChangelog={onOpenChangelog} inline />
      </div>
    </div>
  );
}