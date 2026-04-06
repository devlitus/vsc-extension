# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (both extension and webview)
bun run build

# Build individually
bun run build:ext      # Extension host (Node CJS) → dist/extension.js
bun run build:webview  # Webview (browser bundle) → dist/webview/main.js

# Tests
bun run test                                                      # Run all tests
vitest run --config webview-ui/vitest.config.ts webview-ui/test  # Webview tests only
vitest run --config server/vitest.config.ts server/__tests__      # Server tests only

# Package
vsce package   # Produces work-agents-*.vsix
```

To run a single test file: `vitest run --config server/vitest.config.ts server/__tests__/agentManager.test.ts`

## Architecture Overview

**Work Agents** is a VS Code extension that renders a live pixel-art office view of running Claude Code agents. There are three distinct runtimes:

### 1. Extension host (`src/`)
Runs in Node.js inside VS Code. Entry point: `src/extension.ts`.

- **`PixelAgentsViewProvider`** — Central orchestrator. Owns the webview, instantiates all services, routes messages between extension and webview.
- **`FileWatcher`** — Polls `~/.claude/projects/**/*.jsonl` every 500ms. Discovers Claude terminals via `vscode.window.onDidOpenTerminal` (name `'claude'`). Reads new JSONL lines incrementally using byte offsets.
- **`TranscriptParser`** (`processTranscriptLine`) — Parses Claude's JSONL transcript format (old v1 `type: 'tool'/'turn'/'system'` and new v2 `type: 'assistant'/'user'/'permission-mode'`) into typed `WebviewMessage` events.
- **`AgentManager`** — In-memory store of `AgentState` objects, keyed by integer id. Positive ids = terminal-attached agents, negative = external/watch-all sessions.
- **`PixelAgentsServer`** — Minimal HTTP server (`127.0.0.1:0`) that receives real-time hook POSTs from Claude Code. Config written to `~/.pixel-agents/server.json`. Auth via random 32-byte Bearer token.
- **`claudeHookInstaller`** — Writes/removes `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop` hook entries in `~/.claude/settings.json`. Each hook runs an inline curl command.

**Data flow (file-poll path):**
```
JSONL file → FileWatcher.readNewLines → processTranscriptLine → AgentUpdateCallback → PixelAgentsViewProvider.onAgentUpdate → webview.postMessage
```

**Data flow (hook path):**
```
Claude hook → curl POST → PixelAgentsServer → handleHookEvent → AgentUpdateCallback → webview.postMessage
```

### 2. Webview (`webview-ui/src/`)
Runs in the browser sandbox. Entry: `webview-ui/src/main.tsx` → `App.tsx`.

React is used only for the UI chrome (toolbars, modals, kanban). The main visual is a **canvas game loop** (`office/engine/`).

- **`gameLoop.ts`** — `requestAnimationFrame` loop. Calls `processMessageQueue` each frame to consume `WebviewMessage` events from the extension, then `updateCharacters`, then `render`.
- **`officeState.ts`** — Plain-data state object: characters (agents), subagents, seats, layout, tileMap, zoom/pan.
- **`renderer.ts`** — Canvas 2D rendering. Draws floor/wall tiles, furniture (now via Kenney sprites), characters (still canvas 2D pixel art), speech bubbles, subagent links.
- **`characters.ts`** — BFS pathfinding, character movement and animation updates.
- **`sprites/kenneySprites.ts`** — Kenney roguelike-indoors tileset. `initTileset(uri)` loads the PNG; `drawKenneyTile(ctx, TILES.x, gx, gy)` draws a 16×16 tile. Tileset URI flows: `assetLoader.ts` → `assetsLoaded` message → `App.tsx` intercepts and enqueues `tilesetReady` → `gameLoop.ts` calls `initTileset`.
- **`sprites/spriteData.ts`** — Defines `SPRITE_TILE_SIZE = 16` (used everywhere) and animation frames.

**Message routing in `App.tsx`:**
Some messages are handled directly by React state setters (settings, inspection panel, kanban). Everything else is passed to `enqueueMessage()` for the game loop. The `assetsLoaded` message is intercepted to extract `tilesetUri` and enqueue `tilesetReady` instead.

### 3. Server tests (`server/__tests__/`)
Test files for extension-host code. Use vitest with a Node environment (no DOM).

## Key constraints

- **CSP**: Webview CSP allows `img-src ${webview.cspSource}`. Images must be loaded via `webview.asWebviewUri()` — never `file://` or absolute paths.
- **No `media/` in `.vscodeignore`**: Static assets in `media/` are included in the VSIX package. The Kenney tileset lives at `media/kenney_tileset.png`.
- **Security**: All strings going into the webview are sanitized through `sanitizeMessage`. Prototype pollution protection is applied in `transcriptParser.ts` (`deepCloneWithProtection`) and `assetLoader.ts`.
- **Character rendering**: Characters (agents) are drawn with canvas 2D pixel art — do not replace with sprites as Kenney tiles have no human figures.
- **Agent ID sign convention**: Positive IDs = terminal-attached agents; negative IDs = external "watch-all" sessions.
