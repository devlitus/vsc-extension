import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHookEvent, validateHookEvent } from '../../src/server/hookEventHandler';
import { AgentState } from '../../src/types';
import { WebviewMessage } from '../../src/types';
import { HookEvent } from '../../src/server/types';
import { AgentManager } from '../../src/agentManager';

// Mock vscode module
vi.mock('vscode', () => ({}));

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 1,
    sessionId: 'test-session-123',
    projectDir: '/test/project',
    jsonlFile: '/test/project/.claude/projects/test-session-123.jsonl',
    fileOffset: 0,
    lineBuffer: '',
    lineChunks: [],
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    subagentToolIds: new Set(),
    backgroundAgentToolIds: new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    hookDelivered: false,
    isExternal: false,
    lastDataAt: Date.now(),
    linesProcessed: 0,
    seenUnknownRecordTypes: new Set(),
    toolsThisTurn: [],
    turnHistory: [],
    currentTurnAssistantContent: '',
    ...overrides,
  };
}

describe('hookEventHandler', () => {
  describe('validateHookEvent', () => {
    it('returns true for valid PreToolUse event', () => {
      const event = { type: 'PreToolUse', sessionId: 'test-session' };
      expect(validateHookEvent(event)).toBe(true);
    });

    it('returns true for valid Stop event', () => {
      const event = { type: 'Stop', sessionId: 'test-session' };
      expect(validateHookEvent(event)).toBe(true);
    });

    it('returns false for null', () => {
      expect(validateHookEvent(null)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(validateHookEvent('string')).toBe(false);
    });

    it('returns false for missing type', () => {
      expect(validateHookEvent({ sessionId: 'test' })).toBe(false);
    });

    it('returns false for invalid type', () => {
      expect(validateHookEvent({ type: 'InvalidType', sessionId: 'test' })).toBe(false);
    });

    it('returns false for missing sessionId', () => {
      expect(validateHookEvent({ type: 'PreToolUse' })).toBe(false);
    });

    it('returns false for non-string sessionId', () => {
      expect(validateHookEvent({ type: 'PreToolUse', sessionId: 123 })).toBe(false);
    });

    it('returns false for oversized sessionId (>256 chars)', () => {
      const event = { type: 'PreToolUse', sessionId: 'a'.repeat(257) };
      expect(validateHookEvent(event)).toBe(false);
    });
  });

  describe('handleHookEvent', () => {
    let agentManager: AgentManager;
    let postMessageMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      postMessageMock = vi.fn();
      // Mock AgentManager with getAgentBySessionId method
      agentManager = {
        getAgentBySessionId: vi.fn(),
      } as unknown as AgentManager;
    });

    it('PreToolUse with known sessionId → calls callback with permissionRequest', () => {
      const mockAgent = createMockAgent({ id: 1, sessionId: 'test-session-123' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

      const event: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'test-session-123',
        toolName: 'Read',
        toolInput: { filePath: '/test.txt' },
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(postMessageMock).toHaveBeenCalledTimes(1);
      expect(postMessageMock).toHaveBeenCalledWith(1, {
        type: 'permissionRequest',
        agentId: 1,
      });
      expect(mockAgent.permissionSent).toBe(true);
    });

    it('Stop with known sessionId → calls callback with turnEnd and hookDelivered=true', () => {
      const mockAgent = createMockAgent({ id: 1, sessionId: 'test-session-123' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

      const event: HookEvent = {
        type: 'Stop',
        sessionId: 'test-session-123',
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(postMessageMock).toHaveBeenCalledTimes(1);
      expect(postMessageMock).toHaveBeenCalledWith(1, {
        type: 'turnEnd',
        agentId: 1,
        source: 'hook',
      });
      expect(mockAgent.hookDelivered).toBe(true);
    });

    it('SubagentStop with known sessionId → calls callback with turnEnd', () => {
      const mockAgent = createMockAgent({ id: 1, sessionId: 'test-session-123' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

      const event: HookEvent = {
        type: 'SubagentStop',
        sessionId: 'test-session-123',
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(postMessageMock).toHaveBeenCalledTimes(1);
      expect(postMessageMock).toHaveBeenCalledWith(1, {
        type: 'turnEnd',
        agentId: 1,
        source: 'hook',
      });
      expect(mockAgent.hookDelivered).toBe(true);
    });

    it('PostToolUse with known sessionId → calls callback with toolEnd', () => {
      const mockAgent = createMockAgent({ id: 1, sessionId: 'test-session-123' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

      const event: HookEvent = {
        type: 'PostToolUse',
        sessionId: 'test-session-123',
        toolName: 'Read',
        toolResult: { content: 'file contents' },
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(postMessageMock).toHaveBeenCalledTimes(1);
      expect(postMessageMock).toHaveBeenCalledWith(1, {
        type: 'toolEnd',
        agentId: 1,
      });
    });

    it('Event with unknown sessionId → does not call callbacks', () => {
      const mockAgent = createMockAgent({ id: 1, sessionId: 'test-session-123' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const event: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'unknown-session',
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(postMessageMock).not.toHaveBeenCalled();
      expect(mockAgent.permissionSent).toBe(false);
    });

    it('Event with unknown sessionId does not modify agent state', () => {
      const mockAgent = createMockAgent({ id: 1, sessionId: 'test-session-123' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const event: HookEvent = {
        type: 'Stop',
        sessionId: 'unknown-session',
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(mockAgent.hookDelivered).toBe(false);
    });

    it('finds agent by sessionId among multiple agents', () => {
      const mockAgent = createMockAgent({ id: 2, sessionId: 'session-b' });
      (agentManager.getAgentBySessionId as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

      const event: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'session-b',
      };

      handleHookEvent(event, agentManager, postMessageMock);

      expect(postMessageMock).toHaveBeenCalledWith(2, {
        type: 'permissionRequest',
        agentId: 2,
      });
    });
  });
});
