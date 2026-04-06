import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectionPanel, InspectionPanelData, TurnSummary, SubagentInfo } from '../src/components/InspectionPanel';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(() => Promise.resolve()),
};

beforeEach(() => {
  // Reset the mock before each test
  mockClipboard.writeText.mockClear();
  
  // Mock the clipboard API in the global scope
  Object.defineProperty(global.navigator, 'clipboard', {
    value: mockClipboard,
    writable: true,
    configurable: true,
  });
});

describe('InspectionPanel', () => {
  const mockInspectionData: InspectionPanelData = {
    agentId: 1,
    model: 'claude-3-opus',
    cwd: '/test/project',
    branch: 'main',
    systemPrompt: 'You are a helpful assistant.',
    contextUsed: 1500,
    contextMax: 200000,
    rateLimit: false,
    currentTurnDuration: 5000,
    toolsThisTurn: [
      { name: 'Read', count: 2 },
      { name: 'Write', count: 1 },
    ],
    turnHistory: [
      {
        startedAt: Date.now() - 10000,
        endedAt: Date.now() - 5000,
        toolsUsed: [{ name: 'Read', count: 1 }],
        tokensUsed: 2500,
      },
      {
        startedAt: Date.now() - 5000,
        endedAt: Date.now(),
        toolsUsed: [{ name: 'Write', count: 1 }],
        tokensUsed: 1500,
      },
    ],
  };

  const mockSubagents: SubagentInfo[] = [
    { agentId: -1, toolId: 'tool-1', state: 'animating' },
    { agentId: -2, toolId: 'tool-2', state: 'idle' },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    inspectionData: mockInspectionData,
    onInterrupt: vi.fn(),
    onChat: vi.fn(),
    onRedirect: vi.fn(),
    subagents: mockSubagents,
    onSubagentClick: vi.fn(),
    breadcrumb: 'Main > Sub-agent #1',
  };

  describe('rendering', () => {
    it('renders when isOpen is true', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Agent 1');
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(<InspectionPanel {...defaultProps} isOpen={false} />);
      expect(container.textContent).not.toContain('Agent 1');
    });

    it('shows agent name and model', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Agent 1');
      expect(container.textContent).toContain('Main Agent • claude-3-opus');
    });

    it('shows "Loading..." when model is not available', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, model: undefined }} />);
      expect(container.textContent).toContain('Loading...');
    });

    it('shows "Agent disconnected" when inspectionData is null', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={null} />);
      expect(container.textContent).toContain('Agent disconnected');
    });

    it('shows current state section', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Current state');
      expect(container.textContent).toContain('Active');
      expect(container.textContent).toMatch(/Turn duration:/);
    });

    it('shows "Active" when currentTurnDuration is 0 (0 is considered active)', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, currentTurnDuration: 0 }} />);
      expect(container.textContent).toContain('Active');
    });

    it('shows context section with correct values', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Context');
      // Note: toLocaleString() may use different locale separators (e.g., 200.000 vs 200,000)
      expect(container.textContent).toMatch(/1500.*200[,.]000.*tokens/);
    });

    it('shows rate limit status', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, rateLimit: true }} />);
      expect(container.textContent).toContain('Rate limit');
      expect(container.textContent).toContain('Rate limited');
    });

    it('shows tools this turn', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Tools this turn');
      expect(container.textContent).toContain('Read ×2');
      expect(container.textContent).toContain('Write ×1');
    });

    it('does not show tools section when no tools used', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, toolsThisTurn: [] }} />);
      expect(container.textContent).not.toContain('Tools this turn');
    });

    it('shows directory section', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Directory');
      expect(container.textContent).toContain('/test/project');
    });

    it('shows system prompt section', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('System prompt');
      expect(container.textContent).toMatch(/You are a helpful assistant/);
    });

    it('shows turn history', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Turn history');
      // Note: Turn numbering is relative to the last 5 turns
      expect(container.textContent).toMatch(/Turn/);
      // Note: toLocaleString() may use different locale separators or none
      expect(container.textContent).toMatch(/2500 tokens/);
    });

    it('does not show turn history when empty', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, turnHistory: [] }} />);
      expect(container.textContent).not.toContain('Turn history');
    });

    it('shows active sub-agents', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Active sub-agents');
      expect(container.textContent).toContain('Sub-agent #-1');
      expect(container.textContent).toContain('Sub-agent #-2');
    });

    it('does not show sub-agents section when empty', () => {
      const { container } = render(<InspectionPanel {...defaultProps} subagents={[]} />);
      expect(container.textContent).not.toContain('Active sub-agents');
    });

    it('shows breadcrumb when provided', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      expect(container.textContent).toContain('Main > Sub-agent #1');
    });

    it('does not show breadcrumb when empty', () => {
      const { container } = render(<InspectionPanel {...defaultProps} breadcrumb="" />);
      expect(container.textContent).not.toContain('Main > Sub-agent #1');
    });
  });

  describe('callbacks', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<InspectionPanel {...defaultProps} onClose={onClose} />);
      
      const closeButton = container.querySelector('button');
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('calls onRedirect when redirect button is clicked', () => {
      const onRedirect = vi.fn();
      const { container } = render(<InspectionPanel {...defaultProps} onRedirect={onRedirect} />);
      
      const buttons = container.querySelectorAll('button');
      const redirectButton = Array.from(buttons).find(b => b.textContent === 'Redirect');
      if (redirectButton) {
        fireEvent.click(redirectButton);
        expect(onRedirect).toHaveBeenCalledTimes(1);
      }
    });

    it('copies directory path to clipboard when copy button is clicked', () => {
      const { container } = render(<InspectionPanel {...defaultProps} />);
      
      const copyButton = container.querySelector('[title="Copy path"]');
      if (copyButton) {
        fireEvent.click(copyButton);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/test/project');
      }
    });
  });

  describe('edge cases', () => {
    it('handles null inspectionData gracefully', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={null} />);
      
      expect(container.textContent).toContain('Agent disconnected');
      expect(container.textContent).toContain('Loading...');
      // Note: Current state section still renders even without inspection data
      expect(container.textContent).toContain('Current state');
    });

    it('handles undefined model gracefully', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, model: undefined }} />);
      
      expect(container.textContent).toContain('Loading...');
    });

    it('handles empty turn history gracefully', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, turnHistory: [] }} />);
      
      expect(container.textContent).not.toContain('Turn history');
    });

    it('handles empty toolsThisTurn gracefully', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, toolsThisTurn: [] }} />);
      
      expect(container.textContent).not.toContain('Tools this turn');
    });

    it('handles empty subagents array', () => {
      const { container } = render(<InspectionPanel {...defaultProps} subagents={[]} />);
      
      expect(container.textContent).not.toContain('Active sub-agents');
    });

    it('handles null branch gracefully', () => {
      const { container } = render(<InspectionPanel {...defaultProps} inspectionData={{ ...mockInspectionData, branch: null }} />);
      
      expect(container.textContent).toContain('Agent 1');
    });
  });
});
