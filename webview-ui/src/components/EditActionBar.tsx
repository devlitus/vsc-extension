import React, { useRef } from 'react';
import { postMessage } from '../runtime';

interface EditActionBarProps {
  isEditorOpen: boolean;
  gridWidth: number;
  gridHeight: number;
  floorHue: number;
  floorSat: number;
  floorBri: number;
  wallHue: number;
  wallSat: number;
  wallBri: number;
  onFloorColorChange: (h: number, s: number, b: number) => void;
  onWallColorChange: (h: number, s: number, b: number) => void;
}

const HUE_RANGE = { min: 0, max: 360 };
const SAT_RANGE = { min: 0, max: 100 };
const BRI_RANGE = { min: 0, max: 100 };

const BAR_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  background: 'rgba(0,0,0,0.85)',
  padding: '12px 20px',
  borderRadius: 8,
  zIndex: 100,
};

const SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const LABEL_STYLE: React.CSSProperties = {
  color: '#fff',
  fontSize: 11,
  fontFamily: 'sans-serif',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const SLIDER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const SLIDER_LABEL_STYLE: React.CSSProperties = {
  color: '#888',
  fontSize: 10,
  fontFamily: 'monospace',
  width: 12,
};

const SLIDER_STYLE: React.CSSProperties = {
  width: 80,
  height: 4,
  cursor: 'pointer',
  borderRadius: 2,
};

const VALUE_STYLE: React.CSSProperties = {
  color: '#aaa',
  fontSize: 10,
  fontFamily: 'monospace',
  width: 28,
  textAlign: 'right',
};

const BUTTON_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  background: '#3a3a3a',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'sans-serif',
};

function hslToGradient(h: number, s: number, b: number): string {
  return `linear-gradient(to right, 
    hsl(${h}, 0%, ${b}%), 
    hsl(${h}, 100%, ${b}%))`;
}

function hueGradient(): string {
  return 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
}

function HSBSlider({
  label,
  value,
  min,
  max,
  gradient,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  gradient: string;
  onChange: (value: number) => void;
}) {
  return (
    <div style={SLIDER_ROW_STYLE}>
      <span style={SLIDER_LABEL_STYLE}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          ...SLIDER_STYLE,
          background: gradient,
        }}
      />
      <span style={VALUE_STYLE}>{value}</span>
    </div>
  );
}

function ColorPicker({
  title,
  hue,
  sat,
  bri,
  onChange,
}: {
  title: string;
  hue: number;
  sat: number;
  bri: number;
  onChange: (h: number, s: number, b: number) => void;
}) {
  return (
    <div style={SECTION_STYLE}>
      <span style={LABEL_STYLE}>{title}</span>
      <HSBSlider
        label="H"
        value={hue}
        min={HUE_RANGE.min}
        max={HUE_RANGE.max}
        gradient={hueGradient()}
        onChange={(h) => onChange(h, sat, bri)}
      />
      <HSBSlider
        label="S"
        value={sat}
        min={SAT_RANGE.min}
        max={SAT_RANGE.max}
        gradient={hslToGradient(hue, sat, bri)}
        onChange={(s) => onChange(hue, s, bri)}
      />
      <HSBSlider
        label="B"
        value={bri}
        min={BRI_RANGE.min}
        max={BRI_RANGE.max}
        gradient={hslToGradient(hue, sat, bri)}
        onChange={(b) => onChange(hue, sat, b)}
      />
    </div>
  );
}

export function EditActionBar({
  isEditorOpen,
  gridWidth,
  gridHeight,
  floorHue,
  floorSat,
  floorBri,
  wallHue,
  wallSat,
  wallBri,
  onFloorColorChange,
  onWallColorChange,
}: EditActionBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isEditorOpen) {
    return null;
  }

  const handleExport = () => {
    postMessage({ type: 'exportLayout' });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const layout = JSON.parse(content);
        postMessage({ type: 'importLayout', payload: layout });
      } catch {
        console.error('Failed to parse layout file');
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  };

  return (
    <div style={BAR_STYLE}>
      <ColorPicker
        title="Floor"
        hue={floorHue}
        sat={floorSat}
        bri={floorBri}
        onChange={onFloorColorChange}
      />

      <ColorPicker
        title="Wall"
        hue={wallHue}
        sat={wallSat}
        bri={wallBri}
        onChange={onWallColorChange}
      />

      <div style={SECTION_STYLE}>
        <span style={LABEL_STYLE}>Grid</span>
        <span style={{ ...VALUE_STYLE, width: 'auto', color: '#fff', fontSize: 12 }}>
          {gridWidth}×{gridHeight}
        </span>
      </div>

      <div style={{ ...SECTION_STYLE, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <button style={BUTTON_STYLE} onClick={handleExport}>
          Export
        </button>
        <button style={BUTTON_STYLE} onClick={handleImportClick}>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
