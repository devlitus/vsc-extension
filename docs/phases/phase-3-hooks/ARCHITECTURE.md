# Phase 3 — Hooks: Architecture

## Overview

The Hooks system implements an HTTP server that receives synchronous events from Claude Code hooks, complementing the JSONL polling-based detection for more reliable turn-end detection and permission notifications.

## Components

### 1. PixelAgentsServer (`src/server/server.ts`)

HTTP server binding to `127.0.0.1:0` (OS-assigned port).

**Endpoints:**
- `POST /api/hooks/:providerId` — Receives hook events
- `GET /api/health` — Returns `{ uptime, pid }`

**Security:**
- Bearer token auth with `crypto.timingSafeEqual`
- ProviderId validated against regex
- Body size limited to 64KB
- Request timeout: 10s

**Config:** `~/.pixel-agents/server.json` (mode 0o600)

### 2. HookEventHandler (`src/server/hookEventHandler.ts`)

Routes hook events to webview messages:

| Hook Event | Webview Message |
|------------|-----------------|
| PreToolUse | permissionRequest |
| PostToolUse | toolEnd |
| Stop/SubagentStop | turnEnd (source: 'hook') |

### 3. ClaudeHookInstaller (`src/server/providers/file/claudeHookInstaller.ts`)

Manages hooks in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "..." }] }],
    "PostToolUse": [...],
    "Stop": [...],
    "SubagentStop": [...]
  }
}
```

Uses atomic writes (temp + rename) to prevent corruption.

### 4. Hook Script (`src/server/providers/file/hooks/claude-hook.ts`)

Generated inline shell script:
```bash
#!/bin/bash
set -e
exec curl -s -X POST http://127.0.0.1:<port>/api/hooks/claude \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @-
```

## Data Flow

```
Claude Code
    │
    │ Hook event (stdin → curl POST)
    ▼
PixelAgentsServer (127.0.0.1:0)
    │
    │ validateHookEvent() + timingSafeEqual auth
    ▼
handleHookEvent()
    │
    │ Find agent by sessionId
    ▼
onAgentUpdate() → Webview
```

## Coordination with Polling

The `hookDelivered` flag on `AgentState` prevents duplicate `turnEnd` emissions:

1. Hook delivers `Stop` event → `hookDelivered = true` → webview receives `turnEnd`
2. JSONL polling sees `turn` record with `action: 'end'`
3. Polling checks `hookDelivered` — if true, skips emitting `turnEnd`
4. At next `turn.action === 'start'`, `hookDelivered` is reset

## Security Considerations

- Server binds to localhost only (not exposed externally)
- Config files use restrictive permissions (0o700/0o600)
- Atomic writes prevent config corruption
- Timing-safe token comparison prevents attacks
- Input validation on all user-controlled fields

## Multi-Window Support

When multiple VS Code windows open:
1. First window starts server, writes PID to config
2. Subsequent windows call `findExisting()` to get port/token
3. If PID is dead, new server starts fresh
