import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LAYOUT_DIR = path.join(os.homedir(), '.pixel-agents');
const LAYOUT_FILE = path.join(LAYOUT_DIR, 'layout.json');

interface LayoutData {
  version?: number;
  furniturePacks?: Array<{
    id: string;
    name: string;
    uri?: string;
  }>;
  [key: string]: unknown;
}

function deepCloneLayout(obj: unknown): LayoutData | null {
  if (obj === null || typeof obj !== 'object') {
    return null;
  }

  if (Array.isArray(obj)) {
    const cloned: unknown[] = [];
    for (const item of obj) {
      const c = deepCloneLayout(item);
      if (c === null) {
        return null;
      }
      cloned.push(c);
    }
    return { furniturePacks: cloned as LayoutData['furniturePacks'] };
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null) {
      const c = deepCloneLayout(value);
      if (c === null) {
        return null;
      }
      clone[key] = c;
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === undefined
    ) {
      clone[key] = value;
    }
  }
  return clone as LayoutData;
}

function validateLayout(obj: unknown): obj is LayoutData {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return true;
}

export function loadLayout(): LayoutData | null {
  try {
    if (!fs.existsSync(LAYOUT_FILE)) {
      return null;
    }

    const content = fs.readFileSync(LAYOUT_FILE, 'utf-8');
    const parsed = JSON.parse(content);

    if (!validateLayout(parsed)) {
      return null;
    }

    return deepCloneLayout(parsed);
  } catch {
    return null;
  }
}

export function saveLayout(layout: LayoutData): void {
  const validated = deepCloneLayout(layout);
  if (!validated) {
    return;
  }

  try {
    if (!fs.existsSync(LAYOUT_DIR)) {
      fs.mkdirSync(LAYOUT_DIR, { recursive: true });
    }

    const tempFile = path.join(LAYOUT_DIR, 'layout.tmp');
    const content = JSON.stringify(validated, null, 2);

    fs.writeFileSync(tempFile, content, 'utf-8');
    fs.chmodSync(tempFile, 0o600);
    fs.renameSync(tempFile, LAYOUT_FILE);
    fs.chmodSync(LAYOUT_FILE, 0o600);
  } catch {
    // Ignore save errors
  }
}
