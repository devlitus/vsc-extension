import React from 'react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ZoomControls({ zoom, onZoomIn, onZoomOut }: ZoomControlsProps) {
  const isMinZoom = zoom <= MIN_ZOOM;
  const isMaxZoom = zoom >= MAX_ZOOM;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(0,0,0,0.8)',
      padding: '4px 8px',
      borderRadius: 4,
    }}>
      <button
        onClick={onZoomOut}
        disabled={isMinZoom}
        style={{
          width: 24,
          height: 24,
          padding: 0,
          background: isMinZoom ? '#2a2a2a' : '#3a3a3a',
          color: isMinZoom ? '#666' : '#fff',
          border: 'none',
          borderRadius: 3,
          cursor: isMinZoom ? 'not-allowed' : 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        −
      </button>
      <span style={{
        minWidth: 28,
        textAlign: 'center',
        color: '#fff',
        fontSize: 12,
        fontFamily: 'sans-serif',
      }}>
        {zoom}×
      </span>
      <button
        onClick={onZoomIn}
        disabled={isMaxZoom}
        style={{
          width: 24,
          height: 24,
          padding: 0,
          background: isMaxZoom ? '#2a2a2a' : '#3a3a3a',
          color: isMaxZoom ? '#666' : '#fff',
          border: 'none',
          borderRadius: 3,
          cursor: isMaxZoom ? 'not-allowed' : 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  );
}
