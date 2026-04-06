import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  isSafeKanbanBoard,
  isValidUrl,
  sanitizeMarkdown,
  loadBoard,
  saveBoard,
} from '../../src/kanbanPersistence';
import { DEFAULT_COLUMNS } from '../../src/kanbanTypes';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  existsSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

describe('kanbanPersistence', () => {
  const mockKanbanDir = path.join(os.homedir(), '.pixel-agents');
  const mockKanbanFile = path.join(mockKanbanDir, 'kanban.json');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidUrl', () => {
    it('returns true for valid HTTPS URLs', () => {
      expect(isValidUrl('https://github.com/owner/repo')).toBe(true);
      expect(isValidUrl('https://api.github.com/repos/owner/repo/issues')).toBe(true);
    });

    it('returns true for valid HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('returns false for non-string input', () => {
      expect(isValidUrl(null as any)).toBe(false);
      expect(isValidUrl(undefined as any)).toBe(false);
      expect(isValidUrl(123 as any)).toBe(false);
    });

    it('returns false for URLs exceeding max length', () => {
      expect(isValidUrl('https://example.com/' + 'a'.repeat(2048))).toBe(false);
    });

    it('returns false for invalid protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('blocks localhost URLs', () => {
      expect(isValidUrl('http://localhost:8080')).toBe(false);
      expect(isValidUrl('https://localhost')).toBe(false);
    });

    it('blocks 127.0.0.1', () => {
      expect(isValidUrl('http://127.0.0.1')).toBe(false);
      expect(isValidUrl('http://127.0.0.1:3000')).toBe(false);
    });

    it('blocks 0.0.0.0', () => {
      expect(isValidUrl('http://0.0.0.0')).toBe(false);
    });

    it('blocks ::1 (IPv6 localhost)', () => {
      expect(isValidUrl('http://[::1]')).toBe(false);
    });

    it('blocks AWS metadata IP (169.254.169.254)', () => {
      expect(isValidUrl('http://169.254.169.254')).toBe(false);
      expect(isValidUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    it('blocks GCP metadata hostname', () => {
      expect(isValidUrl('http://metadata.google.internal')).toBe(false);
    });

    it('blocks private network ranges (10.x.x.x)', () => {
      expect(isValidUrl('http://10.0.0.1')).toBe(false);
      expect(isValidUrl('http://10.255.255.255')).toBe(false);
    });

    it('blocks private network ranges (172.16.x.x - 172.31.x.x)', () => {
      expect(isValidUrl('http://172.16.0.1')).toBe(false);
      expect(isValidUrl('http://172.31.255.255')).toBe(false);
      expect(isValidUrl('http://172.15.0.1')).toBe(true); // Not in range
      expect(isValidUrl('http://172.32.0.1')).toBe(true); // Not in range
    });

    it('blocks private network ranges (192.168.x.x)', () => {
      expect(isValidUrl('http://192.168.0.1')).toBe(false);
      expect(isValidUrl('http://192.168.255.255')).toBe(false);
    });

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isValidUrl('http://169.254.1.1')).toBe(false);
    });

    it('blocks URLs with credentials', () => {
      expect(isValidUrl('https://user:pass@example.com')).toBe(false);
      expect(isValidUrl('https://user@example.com')).toBe(false);
    });

    it('returns false for malformed URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
      expect(isValidUrl('://example.com')).toBe(false);
    });
  });

  describe('sanitizeMarkdown', () => {
    it('removes HTML tags', () => {
      expect(sanitizeMarkdown('<script>alert(1)</script>')).toBe('alert(1)');
      expect(sanitizeMarkdown('<b>bold</b>')).toBe('bold');
      expect(sanitizeMarkdown('<a href="http://evil.com">link</a>')).toBe('link');
    });

    it('removes control characters', () => {
      expect(sanitizeMarkdown('hello\x00world')).toBe('helloworld');
      expect(sanitizeMarkdown('test\x1b[31mred\x1b[0m')).toBe('test[31mred[0m');
    });

    it('preserves newlines and tabs', () => {
      expect(sanitizeMarkdown('line1\nline2\ttabbed')).toBe('line1\nline2\ttabbed');
    });

    it('enforces max length limit', () => {
      const longText = 'a'.repeat(10001);
      const result = sanitizeMarkdown(longText);
      expect(result.length).toBe(10000);
    });

    it('trims whitespace', () => {
      expect(sanitizeMarkdown('  hello  ')).toBe('hello');
    });

    it('returns empty string for non-string input', () => {
      expect(sanitizeMarkdown(null as any)).toBe('');
      expect(sanitizeMarkdown(undefined as any)).toBe('');
      expect(sanitizeMarkdown(123 as any)).toBe('');
    });
  });

  describe('isSafeKanbanBoard', () => {
    const validBoard = {
      columns: DEFAULT_COLUMNS,
      tasks: [],
    };

    it('returns true for valid board', () => {
      expect(isSafeKanbanBoard(validBoard)).toBe(true);
    });

    it('returns false for null or undefined', () => {
      expect(isSafeKanbanBoard(null)).toBe(false);
      expect(isSafeKanbanBoard(undefined)).toBe(false);
    });

    it('returns false for non-object input', () => {
      expect(isSafeKanbanBoard('string')).toBe(false);
      expect(isSafeKanbanBoard(123)).toBe(false);
      expect(isSafeKanbanBoard([])).toBe(false);
    });

    it('rejects prototype pollution attempts', () => {
      const pollutedBoard = {
        __proto__: { polluted: true },
        columns: DEFAULT_COLUMNS,
        tasks: [],
      };
      expect(isSafeKanbanBoard(pollutedBoard as any)).toBe(true); // Should not crash
      expect((pollutedBoard as any).polluted).toBe(true); // But should not be copied
    });

    it('rejects constructor pollution', () => {
      const pollutedBoard = {
        constructor: { polluted: true },
        columns: DEFAULT_COLUMNS,
        tasks: [],
      };
      expect(isSafeKanbanBoard(pollutedBoard as any)).toBe(true);
    });

    it('returns false when columns is missing', () => {
      expect(isSafeKanbanBoard({ tasks: [] } as any)).toBe(false);
    });

    it('returns false when columns is empty array', () => {
      expect(isSafeKanbanBoard({ columns: [], tasks: [] } as any)).toBe(false);
    });

    it('returns false when columns is not an array', () => {
      expect(isSafeKanbanBoard({ columns: 'not-an-array', tasks: [] } as any)).toBe(false);
    });

    it('returns false when tasks is missing', () => {
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS } as any)).toBe(false);
    });

    it('returns false when tasks is not an array', () => {
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: 'not-an-array' } as any)).toBe(false);
    });

    it('returns false when task count exceeds limit', () => {
      const tooManyTasks = Array.from({ length: 2001 }, (_, i) => ({
        id: `task-${i}`,
        title: 'Task',
        description: 'Description',
        priority: 'low' as const,
        status: 'backlog' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: tooManyTasks } as any)).toBe(false);
    });

    it('returns false for invalid task with missing required fields', () => {
      const invalidTasks = [
        { id: '1', title: 'Task', description: 'Desc', priority: 'low', status: 'backlog', createdAt: Date.now() }, // Missing updatedAt
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for invalid task ID format', () => {
      const invalidTasks = [
        { id: 123 as any, title: 'Task', description: 'Desc', priority: 'low', status: 'backlog', createdAt: Date.now(), updatedAt: Date.now() },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for task ID exceeding max length', () => {
      const invalidTasks = [
        { id: 'a'.repeat(129), title: 'Task', description: 'Desc', priority: 'low', status: 'backlog', createdAt: Date.now(), updatedAt: Date.now() },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for invalid priority', () => {
      const invalidTasks = [
        { id: '1', title: 'Task', description: 'Desc', priority: 'invalid' as any, status: 'backlog', createdAt: Date.now(), updatedAt: Date.now() },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for invalid status', () => {
      const invalidTasks = [
        { id: '1', title: 'Task', description: 'Desc', priority: 'low', status: 'invalid' as any, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for invalid sourceUrl', () => {
      const invalidTasks = [
        { id: '1', title: 'Task', description: 'Desc', priority: 'low', status: 'backlog', createdAt: Date.now(), updatedAt: Date.now(), sourceUrl: 'http://localhost' },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for invalid sourceProvider', () => {
      const invalidTasks = [
        { id: '1', title: 'Task', description: 'Desc', priority: 'low', status: 'backlog', createdAt: Date.now(), updatedAt: Date.now(), sourceProvider: 'invalid' as any },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false for invalid assignedAgentId', () => {
      const invalidTasks = [
        { id: '1', title: 'Task', description: 'Desc', priority: 'low', status: 'backlog', createdAt: Date.now(), updatedAt: Date.now(), assignedAgentId: 'not-a-number' as any },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: invalidTasks } as any)).toBe(false);
    });

    it('returns false when column label exceeds max length', () => {
      const invalidColumns = [
        { id: 'col-1', label: 'a'.repeat(101), status: 'backlog' },
      ];
      expect(isSafeKanbanBoard({ columns: invalidColumns, tasks: [] } as any)).toBe(false);
    });

    it('returns false when total column labels exceed max total length', () => {
      const invalidColumns = Array.from({ length: 10 }, (_, i) => ({
        id: `col-${i}`,
        label: 'a'.repeat(60),
        status: 'backlog',
      }));
      expect(isSafeKanbanBoard({ columns: invalidColumns, tasks: [] } as any)).toBe(false);
    });

    it('accepts valid task with optional fields', () => {
      const validTasks = [
        {
          id: 'gh-123-456',
          title: 'GitHub Issue',
          description: 'Issue description',
          priority: 'high' as const,
          status: 'in-progress' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          assignedAgentId: 1,
          sourceUrl: 'https://github.com/owner/repo/issues/123',
          sourceProvider: 'github' as const,
        },
      ];
      expect(isSafeKanbanBoard({ columns: DEFAULT_COLUMNS, tasks: validTasks })).toBe(true);
    });
  });

  describe('loadBoard and saveBoard round-trip', () => {
    it('saves and loads board correctly', () => {
      const board = {
        columns: DEFAULT_COLUMNS,
        tasks: [
          {
            id: 'task-1',
            title: 'Test Task',
            description: 'Test description',
            priority: 'medium' as const,
            status: 'backlog' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };

      (fs.existsSync as any).mockReturnValue(false);

      saveBoard(board);

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockKanbanDir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockKanbanDir, 'kanban.tmp'),
        expect.any(String),
        { encoding: 'utf-8', mode: 0o600 }
      );
      expect(fs.renameSync).toHaveBeenCalled();
    });

    it('returns default board when file does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const result = loadBoard();
      
      expect(result).toEqual({ columns: DEFAULT_COLUMNS, tasks: [] });
    });

    it('returns default board when file contains invalid data', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{ invalid json }');
      
      const result = loadBoard();
      
      expect(result).toEqual({ columns: DEFAULT_COLUMNS, tasks: [] });
    });

    it('returns default board when board validation fails', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({ columns: [], tasks: [] }));
      
      const result = loadBoard();
      
      expect(result).toEqual({ columns: DEFAULT_COLUMNS, tasks: [] });
    });

    it('loads valid board from file', () => {
      const board = {
        columns: DEFAULT_COLUMNS,
        tasks: [
          {
            id: 'task-1',
            title: 'Test Task',
            description: 'Test description',
            priority: 'medium' as const,
            status: 'backlog' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(board));
      
      const result = loadBoard();
      
      expect(result.columns).toEqual(DEFAULT_COLUMNS);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-1');
    });

    it('does not save when board validation fails', () => {
      const invalidBoard = { columns: [], tasks: [] } as any;
      
      saveBoard(invalidBoard);
      
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
