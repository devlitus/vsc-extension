# Phase 2 — Agents: Security Measures

This document describes the security measures implemented in the Phase 2 agents system to protect against common vulnerabilities.

## Prototype Pollution Protection

### `deepCloneWithProtection` (transcriptParser.ts)

The `deepCloneWithProtection` function prevents prototype pollution attacks when parsing JSONL transcript data:

```typescript
const POLL_PROTOTYPE_KEYS = ['__proto__', 'constructor', 'prototype'];

export function deepCloneWithProtection<T>(obj: T): T {
  // ...
  for (const key of Object.keys(obj)) {
    if (POLL_PROTOTYPE_KEYS.includes(key)) {
      continue;  // Skip dangerous keys
    }
    clone[key] = deepCloneWithProtection((obj as Record<string, unknown>)[key]);
  }
  return clone as T;
}
```

**Protection mechanism:**
- Explicitly skips keys `__proto__`, `constructor`, and `prototype` during cloning
- Recursively handles Sets, Maps, and Arrays with the same protection
- Used for all transcript record parsing before constructing webview messages

### `deepCloneLayout` (layoutPersistence.ts)

Similar protection for layout configuration files:

```typescript
if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
  continue;
}
```

**Applied to:**
- Layout data loaded from `~/.pixel-agents/layout.json`
- All nested objects within furniture packs

## Path Traversal Prevention

### `isSafePath` (fileWatcher.ts)

The `isSafePath` function prevents path traversal attacks when accessing project directories:

```typescript
function isSafePath(filePath: string): boolean {
  try {
    const resolved = path.resolve(filePath);
    const realPath = fs.realpathSync(filePath);
    // Also verify the real path stays within PROJECT_DIR
    return resolved === realPath && 
           realPath.startsWith(path.resolve(PROJECT_DIR) + path.sep);
  } catch {
    return false;
  }
}
```

**Protection mechanism:**
- Resolves the file path and compares it against the real path (resolves symlinks)
- Ensures the resolved path stays within `~/.claude/projects/`
- Catches exceptions and returns `false` for any invalid paths
- Applied to both project directories and session files

### `isSafeProjectDir` (fileWatcher.ts)

Additional path safety check for project directories:

```typescript
private isSafeProjectDir(projectDir: string): boolean {
  try {
    if (!isSafePath(projectDir)) {
      return false;
    }
    const resolved = path.resolve(projectDir);
    return resolved.startsWith(path.resolve(PROJECT_DIR));
  } catch {
    return false;
  }
}
```

## Webview Message Sanitization

### `isWebviewMessage` (transcriptParser.ts)

Validates all messages before sending to the webview using a type-safe validation function:

```typescript
function isWebviewMessage(msg: unknown): msg is WebviewMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }
  const record = msg as Record<string, unknown>;
  
  if (!('type' in record) || typeof record.type !== 'string') {
    return false;
  }
  
  switch (record.type) {
    case 'agentAdded':
      return (
        'agentId' in record && typeof record.agentId === 'number' &&
        'sessionId' in record && typeof record.sessionId === 'string'
      );
    // ... other message types with strict type checking
    default:
      return false;
  }
}
```

**Validation rules:**
- Messages must be objects with a string `type` field
- Each message type has specific required fields with correct types
- Unknown message types are rejected
- Applied to all messages before calling `onUpdate()`

## Schema Validation for GlobalState

### `validateLayout` (layoutPersistence.ts)

Validates layout data structure before processing:

```typescript
function validateLayout(obj: unknown): obj is LayoutData {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  return true;
}
```

**Applied to:**
- Layout files loaded from disk
- Global state persistence data

### Layout Data Constraints

Layout data is constrained to a specific schema:

```typescript
interface LayoutData {
  version?: number;
  furniturePacks?: Array<{
    id: string;
    name: string;
    uri?: string;
  }>;
  [key: string]: unknown;
}
```

## Atomic Writes for Layout Persistence

### `saveLayout` (layoutPersistence.ts)

Uses atomic write pattern to prevent corruption:

```typescript
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

    fs.writeFileSync(tempFile, content, 'utf-8');  // Write to temp file
    fs.renameSync(tempFile, LAYOUT_FILE);          // Atomic rename
  } catch {
    // Ignore save errors
  }
}
```

**Protection mechanism:**
- Writes to a temporary file first (`layout.tmp`)
- Uses `fs.renameSync` for atomic move to final location
- Ensures the file either exists completely or not at all
- Prevents partial writes from corrupting the layout file

## Security Best Practices Applied

1. **Defense in Depth**: Multiple layers of validation (input parsing, type checking, path validation)
2. **Fail-Safe Defaults**: Invalid data is rejected rather than sanitized
3. **Minimal Trust**: All external data (JSONL files, layout files) is treated as potentially malicious
4. **Type Safety**: TypeScript types enforced at compile time; runtime validation for dynamic data
