# Agents.md

## Build Commands

```bash
bun run build        # Builds extension.js + webview/main.js
bun run build:ext    # Build extension only
bun run build:webview # Build webview only
```

- `dist/extension.js` — VS Code extension entry point
- `dist/webview/main.js` — Webview UI bundle
- No test suite exists yet

## Project Structure

```
src/
  extension.ts          # activate()/deactivate() — VS Code entry
  PixelAgentsViewProvider.ts  # Main view provider, owns all managers
  agentManager.ts        # Manages AgentState map by id
  fileWatcher.ts        # Polls ~/.claude/projects/*.jsonl every 500ms
  transcriptParser.ts   # Parses JSONL lines → WebviewMessage
  timerManager.ts       # Permission timeout timers
  types.ts              # AgentState, WebviewMessage, AgentUpdateCallback
  constants.ts          # Intervals, timeouts, permission-exempt tools
  server/               # Phase 3: HTTP hook server
    server.ts           # PixelAgentsServer (127.0.0.1:0, Bearer auth)
    hookEventHandler.ts # Routes hook events to webview messages
    constants.ts        # Server-specific constants
    types.ts            # HookEvent, ServerConfig interfaces
    providers/file/
      claudeHookInstaller.ts  # Reads/writes ~/.claude/settings.json
      hooks/claude-hook.ts    # Generates inline curl hook script
webview-ui/src/main.tsx  # React webview entry
```

## Key Architecture Facts

- **Agent identification**: Agents tracked by `sessionId` in JSONL + `id` (positive=terminal, negative=subagent)
- **turnEnd deduplication**: `hookDelivered` flag prevents duplicate turnEnd when hooks deliver first. Reset at `turn.action === 'start'`
- **turnEnd source tracking**: `turnEnd` messages include `source?: 'hook' | 'polling'`
- **Permission timeout**: 5s (`PERMISSION_TIMEOUT_MS`) via TimerManager
- **File watching**: Scans `~/.claude/projects/` every `POLL_INTERVAL_MS` (500ms)

## Important Paths

| Path | Purpose |
|------|---------|
| `~/.claude/projects/` | Claude Code session JSONL files |
| `~/.claude/settings.json` | Claude Code hooks config |
| `~/.pixel-agents/server.json` | Hook server config (port, token, pid) |
| `~/.pixel-agents/layout.json` | Persisted panel layout |

## VS Code Extension Constraints

- Activation: `onStartupFinished` (not `*`)
- ExtensionContext required for webview, assets, globalState
- `dispose()` must stop server, uninstall hooks, dispose timers

## Runtime Dependencies

- **No npm packages** beyond react/react-dom/@types/* — uses Node.js builtins (fs, http, crypto, path, os)
- Bun for build only; VS Code runtime uses Node.js

## Phase Phases

This repo implements phases. See `docs/phases/`:
- phase-1-skeleton — Initial structure
- phase-2-agents — JSONL polling, AgentManager, FileWatcher
- phase-3-hooks — HTTP server for Claude Code hooks
- phase-4-movement, phase-5-polish — (future)
```