import React, { useState, useEffect } from 'react';

export interface InspectionPanelData {
  agentId: number;
  model?: string;
  cwd: string;
  branch?: string | null;
  systemPrompt?: string;
  contextUsed: number;
  contextMax: number;
  rateLimit: boolean;
  currentTurnDuration: number;
  toolsThisTurn: Array<{ name: string; count: number }>;
  turnHistory: TurnSummary[];
}

export interface TurnSummary {
  startedAt: number;
  endedAt: number;
  toolsUsed: Array<{ name: string; count: number }>;
  tokensUsed: number;
}

export interface SubagentInfo {
  agentId: number;
  toolId: string;
  state: 'idle' | 'animating';
}

export interface InspectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionData: InspectionPanelData | null;
  onInterrupt: () => void;
  onChat: (text: string) => void;
  onRedirect: () => void;
  subagents: SubagentInfo[];
  onSubagentClick: (agentId: number) => void;
  breadcrumb: string;
}

const PANEL_WIDTH = 280;
const DISCONNECTED_BANNER_HEIGHT = 32;

export function InspectionPanel({
  isOpen,
  onClose,
  inspectionData,
  onInterrupt,
  onChat,
  onRedirect,
  subagents,
  onSubagentClick,
  breadcrumb,
}: InspectionPanelProps) {
  const [systemPromptExpanded, setSystemPromptExpanded] = useState(false);
  const [showChatInput, setShowChatInput] = useState(false);
  const [chatText, setChatText] = useState('');
  const [showInterruptConfirm, setShowInterruptConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowChatInput(false);
      setChatText('');
      setShowInterruptConfirm(false);
    }
  }, [isOpen]);

  const handleCopyCwds = () => {
    if (inspectionData?.cwd) {
      navigator.clipboard.writeText(inspectionData.cwd).catch(() => {});
    }
  };

  const handleSendChat = () => {
    if (chatText.trim()) {
      onChat(chatText.trim());
      setChatText('');
      setShowChatInput(false);
    }
  };

  const handleInterruptClick = () => {
    if (showInterruptConfirm) {
      onInterrupt();
      setShowInterruptConfirm(false);
    } else {
      setShowInterruptConfirm(true);
      setTimeout(() => setShowInterruptConfirm(false), 3000);
    }
  };

  if (!isOpen) return null;

  const agentName = inspectionData?.model ? `Agent ${inspectionData.agentId}` : 'Loading...';
  const agentRole = 'Main Agent';
  const agentModel = inspectionData?.model || null;

  const isActive = inspectionData && inspectionData.currentTurnDuration >= 0;
  const contextPercent = inspectionData && inspectionData.contextMax > 0
    ? Math.round((inspectionData.contextUsed / inspectionData.contextMax) * 100)
    : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: PANEL_WIDTH,
        height: '100%',
        background: '#1e1e1e',
        borderLeft: '1px solid #3a3a3a',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.3)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid #3a3a3a',
          minHeight: 44,
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              fontFamily: 'sans-serif',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agentName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#888',
              fontFamily: 'sans-serif',
            }}
          >
            {agentRole}
            {agentModel && ` • ${agentModel}`}
          </div>
        </div>
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
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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

      {/* Disconnected Banner */}
      {!inspectionData && (
        <div
          style={{
            background: '#5a2a2a',
            borderBottom: '1px solid #7a3a3a',
            padding: '6px 12px',
            textAlign: 'center',
            fontSize: 12,
            color: '#ff8a8a',
            fontFamily: 'sans-serif',
            fontWeight: 500,
            height: DISCONNECTED_BANNER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Agent disconnected
        </div>
      )}

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
        }}
      >
        {/* Breadcrumb */}
        {breadcrumb && (
          <div
            style={{
              fontSize: 11,
              color: '#6a9fff',
              fontFamily: 'sans-serif',
              marginBottom: 12,
              padding: '4px 8px',
              background: '#2a3a5a',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {breadcrumb}
          </div>
        )}

        {/* Current State Section */}
        <Section title="Current state">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isActive ? '#4ade80' : '#666',
                boxShadow: isActive ? '0 0 8px #4ade80' : 'none',
                animation: isActive ? 'pulse 1.5s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: 13, color: '#ccc', fontFamily: 'sans-serif' }}>
              {isActive ? 'Active' : 'Idle'}
            </span>
          </div>
          {inspectionData && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#888', fontFamily: 'sans-serif' }}>
              Turn duration: {(inspectionData.currentTurnDuration / 1000).toFixed(1)}s
            </div>
          )}
        </Section>

        {/* Context Section */}
        {inspectionData && (
          <Section title="Context">
            <div style={{ marginBottom: 6 }}>
              <div
                style={{
                  height: 8,
                  background: '#2a2a2a',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${contextPercent}%`,
                    height: '100%',
                    background: contextPercent > 80 ? '#ff6b6b' : '#4a9eff',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#888', fontFamily: 'sans-serif' }}>
              {inspectionData.contextUsed.toLocaleString()} / {inspectionData.contextMax.toLocaleString()} tokens ({contextPercent}%)
            </div>
          </Section>
        )}

        {/* Rate Limit Section */}
        {inspectionData && (
          <Section title="Rate limit">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: inspectionData.rateLimit ? '#ff6b6b' : '#4ade80',
                }}
              />
              <span style={{ fontSize: 13, color: '#ccc', fontFamily: 'sans-serif' }}>
                {inspectionData.rateLimit ? 'Rate limited' : 'Available'}
              </span>
            </div>
          </Section>
        )}

        {/* Tools This Turn Section */}
        {inspectionData && inspectionData.toolsThisTurn.length > 0 && (
          <Section title="Tools this turn">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {inspectionData.toolsThisTurn.map((tool) => (
                <span
                  key={tool.name}
                  style={{
                    fontSize: 12,
                    color: '#ccc',
                    fontFamily: 'sans-serif',
                    background: '#2a2a2a',
                    padding: '3px 8px',
                    borderRadius: 4,
                  }}
                >
                  {tool.name} ×{tool.count}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Directory Section */}
        {inspectionData && (
          <Section title="Directory">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  color: '#ccc',
                  fontFamily: 'monospace',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {inspectionData.cwd}
              </span>
              <button
                onClick={handleCopyCwds}
                style={{
                  width: 24,
                  height: 24,
                  padding: 0,
                  background: '#2a2a2a',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: '#888',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#3a3a3a';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#2a2a2a';
                  e.currentTarget.style.color = '#888';
                }}
                title="Copy path"
              >
                📋
              </button>
            </div>
          </Section>
        )}

        {/* System Prompt Section */}
        {inspectionData && inspectionData.systemPrompt && (
          <Section title="System prompt">
            <div
              onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
              style={{
                fontSize: 12,
                color: '#aaa',
                fontFamily: 'monospace',
                background: '#252525',
                padding: '8px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                whiteSpace: systemPromptExpanded ? 'pre-wrap' : 'nowrap',
                overflow: 'hidden',
                textOverflow: systemPromptExpanded ? 'visible' : 'ellipsis',
                maxHeight: systemPromptExpanded ? 'none' : '40px',
                lineHeight: 1.4,
              }}
            >
              {systemPromptExpanded
                ? inspectionData.systemPrompt
                : inspectionData.systemPrompt.slice(0, 100) + (inspectionData.systemPrompt.length > 100 ? '...' : '')}
            </div>
            {inspectionData.systemPrompt.length > 100 && (
              <div
                style={{
                  fontSize: 11,
                  color: '#6a9fff',
                  fontFamily: 'sans-serif',
                  marginTop: 4,
                  cursor: 'pointer',
                }}
                onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
              >
                {systemPromptExpanded ? 'Show less' : 'Show more'}
              </div>
            )}
          </Section>
        )}

        {/* Turn History Section */}
        {inspectionData && inspectionData.turnHistory.length > 0 && (
          <Section title="Turn history">
            {inspectionData.turnHistory.slice(-5).map((turn, index) => {
              const duration = turn.endedAt > turn.startedAt
                ? Math.round((turn.endedAt - turn.startedAt) / 1000)
                : 0;
              const toolsStr = turn.toolsUsed.map((t) => `${t.name}×${t.count}`).join(' ');
              return (
                <div
                  key={index}
                  style={{
                    padding: '6px 0',
                    borderBottom: index < inspectionData.turnHistory.slice(-5).length - 1 ? '1px solid #2a2a2a' : 'none',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#888', fontFamily: 'sans-serif' }}>
                    Turn {inspectionData.turnHistory.length - 5 + index + 1}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', fontFamily: 'sans-serif', marginTop: 2 }}>
                    {duration}s • {turn.tokensUsed.toLocaleString()} tokens
                  </div>
                  {toolsStr && (
                    <div
                      style={{
                        fontSize: 10,
                        color: '#555',
                        fontFamily: 'sans-serif',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {toolsStr}
                    </div>
                  )}
                </div>
              );
            })}
          </Section>
        )}

        {/* Active Sub-agents Section */}
        {subagents.length > 0 && (
          <Section title="Active sub-agents">
            {subagents.map((subagent) => (
              <div
                key={subagent.agentId}
                onClick={() => onSubagentClick(subagent.agentId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  marginBottom: 4,
                  background: '#252525',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2a3a5a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#252525';
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: subagent.state === 'animating' ? '#4ade80' : '#666',
                    boxShadow: subagent.state === 'animating' ? '0 0 6px #4ade80' : 'none',
                    animation: subagent.state === 'animating' ? 'pulse 1.5s infinite' : 'none',
                  }}
                />
                <span style={{ fontSize: 12, color: '#ccc', fontFamily: 'sans-serif' }}>
                  Sub-agent #{subagent.agentId}
                </span>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #3a3a3a',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handleInterruptClick}
          style={{
            flex: 1,
            minWidth: '60px',
            padding: '8px 12px',
            background: showInterruptConfirm ? '#8a3030' : '#3a2a2a',
            border: '1px solid #5a3a3a',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#ff8a8a',
            fontSize: 12,
            fontFamily: 'sans-serif',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            if (!showInterruptConfirm) {
              e.currentTarget.style.background = '#4a3535';
            }
          }}
          onMouseLeave={(e) => {
            if (!showInterruptConfirm) {
              e.currentTarget.style.background = '#3a2a2a';
            }
          }}
        >
          {showInterruptConfirm ? 'Confirm?' : 'Interrupt'}
        </button>
        <button
          onClick={() => setShowChatInput(!showChatInput)}
          style={{
            flex: 1,
            minWidth: '60px',
            padding: '8px 12px',
            background: showChatInput ? '#2a4a3a' : '#2a3a2a',
            border: '1px solid #3a5a3a',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#8f8',
            fontSize: 12,
            fontFamily: 'sans-serif',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            if (!showChatInput) {
              e.currentTarget.style.background = '#354535';
            }
          }}
          onMouseLeave={(e) => {
            if (!showChatInput) {
              e.currentTarget.style.background = '#2a3a2a';
            }
          }}
        >
          Chat
        </button>
        <button
          onClick={onRedirect}
          style={{
            flex: 1,
            minWidth: '60px',
            padding: '8px 12px',
            background: '#2a3a5a',
            border: '1px solid #3a5a8a',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#8ab4ff',
            fontSize: 12,
            fontFamily: 'sans-serif',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#354565';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2a3a5a';
          }}
        >
          Redirect
        </button>
      </div>

      {/* Inline Chat Panel */}
      {showChatInput && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid #3a3a3a',
            background: '#181818',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '8px 10px',
                background: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 4,
                color: '#fff',
                fontSize: 13,
                fontFamily: 'sans-serif',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#4a9eff';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#3a3a3a';
              }}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatText.trim()}
              style={{
                padding: '8px 14px',
                background: chatText.trim() ? '#2a4a2a' : '#252525',
                border: '1px solid #3a6a3a',
                borderRadius: 4,
                cursor: chatText.trim() ? 'pointer' : 'not-allowed',
                color: chatText.trim() ? '#8f8' : '#555',
                fontSize: 13,
                fontFamily: 'sans-serif',
                fontWeight: 500,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
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
        {title}
      </div>
      {children}
    </div>
  );
}
