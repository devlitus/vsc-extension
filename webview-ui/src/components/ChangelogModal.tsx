import React, { useEffect } from 'react';
import { CHANGELOG } from '../changelogData';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
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
          maxWidth: 520,
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
            Changelog
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

        {/* Changelog entries */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {CHANGELOG.map((entry: ChangelogEntry, index: number) => (
            <div
              key={entry.version}
              style={{
                marginBottom: index < CHANGELOG.length - 1 ? 20 : 0,
                padding: '12px',
                borderRadius: 6,
                background: index === 0 ? 'rgba(100, 150, 255, 0.1)' : 'transparent',
                border: index === 0 ? '1px solid rgba(100, 150, 255, 0.3)' : '1px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: index === 0 ? '#6eb3ff' : '#fff',
                    fontFamily: 'sans-serif',
                  }}
                >
                  v{entry.version}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: '#888',
                    fontFamily: 'sans-serif',
                  }}
                >
                  {entry.date}
                </span>
                {index === 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#1e1e1e',
                      background: '#6eb3ff',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    CURRENT
                  </span>
                )}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  color: '#ccc',
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: 'sans-serif',
                }}
              >
                {entry.changes.map((change: string, changeIndex: number) => (
                  <li key={changeIndex} style={{ marginBottom: 4 }}>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
