import React, { useEffect } from 'react';
import { postMessage } from '../runtime';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  alwaysShowLabels: boolean;
  watchAllSessions: boolean;
  hooksEnabled: boolean;
  debugViewEnabled: boolean;
  externalAssetDirs: string[];
  serverPort: number | null;
  onToggleSound: (v: boolean) => void;
  onToggleLabels: (v: boolean) => void;
  onToggleWatchAll: (v: boolean) => void;
  onToggleHooks: (v: boolean) => void;
  onToggleDebugView: (v: boolean) => void;
  onAddAssetDir: () => void;
  onRemoveAssetDir: (dir: string) => void;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid #2a2a2a',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            color: '#fff',
            fontFamily: 'sans-serif',
            marginBottom: description ? 2 : 0,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: 12,
              color: '#888',
              fontFamily: 'sans-serif',
            }}
          >
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          padding: 2,
          background: checked ? '#4a9eff' : '#3a3a3a',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          transition: 'background 0.2s',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </button>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  soundEnabled,
  alwaysShowLabels,
  watchAllSessions,
  hooksEnabled,
  debugViewEnabled,
  externalAssetDirs,
  serverPort,
  onToggleSound,
  onToggleLabels,
  onToggleWatchAll,
  onToggleHooks,
  onToggleDebugView,
  onAddAssetDir,
  onRemoveAssetDir,
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleToggleSound = (value: boolean) => {
    onToggleSound(value);
    postMessage({ type: 'setSetting', key: 'soundEnabled', value });
  };

  const handleToggleLabels = (value: boolean) => {
    onToggleLabels(value);
    postMessage({ type: 'setSetting', key: 'alwaysShowLabels', value });
  };

  const handleToggleWatchAll = (value: boolean) => {
    onToggleWatchAll(value);
    postMessage({ type: 'setSetting', key: 'watchAllSessions', value });
  };

  const handleToggleHooks = (value: boolean) => {
    onToggleHooks(value);
    postMessage({ type: 'setHooksEnabled', enabled: value });
  };

  const handleToggleDebugView = (value: boolean) => {
    onToggleDebugView(value);
  };

  const handleExportDefaultLayout = () => {
    postMessage({ type: 'exportDefaultLayout' });
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#1e1e1e',
          border: '1px solid #3a3a3a',
          borderRadius: 8,
          maxWidth: 480,
          maxHeight: '80vh',
          width: '90%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #3a3a3a',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              fontFamily: 'sans-serif',
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#888',
              fontSize: 18,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3a3a3a';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#888';
            }}
          >
            ✕
          </button>
        </div>

        {/* Settings content */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Notifications section */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                fontFamily: 'sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              Notifications
            </div>
            <Toggle
              checked={soundEnabled}
              onChange={handleToggleSound}
              label="Sound notifications"
            />
          </div>

          {/* Display section */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                fontFamily: 'sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              Display
            </div>
            <Toggle
              checked={alwaysShowLabels}
              onChange={handleToggleLabels}
              label="Always show labels"
            />
            <Toggle
              checked={debugViewEnabled}
              onChange={handleToggleDebugView}
              label="Debug View"
              description="Show debug information overlay"
            />
          </div>

          {/* Sessions section */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                fontFamily: 'sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              Sessions
            </div>
            <Toggle
              checked={watchAllSessions}
              onChange={handleToggleWatchAll}
              label="Watch all sessions"
              description="Monitor all Claude Code sessions instead of just this workspace"
            />
          </div>

          {/* Hooks section */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                fontFamily: 'sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              Integration
            </div>
            <Toggle
              checked={hooksEnabled}
              onChange={handleToggleHooks}
              label="Hooks enabled"
              description="Install Claude Code hooks for enhanced tracking"
            />
          </div>

          {/* Asset directories section */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                fontFamily: 'sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              External Asset Directories
            </div>
            {externalAssetDirs.length > 0 ? (
              <div
                style={{
                  marginBottom: 8,
                  maxHeight: 120,
                  overflowY: 'auto',
                  border: '1px solid #2a2a2a',
                  borderRadius: 4,
                }}
              >
                {externalAssetDirs.map((dir) => (
                  <div
                    key={dir}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderBottom: '1px solid #2a2a2a',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: '#ccc',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {dir}
                    </span>
                    <button
                      onClick={() => onRemoveAssetDir(dir)}
                      style={{
                        width: 20,
                        height: 20,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 3,
                        cursor: 'pointer',
                        color: '#888',
                        fontSize: 14,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#5a2020';
                        e.currentTarget.style.color = '#ff6b6b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#888';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  fontFamily: 'sans-serif',
                  fontStyle: 'italic',
                  padding: '8px 0',
                }}
              >
                No external directories added
              </div>
            )}
            <button
              onClick={onAddAssetDir}
              style={{
                padding: '8px 12px',
                background: '#2a4a2a',
                border: '1px solid #3a6a3a',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#8f8',
                fontSize: 13,
                fontFamily: 'sans-serif',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3a5a3a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2a4a2a';
              }}
            >
              Add Asset Directory
            </button>
          </div>

          {/* Layout export section */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleExportDefaultLayout}
              style={{
                padding: '8px 12px',
                background: '#2a3a5a',
                border: '1px solid #3a5a8a',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#8ab4ff',
                fontSize: 13,
                fontFamily: 'sans-serif',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3a4a6a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2a3a5a';
              }}
            >
              Export layout as default
            </button>
          </div>
        </div>

        {/* Footer with server info */}
        {serverPort !== null && (
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid #3a3a3a',
              background: '#181818',
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: '#666',
                fontFamily: 'sans-serif',
              }}
            >
              Hook server active on port{' '}
              <span
                style={{
                  color: '#4a9eff',
                  fontFamily: 'monospace',
                }}
              >
                {serverPort}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
