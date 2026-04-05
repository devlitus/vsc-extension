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
webview-ui/src/         # Phase 4: Game engine webview
  main.tsx              # React entry point
  App.tsx               # Main React component
  runtime.ts            # Environment detector (VS Code vs browser)
  vscodeApi.ts          # VS Code API wrapper (acquireVsCodeApi)
  browserMock.ts        # Browser mock for local development
  office/               # Office game engine
    types.ts            # Position, Character, TileType, OfficeLayout
    sprites/            # Sprite management and animation definitions
      index.ts          # Sprite exports and ANIMATIONS constant
      spriteCache.ts    # Image loading and caching
      spriteData.ts     # Sprite metadata and URLs
    layout/             # Office layout and tiles
      tileMap.ts        # TileMap class (2D grid, get/set, resize)
      furnitureCatalog.ts # Furniture item definitions
      layoutSerializer.ts # Layout JSON serialization
    engine/             # Core game engine
      gameLoop.ts       # requestAnimationFrame loop, message queue
      characters.ts     # Character movement, BFS pathfinding, states
      officeState.ts    # OfficeState interface, character CRUD
      renderer.ts       # Canvas 2D rendering
      matrixEffect.ts   # Matrix rain background effect
    editor/             # Layout editor UI
      editorState.ts    # Editor state (tool, selection, history)
      editorActions.ts  # Editor actions (paint, erase, place)
      EditorToolbar.tsx # Toolbar React component
    floorTiles.ts       # Floor tile definitions
    wallTiles.ts        # Wall tile definitions
    colorize.ts         # Sprite palette colorization utilities
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
- phase-4-movement — Game engine, character movement, pathfinding, renderer
- phase-5-polish — (future)

## Game Engine Architecture (Phase 4)

### Core Types (`office/types.ts`)

| Type | Description |
|------|-------------|
| `Position` | `{x, y}` tile coordinates |
| `Character` | Agent avatar with position, path, state, animation |
| `CharacterState` | `'idle' \| 'walk' \| 'type' \| 'read' \| 'waiting'` |
| `TileType` | `'empty' \| 'floor' \| 'wall'` |
| `OfficeLayout` | Full office: width, height, tiles[][], furniture, seats |

### Game Loop (`office/engine/gameLoop.ts`)

- Uses `requestAnimationFrame` for smooth 60fps rendering
- Processes a message queue for incoming events (agentAdded, turnEnd, permissionRequest, toolStart, toolEnd)
- Calls `updateCharacters()` then `render()` each frame
- Returns a cleanup function to stop the loop

### Character Movement (`office/engine/characters.ts`)

- **BFS pathfinding**: `bfsPath(tileMap, from, to)` returns `Position[]` or `[]` if unreachable
- Path traversal at `WALK_SPEED = 2` tiles/second
- Facing direction updated based on movement axis (horizontal takes precedence)
- Animation state machine: `walk-${facingDir}` or `idle` fallback

### Rendering (`office/engine/renderer.ts`)

- Canvas 2D rendering with zoom/pan transform
- Renders floor tiles, furniture, characters, speech bubbles
- Matrix rain effect overlay

### Tile Map (`office/layout/tileMap.ts`)

- 2D grid with `get(x, y)` / `set(x, y, type)` accessors
- Bounds-safe (returns `'empty'` for out-of-range)
- `resize()`, `clear()`, `toArray()`, `fromArray()` methods

### VS Code API Abstraction (`runtime.ts`)

| Function | VS Code Mode | Browser Mode |
|----------|-------------|--------------|
| `postMessage()` | `vscode.postMessage()` | `console.log()` |
| `getState()` | `vscode.getState()` | `{}` |
| `onMessage()` | (from browserMock) | registers handler |

- `runtime.init()` detects environment via `window.acquireVsCodeApi`
- Enables local browser development without VS Code

### Editor State (`office/editor/`)

- `EditorTool`: `'select' \| 'paint' \| 'erase' \| 'place' \| 'eyedropper' \| 'pick'`
- `editorState.ts`: Current tool, selection, undo/redo history
- `editorActions.ts`: Paint tiles, place furniture, erase operations
```