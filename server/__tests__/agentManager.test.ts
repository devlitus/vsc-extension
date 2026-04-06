import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../../src/agentManager';
import { AgentState } from '../../src/types';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    createTerminal: vi.fn(() => ({
      sendText: vi.fn(),
      show: vi.fn(),
    })),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  execSync: vi.fn(() => '/usr/bin/git'),
}));

function createMockTerminal() {
  const terminal = {
    sendText: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  };
  return terminal as any;
}

describe('AgentManager', () => {
  let agentManager: AgentManager;

  beforeEach(() => {
    agentManager = new AgentManager();
  });

  describe('interruptAgent', () => {
    it('returns false when agent does not exist', () => {
      const result = agentManager.interruptAgent(999);
      expect(result).toBe(false);
    });

    it('returns false when agent exists but has no terminal', () => {
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl');
      const result = agentManager.interruptAgent(1);
      expect(result).toBe(false);
    });

    it('returns true and sends interrupt signal when agent has terminal', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      const result = agentManager.interruptAgent(1);
      expect(result).toBe(true);
      expect(terminal.sendText).toHaveBeenCalledWith('\x03', false);
    });

    it('sets isInterrupted flag to true', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      agentManager.interruptAgent(1);
      const agent = agentManager.getAgent(1);
      expect(agent?.isInterrupted).toBe(true);
    });
  });

  describe('sendChatMessage', () => {
    it('returns false for non-string input', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      const result = agentManager.sendChatMessage(1, null as any);
      expect(result).toBe(false);
    });

    it('returns false for empty string', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      const result = agentManager.sendChatMessage(1, '');
      expect(result).toBe(false);
    });

    it('returns false for string exceeding max length', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      const result = agentManager.sendChatMessage(1, 'a'.repeat(2001));
      expect(result).toBe(false);
    });

    it('sanitizes control characters', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      agentManager.sendChatMessage(1, 'hello\x00world\r\ntest');
      expect(terminal.sendText).toHaveBeenCalledWith('hello world  test', true);
    });

    it('returns false when agent does not exist', () => {
      const result = agentManager.sendChatMessage(999, 'test');
      expect(result).toBe(false);
    });

    it('returns false when agent has no terminal', () => {
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl');
      const result = agentManager.sendChatMessage(1, 'test');
      expect(result).toBe(false);
    });

    it('sends sanitized message to terminal', () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      const result = agentManager.sendChatMessage(1, 'hello world');
      expect(result).toBe(true);
      expect(terminal.sendText).toHaveBeenCalledWith('hello world', true);
    });
  });

  describe('getBranch', () => {
    it('returns null when agent does not exist', async () => {
      const result = await agentManager.getBranch(999);
      expect(result).toBeNull();
    });

    it('returns null when projectDir is invalid', async () => {
      agentManager.createAgent('session-123', '/invalid/path', '/invalid/path/.claude/session.jsonl');
      const result = await agentManager.getBranch(1);
      expect(result).toBeNull();
    });

    it('caches branch result for 5 seconds', async () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      // First call
      const result1 = await agentManager.getBranch(1);
      
      // Second call should use cache
      const result2 = await agentManager.getBranch(1);
      
      expect(result1).toEqual(result2);
    });

    it('returns null when git command fails', async () => {
      const terminal = createMockTerminal();
      agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      // Mock git failure
      vi.doMock('child_process', () => ({
        execFile: vi.fn(() => Promise.reject(new Error('Git not found'))),
        execSync: vi.fn(() => { throw new Error('Git not found'); }),
      }));

      const result = await agentManager.getBranch(1);
      expect(result).toBeNull();
    });
  });

  describe('updateTurnEnd', () => {
    it('does nothing when agent does not exist', () => {
      expect(() => agentManager.updateTurnEnd(999)).not.toThrow();
    });

    it('does nothing when agent has no currentTurnStartTime', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      expect(() => agentManager.updateTurnEnd(1)).not.toThrow();
      expect(agent.turnHistory.length).toBe(0);
    });

    it('accumulates turn history correctly', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      // Set up turn state
      agent.currentTurnStartTime = Date.now() - 1000;
      agent.contextUsed = 1500;
      agent.toolsThisTurn = [
        { name: 'Read', count: 2 },
        { name: 'Write', count: 1 },
      ];
      
      agentManager.updateTurnEnd(1);
      
      expect(agent.turnHistory.length).toBe(1);
      expect(agent.turnHistory[0].tokensUsed).toBe(1500);
      expect(agent.turnHistory[0].toolsUsed).toEqual([
        { name: 'Read', count: 2 },
        { name: 'Write', count: 1 },
      ]);
      expect(agent.toolsThisTurn).toEqual([]);
      expect(agent.currentTurnStartTime).toBeUndefined();
    });

    it('limits turn history to MAX_TURN_HISTORY (20)', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      // Add 25 turns
      for (let i = 0; i < 25; i++) {
        agent.currentTurnStartTime = Date.now() - 1000;
        agent.contextUsed = 100;
        agentManager.updateTurnEnd(1);
      }
      
      expect(agent.turnHistory.length).toBe(20);
    });

    it('uses contextUsed for tokensUsed when available', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      agent.currentTurnStartTime = Date.now() - 1000;
      agent.contextUsed = 2500;
      
      agentManager.updateTurnEnd(1);
      
      expect(agent.turnHistory[0].tokensUsed).toBe(2500);
    });

    it('uses 0 for tokensUsed when contextUsed is undefined', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      agent.currentTurnStartTime = Date.now() - 1000;
      agent.contextUsed = undefined;
      
      agentManager.updateTurnEnd(1);
      
      expect(agent.turnHistory[0].tokensUsed).toBe(0);
    });
  });

  describe('addToolToCurrentTurn', () => {
    it('does nothing when agent does not exist', () => {
      expect(() => agentManager.addToolToCurrentTurn(999, 'Read')).not.toThrow();
    });

    it('increments count for existing tool', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      agentManager.addToolToCurrentTurn(1, 'Read');
      agentManager.addToolToCurrentTurn(1, 'Read');
      
      expect(agent.toolsThisTurn).toEqual([{ name: 'Read', count: 2 }]);
    });

    it('adds new tool entry for first occurrence', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      
      agentManager.addToolToCurrentTurn(1, 'Read');
      agentManager.addToolToCurrentTurn(1, 'Write');
      
      expect(agent.toolsThisTurn).toEqual([
        { name: 'Read', count: 1 },
        { name: 'Write', count: 1 },
      ]);
    });
  });

  describe('reassignTerminal', () => {
    it('returns false when agent does not exist', () => {
      const newTerminal = createMockTerminal();
      const result = agentManager.reassignTerminal(999, newTerminal, '/new/cwd');
      expect(result).toBe(false);
    });

    it('updates terminal reference and working directory', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/old/cwd', '/old/cwd/.claude/session.jsonl', terminal);
      
      const newTerminal = createMockTerminal();
      const result = agentManager.reassignTerminal(1, newTerminal, '/new/cwd');
      
      expect(result).toBe(true);
      expect(agent.terminalRef).toBe(newTerminal);
      expect(agent.projectDir).toBe('/new/cwd');
    });

    it('resets isInterrupted flag', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      agent.isInterrupted = true;
      
      const newTerminal = createMockTerminal();
      agentManager.reassignTerminal(1, newTerminal, '/new/cwd');
      
      expect(agent.isInterrupted).toBe(false);
    });

    it('clears turn history', () => {
      const terminal = createMockTerminal();
      const agent = agentManager.createAgent('session-123', '/test/project', '/test/project/.claude/session.jsonl', terminal);
      agent.turnHistory = [
        { startedAt: 1, endedAt: 2, toolsUsed: [], tokensUsed: 100 },
      ];
      
      const newTerminal = createMockTerminal();
      agentManager.reassignTerminal(1, newTerminal, '/new/cwd');
      
      expect(agent.turnHistory).toEqual([]);
    });
  });
});
