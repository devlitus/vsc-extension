import React from 'react';
import type { DebugAgentInfo } from './types';

interface DebugViewProps {
  agents: DebugAgentInfo[];
}

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 280,
  maxHeight: 'calc(100vh - 16px)',
  overflowY: 'auto',
  background: 'rgba(20, 20, 30, 0.92)',
  borderRadius: 8,
  padding: 12,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
  color: '#e0e0e0',
  zIndex: 1000,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  paddingBottom: 8,
};

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 6,
  padding: 10,
  marginBottom: 8,
};

const CARD_LAST_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  marginBottom: 0,
};

const LABEL_STYLE: React.CSSProperties = {
  color: '#888',
  marginRight: 6,
};

const VALUE_STYLE: React.CSSProperties = {
  color: '#fff',
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  marginBottom: 4,
  alignItems: 'center',
};

const ROW_LAST_CHILD_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  marginBottom: 0,
};

const STATUS_FOUND_STYLE: React.CSSProperties = {
  color: '#4ade80',
  fontWeight: 500,
};

const STATUS_NOT_FOUND_STYLE: React.CSSProperties = {
  color: '#f87171',
  fontWeight: 500,
};

const INDICATOR_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  marginRight: 6,
};

const TAG_STYLE: React.CSSProperties = {
  background: 'rgba(120, 119, 198, 0.3)',
  color: '#a5b4fc',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 500,
  marginLeft: 6,
};

const AGENT_ID_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: '#fbbf24',
  marginRight: 8,
};

function getRelativeTime(timestamp: number): string {
  if (timestamp === 0) return 'never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getBasename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function truncateSessionId(sessionId: string): string {
  if (sessionId.length <= 8) return sessionId;
  return sessionId.slice(0, 8) + '...';
}

function DebugAgentCard({ agent, isLast }: { agent: DebugAgentInfo; isLast: boolean }) {
  const cardStyle = isLast ? CARD_LAST_STYLE : CARD_STYLE;
  const jsonlBasename = getBasename(agent.jsonlFile);
  const relativeTime = getRelativeTime(agent.lastDataAt);
  const truncatedSessionId = truncateSessionId(agent.sessionId);

  return (
    <div style={cardStyle}>
      <div style={ROW_STYLE}>
        <span style={AGENT_ID_STYLE}>Agent {agent.id}</span>
        {agent.isExternal && <span style={TAG_STYLE}>external</span>}
      </div>

      <div style={ROW_LAST_CHILD_STYLE}>
        <span style={LABEL_STYLE}>sessionId:</span>
        <span style={VALUE_STYLE}>{truncatedSessionId}</span>
      </div>

      <div style={ROW_STYLE}>
        <span style={LABEL_STYLE}>jsonlFile:</span>
        <span style={VALUE_STYLE}>{jsonlBasename}</span>
      </div>

      <div style={ROW_STYLE}>
        <span style={LABEL_STYLE}>status:</span>
        <span style={jsonlBasename ? STATUS_FOUND_STYLE : STATUS_NOT_FOUND_STYLE}>
          {jsonlBasename ? 'JSONL found' : 'JSONL not found'}
        </span>
      </div>

      <div style={ROW_STYLE}>
        <span style={LABEL_STYLE}>lines:</span>
        <span style={VALUE_STYLE}>{agent.linesProcessed}</span>
      </div>

      <div style={ROW_STYLE}>
        <span style={LABEL_STYLE}>lastData:</span>
        <span style={VALUE_STYLE}>{relativeTime}</span>
      </div>

      <div style={ROW_LAST_CHILD_STYLE}>
        <span style={LABEL_STYLE}>hook:</span>
        <span
          style={{
            ...INDICATOR_STYLE,
            background: agent.hookDelivered ? '#4ade80' : '#f87171',
          }}
        />
        <span style={VALUE_STYLE}>{agent.hookDelivered ? 'delivered' : 'pending'}</span>
      </div>
    </div>
  );
}

export function DebugView({ agents }: DebugViewProps) {
  if (agents.length === 0) {
    return (
      <div style={OVERLAY_STYLE}>
        <h3 style={TITLE_STYLE}>Debug View</h3>
        <div style={{ color: '#888', textAlign: 'center', padding: '8px 0' }}>No agents</div>
      </div>
    );
  }

  return (
    <div style={OVERLAY_STYLE}>
      <h3 style={TITLE_STYLE}>Debug View</h3>
      {agents.map((agent, index) => (
        <DebugAgentCard
          key={agent.id}
          agent={agent}
          isLast={index === agents.length - 1}
        />
      ))}
    </div>
  );
}
