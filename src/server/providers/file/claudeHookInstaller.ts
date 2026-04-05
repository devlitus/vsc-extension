import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHookScript } from './hooks/claude-hook';

const SETTINGS_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

/**
 * Structure matching Claude Code's settings.json hook format.
 * Each hook type maps to an array of hook configurations with matchers.
 */
interface SettingsData {
  hooks?: {
    PreToolUse?: Array<{ matcher?: string; hooks: Array<{ type: 'command'; command: string }> }>;
    PostToolUse?: Array<{ matcher?: string; hooks: Array<{ type: 'command'; command: string }> }>;
    Stop?: Array<{ hooks: Array<{ type: 'command'; command: string }> }>;
    SubagentStop?: Array<{ hooks: Array<{ type: 'command'; command: string }> }>;
  };
}

/**
 * Reads the current Claude Code settings file.
 *
 * @returns Parsed settings object, or empty object if file doesn't exist
 */
async function readSettings(): Promise<SettingsData> {
  try {
    const content = await fs.promises.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Writes settings to Claude Code's settings.json using atomic rename.
 *
 * Creates the `.claude` directory with mode 0o700 if it doesn't exist.
 * Writes to a temporary file with mode 0o600 then atomically renames to
 * the target path to avoid partial writes on crash.
 *
 * @param settings - Settings object to serialize and write
 */
async function writeSettings(settings: SettingsData): Promise<void> {
  // Ensure directory exists
  await fs.promises.mkdir(SETTINGS_DIR, { mode: 0o700, recursive: true });

  // Atomic write using temp file + rename
  const content = JSON.stringify(settings, null, 2);
  const tmpPath = `${SETTINGS_FILE}.tmp`;
  await fs.promises.writeFile(tmpPath, content, { mode: 0o600 });
  await fs.promises.rename(tmpPath, SETTINGS_FILE);
}

/**
 * Installs Claude Code hooks that forward events to the PixelAgentsServer.
 *
 * Writes hook configurations to `~/.claude/settings.json` for all four event
 * types: PreToolUse, PostToolUse, Stop, and SubagentStop. Each hook runs an
 * inline shell script that POSTs the event to the local server via curl.
 *
 * Uses atomic writes (temp file + rename) to ensure settings are never
 * partially written.
 *
 * @param port - Local server port (assigned by PixelAgentsServer)
 * @param token - Bearer token for server authentication
 *
 * @example
 * await installHooks(54321, 'abc123...');
 */
export async function installHooks(port: number, token: string): Promise<void> {
  const settings = await readSettings();
  const hookScript = createHookScript(port, token);

  if (!settings.hooks) {
    settings.hooks = {};
  }

  settings.hooks.PreToolUse = [
    {
      matcher: '.*',
      hooks: [{ type: 'command' as const, command: hookScript }],
    },
  ];

  settings.hooks.PostToolUse = [
    {
      matcher: '.*',
      hooks: [{ type: 'command' as const, command: hookScript }],
    },
  ];

  settings.hooks.Stop = [
    {
      hooks: [{ type: 'command' as const, command: hookScript }],
    },
  ];

  settings.hooks.SubagentStop = [
    {
      hooks: [{ type: 'command' as const, command: hookScript }],
    },
  ];

  await writeSettings(settings);
}

/**
 * Removes Claude Code hooks from `~/.claude/settings.json`.
 *
 * Deletes all four hook event types (PreToolUse, PostToolUse, Stop,
 * SubagentStop) and removes the `hooks` key entirely if it becomes empty.
 * Uses atomic writes like installHooks.
 *
 * Silently ignores errors (e.g., if settings.json doesn't exist).
 */
export async function uninstallHooks(): Promise<void> {
  try {
    const settings = await readSettings();
    if (!settings.hooks) {
      return;
    }

    delete settings.hooks.PreToolUse;
    delete settings.hooks.PostToolUse;
    delete settings.hooks.Stop;
    delete settings.hooks.SubagentStop;

    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    await writeSettings(settings);
  } catch {
    // Ignore errors during uninstall
  }
}