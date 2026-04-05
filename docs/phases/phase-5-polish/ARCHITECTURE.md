# Phase 5 — Polish: Architecture

This document describes the architecture of Phase 5: UI components, sub-agent visualization, sound notifications, external asset support, and test/packaging infrastructure.

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Webview (React)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     UI Shell                                  │  │
│  │  BottomToolbar ── ZoomControls ── VersionIndicator            │  │
│  │  SettingsModal ── DebugView ── ChangelogModal                 │  │
│  │  MigrationNotice ── EditActionBar ── Tooltip                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐   │
│  │   notificationSound  │   │   Sub-agent Visualization        │   │
│  │   (Web Audio API)    │   │   (linked characters in engine)  │   │
│  └──────────────────────┘   └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Extension Host                                  │
├─────────────────────────────────────────────────────────────────────┤
│  assetLoader.ts: external directory support                         │
│  PixelAgentsViewProvider: watchAllSessions toggle                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Test Infrastructure                             │
├─────────────────────────────────────────────────────────────────────┤
│  webview-ui/test/ (Vitest) ── server/__tests__/ (Vitest)            │
│  e2e/ (Playwright)                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## UI Components

### BottomToolbar (`components/BottomToolbar.tsx`)

Primary control bar rendered below the canvas:
- **+ Agent** button: sends `launchAgent` message to extension
- **Layout** button: toggles editor mode on/off
- **Right-click menu** on "+ Agent": option to launch with `--dangerously-skip-permissions`

Props: `onAddAgent(bypassPermissions?)`, `onToggleEditor`, `isEditorOpen`

### ZoomControls (`components/ZoomControls.tsx`)

Zoom in / zoom out buttons + current zoom indicator (1×–4×).
Props: `zoom`, `onZoomIn`, `onZoomOut`

### VersionIndicator (`components/VersionIndicator.tsx`)

Small badge in corner showing current extension version. Clicking opens `ChangelogModal`.

### SettingsModal (`components/SettingsModal.tsx`)

Settings panel accessible via gear icon:
- Sound notifications toggle (globalState `soundEnabled`)
- Always show labels toggle (globalState `alwaysShowLabels`)
- Watch all sessions toggle (globalState `watchAllSessions`)
- Hooks enabled toggle — installs/uninstalls Claude Code hooks
- Add Asset Directory: opens native folder picker, adds path to external asset dirs
- Export layout / Import layout (JSON file)
- Debug View toggle

### DebugView (`components/DebugView.tsx`)

Per-agent diagnostic overlay:
- Agent ID, sessionId
- JSONL file path + status (found/not found)
- Lines parsed
- Last data timestamp
- Hook delivered flag

Toggled via SettingsModal. Rendered as an overlay panel inside the webview.

### ChangelogModal (`components/ChangelogModal.tsx`)

Displays changelog entries from `changelogData.ts`. Opens automatically on first launch after version upgrade (last seen version stored in globalState `lastSeenVersion`).

### MigrationNotice (`components/MigrationNotice.tsx`)

One-time banner shown when layout was reset due to a breaking schema migration. Auto-dismissed after 5 seconds or on user click.

### EditActionBar (`components/EditActionBar.tsx`)

Floating action bar shown in editor mode above the canvas:
- Current tool indicator
- Floor color picker (HSB sliders)
- Wall color picker
- Grid size display (WxH)
- Export / Import layout buttons

### Tooltip (`components/Tooltip.tsx`)

Simple hover tooltip component. Used throughout the UI for icon buttons.

## Sub-agent Visualization

When an agent runs the `Task` or `Agent` tool, a sub-agent character is spawned:

```
Extension host (transcriptParser.ts)
    │  subagentToolStart { id, parentToolId, toolId, status }
    ▼
Webview processMessageQueue
    │
    ▼
OfficeState.addSubagent(parentAgentId, toolId)
    │  Create Character with smaller visual indicator
    │  Link to parent character via parentId
    ▼
Renderer draws sub-agent near parent's desk
    │  Connected by a dashed line to parent character
    ▼
On subagentClear / subagentToolDone
    OfficeState.removeSubagent(parentAgentId, toolId)
```

Sub-agents are displayed as smaller versions of the parent character with a link indicator.

## Sound Notifications (`notificationSound.ts`)

Plays a short chime when an agent finishes its turn (status → waiting).

Implementation:
- Uses Web Audio API: `AudioContext.createOscillator()` + `createGain()`
- Two-tone chord (440Hz + 554Hz) with 200ms fade-out
- No external audio files needed
- Guarded by `soundEnabled` globalState
- Silenced if document is not visible (tab inactive)

```typescript
export function playNotificationSound(): void {
  if (!soundEnabled) return;
  const ctx = new AudioContext();
  // ... oscillator setup
}
```

## External Asset Directories

Users can point the extension to external directories containing custom furniture packs.

```
Settings → Add Asset Directory → /path/to/my-furniture-pack/
    │
    ▼
assetLoader.ts: scanExternalDirectory(dirPath)
    │  Read each subfolder
    │  Parse manifest.json
    │  Validate against FurnitureManifest schema
    ▼
Merge with built-in catalog
    │
    ▼
sendAssetsToWebview() — includes external items alongside built-in ones
```

External directory paths are stored in VS Code globalState `externalAssetDirs: string[]`.

Asset manifest format (docs/external-assets.md):
```json
{
  "id": "my-custom-desk",
  "name": "Custom Desk",
  "sprites": ["default.png", "active.png"],
  "rotations": ["n", "e", "s", "w"],
  "states": ["off", "on"],
  "frames": 1,
  "size": { "w": 2, "h": 1 }
}
```

## Watch All Sessions

Optional mode where the extension monitors ALL Claude Code sessions across all project directories (not just the current workspace):

- Toggled via Settings → "Watch All Sessions"
- Stored in globalState `watchAllSessions`
- When enabled: `startExternalSessionScanning()` scans all subdirs of `~/.claude/projects/`
- Each new JSONL file found becomes an external agent
- Stale external agents (JSONL file deleted) pruned by `startStaleExternalAgentCheck()`

## Test Infrastructure

### Webview tests (`webview-ui/test/`, Vitest)

Unit tests for pure functions in the game engine:
- `layoutSerializer.test.ts`: serialize/deserialize round-trips, migration
- `tileMap.test.ts`: get/set/resize
- `characters.test.ts`: BFS pathfinding correctness, state machine transitions
- `editorActions.test.ts`: paint/erase/place/undo/redo purity

Run with: `bun run test:webview`

### Server tests (`server/__tests__/`, Vitest)

Unit tests for hook server logic:
- `hookEventHandler.test.ts`: route PreToolUse/PostToolUse/Stop to correct messages
- `claudeHookInstaller.test.ts`: install/uninstall hooks in settings.json

Run with: `bun run test:server`

### E2E tests (`e2e/`, Playwright)

Full extension integration tests using `@vscode/test-electron`:
- Launch Extension Development Host
- Open terminal with Claude Code
- Verify agent character appears in panel
- Simulate tool execution via JSONL injection
- Verify character animates correctly
- Close terminal, verify agent removed

Run with: `bun run e2e`

## Packaging

### .vscodeignore

Excludes from VSIX package:
- `webview-ui/src/`, `webview-ui/node_modules/`
- `server/src/`, `server/node_modules/`
- `src/` (TypeScript sources)
- `e2e/`, `scripts/`
- Config files: `.eslintrc`, `tsconfig.json`, etc.

### vsce package

```bash
bunx vsce package
```

Produces `pixel-agents-<version>.vsix`. All bundled assets are in `dist/`.

### Build pipeline

```
npm run package
    │
    ├── check-types (tsc --noEmit)
    ├── lint (eslint)
    ├── node esbuild.js --production  ← bundle extension host
    └── build:webview (vite build)    ← bundle webview
```

Output:
- `dist/extension.js` — extension host bundle
- `dist/webview/` — webview bundle (JS + CSS + assets)
- `dist/assets/` — copied pixel art assets (sprites, furniture, etc.)
