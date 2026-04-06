import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KanbanBoard, KanbanTask, DEFAULT_COLUMNS } from './kanbanTypes';

const KANBAN_DIR = path.join(os.homedir(), '.pixel-agents');
const KANBAN_FILE = path.join(KANBAN_DIR, 'kanban.json');

const PROTECTED_KEYS = ['__proto__', 'constructor', 'prototype'];

const MAX_STRING_LENGTH = 10000;
const MAX_TASKS = 2000;
const MAX_URL_LENGTH = 2048;
const MAX_COLUMN_LABEL_LENGTH = 100;
const MAX_COLUMN_LABELS_TOTAL = 500;

// Security: URL validation - only allow http/https protocols with length limit
export function isValidUrl(str: string): boolean {
  if (typeof str !== 'string' || str.length > MAX_URL_LENGTH) {
    console.error('[Security] URL validation failed: invalid type or exceeds max length');
    return false;
  }

  try {
    const url = new URL(str);

    // Check protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      console.error('[Security] URL validation failed: invalid protocol', url.protocol);
      return false;
    }

    // SSRF protection - block internal networks
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]',
      '169.254.169.254', // AWS metadata
      'metadata.google.internal', // GCP metadata
      '169.254.',
      '10.',
      '172.16.', '172.17.', '172.18.', '172.19.', '172.20.',
      '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
      '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
      '192.168.',
    ];

    for (const pattern of blockedPatterns) {
      if (hostname === pattern || hostname.startsWith(pattern)) {
        console.error(`[Security] Blocked internal URL: ${hostname}`);
        return false;
      }
    }

    // Block URLs with credentials
    if (url.username || url.password) {
      console.error(`[Security] URL with credentials not allowed`);
      return false;
    }

    return true;
  } catch {
    console.error('[Security] URL validation failed: invalid URL format');
    return false;
  }
}

// Security: HTML sanitization for markdown content from external sources
export function sanitizeMarkdown(body: string): string {
  if (typeof body !== 'string') return '';
  // Remove all HTML tags to prevent XSS
  let sanitized = body.replace(/<[^>]*>/g, '');
  // Remove control characters (except newline and tab)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Enforce length limit
  if (sanitized.length > MAX_STRING_LENGTH) {
    console.warn('[Security] Markdown sanitized: content exceeded max length');
    sanitized = sanitized.slice(0, MAX_STRING_LENGTH);
  }
  return sanitized.trim();
}

// Security: Input sanitization to remove control characters
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function deepCloneWithValidation<T>(obj: unknown): T | null {
  if (obj === null || typeof obj !== 'object') {
    return null;
  }

  if (Array.isArray(obj)) {
    const cloned: unknown[] = [];
    for (const item of obj) {
      const c = deepCloneWithValidation(item);
      if (c === null) return null;
      cloned.push(c);
    }
    return cloned as unknown as T;
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (PROTECTED_KEYS.includes(key)) continue;
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null) {
      const c = deepCloneWithValidation(value);
      if (c === null) return null;
      clone[key] = c;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined) {
      clone[key] = value;
    }
  }
  return clone as unknown as T;
}

function validateTask(task: unknown): task is KanbanTask {
  if (typeof task !== 'object' || task === null) return false;
  const t = task as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.description === 'string' &&
    typeof t.priority === 'string' &&
    typeof t.status === 'string' &&
    typeof t.createdAt === 'number' &&
    typeof t.updatedAt === 'number'
  );
}

// Security: Validate column with length constraints
function isValidColumn(col: unknown): col is { id: string; label: string; status: string } {
  if (typeof col !== 'object' || col === null) return false;
  const c = col as Record<string, unknown>;
  const valid = (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.status === 'string'
  );
  if (valid && typeof c.label === 'string') {
    if (c.label.length > MAX_COLUMN_LABEL_LENGTH) {
      console.error('[Security] Column label validation failed: exceeds max length', c.label.length);
      return false;
    }
  }
  return valid;
}

export function isSafeKanbanBoard(input: unknown): input is KanbanBoard {
  if (!input || typeof input !== 'object') return false;
  const b = input as Record<string, unknown>;

  // Validate columns
  if (!Array.isArray(b.columns) || b.columns.length === 0) return false;
  let totalLabelLength = 0;
  for (const col of b.columns) {
    if (!isValidColumn(col)) {
      console.error('[Security] KanbanBoard validation failed: invalid column');
      return false;
    }
    const c = col as { id: string; label: string; status: string };
    totalLabelLength += c.label.length;
  }
  // Security: Enforce total column label length limit
  if (totalLabelLength > MAX_COLUMN_LABELS_TOTAL) {
    console.error('[Security] KanbanBoard validation failed: total column labels exceed max length');
    return false;
  }

  // Validate tasks
  if (!Array.isArray(b.tasks)) return false;
  if (b.tasks.length > MAX_TASKS) return false;

  const validPriorities = ['low', 'medium', 'high'];
  const validStatuses = ['backlog', 'in-progress', 'review', 'done'];

  for (const task of b.tasks) {
    if (typeof task !== 'object' || task === null) return false;
    const t = task as Record<string, unknown>;

    if (typeof t.id !== 'string' || t.id.length > 128) return false;
    if (typeof t.title !== 'string' || t.title.length > 500) return false;
    if (typeof t.description !== 'string' || t.description.length > MAX_STRING_LENGTH) return false;
    if (typeof t.priority !== 'string' || !validPriorities.includes(t.priority)) return false;
    if (typeof t.status !== 'string' || !validStatuses.includes(t.status)) return false;
    if (typeof t.createdAt !== 'number' || !Number.isFinite(t.createdAt)) return false;
    if (typeof t.updatedAt !== 'number' || !Number.isFinite(t.updatedAt)) return false;

    if (t.assignedAgentId !== undefined) {
      if (typeof t.assignedAgentId !== 'number' || !Number.isInteger(t.assignedAgentId)) return false;
    }
    if (t.sourceUrl !== undefined) {
      if (typeof t.sourceUrl !== 'string') return false;
      // Security: Validate URL protocol and length
      if (!isValidUrl(t.sourceUrl)) {
        console.error('[Security] Task validation failed: invalid sourceUrl', t.sourceUrl);
        return false;
      }
    }
    if (t.sourceProvider !== undefined) {
      if (typeof t.sourceProvider !== 'string') return false;
      const validProviders = ['github', 'local'];
      if (!validProviders.includes(t.sourceProvider)) {
        console.error('[Security] Task validation failed: invalid sourceProvider', t.sourceProvider);
        return false;
      }
    }
  }

  return true;
}

export function loadBoard(): KanbanBoard {
  try {
    if (!fs.existsSync(KANBAN_FILE)) {
      return { columns: DEFAULT_COLUMNS, tasks: [] };
    }
    const content = fs.readFileSync(KANBAN_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!isSafeKanbanBoard(parsed)) {
      console.error('[Security] KanbanBoard validation failed during load - returning default');
      return { columns: DEFAULT_COLUMNS, tasks: [] };
    }
    const cloned = deepCloneWithValidation<KanbanBoard>(parsed);
    if (!cloned) {
      console.error('[Security] KanbanBoard clone failed during load - returning default');
      return { columns: DEFAULT_COLUMNS, tasks: [] };
    }
    // Ensure columns are valid
    const columns = Array.isArray(cloned.columns) ? cloned.columns : DEFAULT_COLUMNS;
    const tasks = Array.isArray(cloned.tasks) ? cloned.tasks.filter(validateTask) : [];
    return { columns, tasks };
  } catch (error) {
    console.error('[Error] Failed to load kanban board:', error);
    return { columns: DEFAULT_COLUMNS, tasks: [] };
  }
}

export function saveBoard(board: KanbanBoard): void {
  if (!isSafeKanbanBoard(board)) {
    console.error('[Security] KanbanBoard validation failed - save aborted');
    return;
  }
  try {
    // Security: Create directory with restricted permissions (0o700 = owner: rwx, group/other: ---)
    if (!fs.existsSync(KANBAN_DIR)) {
      fs.mkdirSync(KANBAN_DIR, { recursive: true, mode: 0o700 });
    }
    const tempFile = path.join(KANBAN_DIR, 'kanban.tmp');
    const content = JSON.stringify(board, null, 2);
    // Security: Write with restricted permissions (0o600 = owner: rw, group/other: ---)
    fs.writeFileSync(tempFile, content, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tempFile, KANBAN_FILE);
  } catch (error) {
    console.error('[Error] Failed to save kanban board:', error);
  }
}
