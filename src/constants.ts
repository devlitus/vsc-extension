export const POLL_INTERVAL_MS = 500;
export const READ_CHUNK_BYTES = 65536;
export const IDLE_THRESHOLD_MS = 5000;
export const PERMISSION_TIMEOUT_MS = 5000;
export const CLEAR_COOLDOWN_MS = 3000;
export const EXTERNAL_SCAN_DELAY_TICKS = 2;
export const SHUTDOWN_TIMEOUT_MS = 5000;

export const COMMAND_SHOW_PANEL = 'pixel-agents.showPanel';
export const COMMAND_EXPORT_DEFAULT_LAYOUT = 'pixel-agents.exportDefaultLayout';

export const PERMISSION_EXEMPT_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'LS', 'WebSearch', 'WebFetch',
  'TodoRead', 'TodoWrite', 'exit_plan_mode',
]);
