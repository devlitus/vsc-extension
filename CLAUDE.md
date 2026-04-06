# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role

Eres el organizador del proyecto. Tu rol es:
- **Nunca escribir código** — ni snippets, ni patches, ni ejemplos inline
- **Sí puedes revisar código** — leer archivos, analizar problemas, señalar qué cambiar y por qué
- **Solo produces documentación** — tareas, planes, decisiones, informes, checklists
- **Organizas el trabajo** — desglosas tareas, priorizas, identificas dependencias, propones estructura de fases

## Build Commands

```bash
bun run build        # Build extension + webview (dist/extension.js + dist/webview/main.js)
bun run build:ext    # Extension only (CJS for Node/VS Code runtime)
bun run build:webview # Webview React bundle only
bun run watch        # Watch mode for both targets
```

## Test Commands

```bash
bun run test          # Run all tests (webview + server)
bun run test:server   # Unit tests in server/__tests__/ (vitest)
bun run test:webview  # Component tests in webview-ui/test/ (vitest + happy-dom)
bun run test:e2e      # End-to-end tests (Playwright)
bun run package       # Package to .vsix for manual install testing
```

## Pre-Deployment Checklist

Before deploying, verify in order:
1. `bun run test` — all tests must pass
2. `bun audit` — no known vulnerabilities
3. `bun run package` — .vsix generates without errors
4. Install .vsix in a clean VS Code instance and follow `docs/MANUAL_TESTING.md`

Full checklist: `PRE_DEPLOYMENT_CHECKLIST.md`

## Bun Usage

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun build` instead of `webpack` or `esbuild`
- Use `bun install` instead of npm/yarn/pnpm
- Bun is **build-only** — VS Code runtime uses Node.js builtins (`fs`, `http`, `crypto`, `path`, `os`)
- No npm packages beyond `react`, `react-dom`, `@types/*` — intentional constraint

## Architecture Overview

**Pixel Agents** is a VS Code extension that visualizes Claude Code agents as characters in a 2D office game engine rendered in a webview.

### Extension Side (`src/`)

`PixelAgentsViewProvider` owns all managers and wires them together:

- **`FileWatcher`** — polls `~/.claude/projects/<project-hash>/<session-uuid>.jsonl` every 500ms, reads new lines via byte offset
- **`AgentManager`** — maintains `Map<id, AgentState>`; agent IDs: positive = terminal agent, negative = subagent
- **`TranscriptParser`** — parses JSONL lines into `WebviewMessage` events
- **`TimerManager`** — 5s permission timeout timers
- **`PixelAgentsServer`** (`src/server/`) — HTTP server on `127.0.0.1:0` (random port), Bearer auth via 32-byte hex token; receives Claude Code hook POSTs at `/api/hooks/:providerId`
- **`claudeHookInstaller`** — reads/writes `~/.claude/settings.json` to install/uninstall curl hooks on server start/stop

### Webview Side (`webview-ui/src/`)

React app running a canvas 2D game engine:

- **`runtime.ts`** — detects VS Code vs browser environment; enables local development via `browserMock.ts`
- **`office/engine/gameLoop.ts`** — `requestAnimationFrame` loop, processes message queue, calls `updateCharacters()` + `render()` each frame
- **`office/engine/characters.ts`** — BFS pathfinding (`bfsPath`), path traversal at 2 tiles/sec, animation state machine
- **`office/engine/renderer.ts`** — canvas 2D: floor tiles, furniture, characters, speech bubbles, matrix rain overlay
- **`office/layout/tileMap.ts`** — 2D grid with bounds-safe get/set, resize, serialize
- **`office/editor/`** — layout editor: tool state, paint/erase/place actions, undo/redo, toolbar React component

### Message Flow

```
JSONL files / HTTP hooks → FileWatcher / PixelAgentsServer
  → AgentManager → WebviewMessage → sanitizeMessage() → webview.postMessage()
    → gameLoop message queue → updateCharacters() → renderer
```

### Key State: `AgentState` (`src/types.ts`)

- `hookDelivered` flag deduplicates `turnEnd` when hook arrives before polling. Reset on `turn.action === 'start'`
- `isWaiting` / `permissionSent` track permission request state
- `activeToolIds`, `activeToolStatuses`, `activeToolNames` track in-flight tools

## Important Paths

| Path | Purpose |
|------|---------|
| `~/.claude/projects/` | Claude Code session JSONL files |
| `~/.claude/settings.json` | Claude Code hooks config (auto-modified) |
| `~/.pixel-agents/server.json` | Hook server config (port, token, pid) |
| `~/.pixel-agents/layout.json` | Persisted office layout |

## VS Code Extension Constraints

- Activation: `onStartupFinished`
- `dispose()` must stop server, uninstall hooks, dispose timers
- `webview.options.enableScripts: true` required; all messages through `sanitizeMessage()` to prevent XSS
- Extension builds as CJS (`--format=cjs`), webview builds as ESM bundle; `vscode` module is external

## Development Phases

Phases tracked in `docs/phases/`: phase-1-skeleton → phase-2-agents → phase-3-hooks → phase-4-movement → phase-5-polish → phase-6-inspection → phase-7-kanban
