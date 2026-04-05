import React from 'react';

declare const EXTENSION_VERSION: string;

interface VersionIndicatorProps {
  onOpenChangelog: () => void;
  lastSeenVersion: string | null;
  inline?: boolean;
}

export function VersionIndicator({ onOpenChangelog, lastSeenVersion, inline = false }: VersionIndicatorProps) {
  const hasUpdate = lastSeenVersion !== null && lastSeenVersion !== EXTENSION_VERSION;

  const containerStyle: React.CSSProperties = inline
    ? {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }
    : {
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 100,
      };

  const badgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(0, 0, 0, 0.75)',
    padding: '3px 8px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'sans-serif',
    color: '#aaa',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'background 0.15s ease, color 0.15s ease',
  };

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#3b82f6',
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      <div
        style={badgeStyle}
        onClick={onOpenChangelog}
        role="button"
        aria-label={`Version ${EXTENSION_VERSION}. Click to view changelog.`}
        title="Click to view changelog"
      >
        {hasUpdate && <span style={dotStyle} />}
        <span>v{EXTENSION_VERSION}</span>
      </div>
    </div>
  );
}
