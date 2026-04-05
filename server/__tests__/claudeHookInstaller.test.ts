import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { installHooks, uninstallHooks } from '../../src/server/providers/file/claudeHookInstaller';

// Mock vscode module
vi.mock('vscode', () => ({}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

const mockFs = fs.promises as ReturnType<typeof vi.fn> & typeof import('fs').promises;

describe('claudeHookInstaller', () => {
  const TEST_PORT = 54321;
  const TEST_TOKEN = 'test-token-abc123';
  const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');
  const SETTINGS_DIR = path.join(os.homedir(), '.claude');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('installHooks', () => {
    it('writes hooks to settings.json correctly', async () => {
      // Fresh settings (no existing hooks)
      mockFs.readFile.mockResolvedValueOnce('{}');
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      await installHooks(TEST_PORT, TEST_TOKEN);

      // Verify mkdir was called to ensure directory exists
      expect(mockFs.mkdir).toHaveBeenCalledWith(SETTINGS_DIR, { mode: 0o700, recursive: true });

      // Verify writeFile was called (atomic write to .tmp)
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      const [tmpPath, content] = mockFs.writeFile.mock.calls[0] as [string, string];
      expect(tmpPath).toBe(`${SETTINGS_FILE}.tmp`);

      const writtenSettings = JSON.parse(content);
      expect(writtenSettings.hooks).toBeDefined();
      expect(writtenSettings.hooks.PreToolUse).toHaveLength(1);
      expect(writtenSettings.hooks.PostToolUse).toHaveLength(1);
      expect(writtenSettings.hooks.Stop).toHaveLength(1);
      expect(writtenSettings.hooks.SubagentStop).toHaveLength(1);

      // Verify the hook command contains correct port and token
      const hookCommand = writtenSettings.hooks.PreToolUse[0].hooks[0].command;
      expect(hookCommand).toContain(`127.0.0.1:${TEST_PORT}`);
      expect(hookCommand).toContain(TEST_TOKEN);

      // Verify rename was called to atomically move .tmp to final location
      expect(mockFs.rename).toHaveBeenCalledWith(`${SETTINGS_FILE}.tmp`, SETTINGS_FILE);
    });

    it('installHooks is idempotent (second call does not duplicate)', async () => {
      // First call returns empty settings
      mockFs.readFile
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce(JSON.stringify({ hooks: {} }));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      // First install
      await installHooks(TEST_PORT, TEST_TOKEN);

      // Second install - readFile returns settings with existing hooks
      const firstInstallCall = mockFs.readFile.mock.calls[0];
      const firstSettings = JSON.parse(await mockFs.readFile(firstInstallCall[0] as string, 'utf-8'));
      
      // Simulate reading settings that already has hooks (as would happen on second call)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(firstSettings));

      await installHooks(TEST_PORT, TEST_TOKEN);

      // writeFile should have been called twice (once per install)
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);

      // The second write should have the same hook structure (idempotent)
      const secondWriteCall = mockFs.writeFile.mock.calls[1] as [string, string];
      const secondSettings = JSON.parse(secondWriteCall[1]);
      
      // Should have exactly one hook per event type (no duplicates)
      expect(secondSettings.hooks.PreToolUse).toHaveLength(1);
      expect(secondSettings.hooks.PostToolUse).toHaveLength(1);
      expect(secondSettings.hooks.Stop).toHaveLength(1);
      expect(secondSettings.hooks.SubagentStop).toHaveLength(1);
    });

    it('atomic write: uses .tmp file + rename', async () => {
      mockFs.readFile.mockResolvedValueOnce('{}');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await installHooks(TEST_PORT, TEST_TOKEN);

      // writeFile must be called before rename
      const writeCallIndex = vi.mocked(mockFs.writeFile).mock.calls.length - 1;
      const renameCallIndex = vi.mocked(mockFs.rename).mock.calls.length - 1;

      // Verify writeFile was called with .tmp path
      const tmpPath = mockFs.writeFile.mock.calls[0][0] as string;
      expect(tmpPath).toBe(`${SETTINGS_FILE}.tmp`);

      // Verify rename moves .tmp to final location
      expect(mockFs.rename).toHaveBeenCalledWith(`${SETTINGS_FILE}.tmp`, SETTINGS_FILE);

      // Verify write happened before rename (atomic write pattern)
      expect(writeCallIndex).toBeLessThanOrEqual(renameCallIndex);
    });
  });

  describe('uninstallHooks', () => {
    it('removes only pixel-agents hooks', async () => {
      // Settings with pixel-agents hooks and some other unrelated key
      const existingSettings = {
        hooks: {
          PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: 'curl http://127.0.0.1:54321/...' }] }],
          PostToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: 'curl http://127.0.0.1:54321/...' }] }],
          Stop: [{ hooks: [{ type: 'command', command: 'curl http://127.0.0.1:54321/...' }] }],
          SubagentStop: [{ hooks: [{ type: 'command', command: 'curl http://127.0.0.1:54321/...' }] }],
        },
        someOtherKey: 'preserved',
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingSettings));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await uninstallHooks();

      // Verify writeFile was called
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      const [tmpPath, content] = mockFs.writeFile.mock.calls[0] as [string, string];
      expect(tmpPath).toBe(`${SETTINGS_FILE}.tmp`);

      const writtenSettings = JSON.parse(content);

      // hooks key itself should be removed when empty
      expect(writtenSettings.hooks).toBeUndefined();

      // Other keys should be preserved
      expect(writtenSettings.someOtherKey).toBe('preserved');
    });

    it('silently handles missing settings file', async () => {
      // readFile throws ENOENT (file doesn't exist)
      const error = new Error('ENOENT: no such file or directory');
      error.name = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      // Should not throw
      await expect(uninstallHooks()).resolves.not.toThrow();

      // writeFile should not be called when settings don't exist
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('does nothing when no hooks exist', async () => {
      mockFs.readFile.mockResolvedValueOnce('{}');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await uninstallHooks();

      // writeFile should not be called when no hooks to remove
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('removes hooks key when it becomes empty after hook removal', async () => {
      const existingSettings = {
        hooks: {
          PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: 'curl http://127.0.0.1:54321/...' }] }],
        },
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingSettings));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await uninstallHooks();

      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      const [, content] = mockFs.writeFile.mock.calls[0] as [string, string];
      const writtenSettings = JSON.parse(content);

      // hooks key should be completely removed
      expect(writtenSettings.hooks).toBeUndefined();
    });
  });
});
