# Phase 5 — Polish: Tasks

## Tasks

- [ ] 1. Create webview-ui/src/components/Tooltip.tsx
  1. Props: `children`, `text: string`, `position?: 'top' | 'bottom' | 'left' | 'right'`
  2. Show tooltip on hover with 400ms delay
  3. Pure CSS, no external dependencies

- [ ] 2. Create webview-ui/src/components/ZoomControls.tsx
  1. `+` and `-` buttons for zoom in/out
  2. Show current level: "2×"
  3. Props: `zoom: number`, `onZoomIn: () => void`, `onZoomOut: () => void`
  4. Disable `+` at max zoom (4×), `-` at min zoom (1×)

- [ ] 3. Create webview-ui/src/components/VersionIndicator.tsx
  1. Read version from `EXTENSION_VERSION` constant (injected at build time)
  2. Clickable badge in the bottom-right corner
  3. On click: open `ChangelogModal`
  4. Show visual indicator if new version is available (compare with `lastSeenVersion` globalState)

- [ ] 4. Create webview-ui/src/changelogData.ts
  1. Array of entries `{ version, date, changes: string[] }`
  2. Include at least the current version entry

- [ ] 5. Create webview-ui/src/components/ChangelogModal.tsx
  1. Modal with dark overlay
  2. List changelog entries from `changelogData.ts`
  3. Highlight current version in the list
  4. Close button (X) and click-on-overlay to close
  5. Props: `isOpen`, `onClose`

- [ ] 6. Create webview-ui/src/components/MigrationNotice.tsx
  1. Yellow banner at the top of the canvas
  2. Text: "Layout was reset due to a format update"
  3. Auto-dismiss after 5s with `setTimeout`
  4. X button for manual dismiss
  5. Props: `visible`, `onDismiss`

- [ ] 7. Create webview-ui/src/components/DebugView.tsx
  1. Overlay panel positioned top-right, semi-transparent background
  2. Per agent: show id, sessionId (truncated), jsonlFile (basename only)
  3. Show status: "JSONL found" / "JSONL not found"
  4. Show `linesProcessed` and `lastDataAt` (relative time: "2s ago")
  5. Show `hookDelivered` flag
  6. Props: `agents: DebugAgentInfo[]`

- [ ] 8. Create webview-ui/src/components/EditActionBar.tsx
  1. Floating bar visible only in editor mode
  2. Floor color picker (HSB sliders: hue 0–360, saturation 0–100, brightness 0–100)
  3. Wall color picker (same scheme)
  4. Show current grid dimensions (e.g. "20×15")
  5. Export layout button → `postMessage({ type: 'exportLayout' })`
  6. Import layout button → hidden file input + click trigger

- [ ] 9. Create webview-ui/src/components/SettingsModal.tsx
  1. Open from gear button in BottomToolbar
  2. Toggle "Sound notifications" — postMessage `setSetting { key: 'soundEnabled', value }`
  3. Toggle "Always show labels" — postMessage `setSetting { key: 'alwaysShowLabels', value }`
  4. Toggle "Watch all sessions" — postMessage `setSetting { key: 'watchAllSessions', value }`
  5. Toggle "Hooks enabled" — postMessage `setHooksEnabled { enabled }` (installs/uninstalls hooks)
  6. Button "Add Asset Directory" — postMessage `addAssetDirectory`, extension opens native picker
  7. Show list of added external directories, with X button to remove each
  8. Button "Export layout as default" — postMessage `exportDefaultLayout`
  9. Toggle "Debug View" — controls visibility of `DebugView`
  10. Info: show hook server port if active

- [ ] 10. Create webview-ui/src/components/BottomToolbar.tsx
  1. Button "+ Agent" — postMessage `launchAgent { bypassPermissions: false }`
  2. Right-click (contextmenu) on "+ Agent" — show menu with option "Launch (skip permissions)" → `launchAgent { bypassPermissions: true }`
  3. Button "Layout" — toggle editor mode, change icon based on state
  4. Gear button — open `SettingsModal`
  5. Integrate `ZoomControls` on the right side
  6. Integrate `VersionIndicator`

- [ ] 11. Create webview-ui/src/notificationSound.ts
  1. Implement `playNotificationSound(): void` using Web Audio API
  2. Create `AudioContext` lazily (only when needed, to avoid autoplay policy)
  3. Two oscillators: 440Hz + 554Hz, OscillatorType `sine`
  4. GainNode with exponential fade-out over 200ms
  5. Check `document.visibilityState === 'visible'` before playing
  6. Do nothing if `soundEnabled` is false

- [ ] 12. Implement sub-agent visualization in engine
  1. In `officeState.ts`: add `subagents: Map<string, SubagentCharacter>` keyed by `"<agentId>:<toolId>"`
  2. `SubagentCharacter`: position near parent, visual state (animating/idle), linkedToParentId
  3. In `processMessageQueue`: handle `subagentToolStart` → `addSubagent()`, `subagentToolDone`/`subagentClear` → `removeSubagent()`
  4. In `renderer.ts`: draw sub-agents at 0.75× scale of the main character
  5. In `renderer.ts`: draw a dashed line from sub-agent to parent

- [ ] 13. Implement external asset directory support in assetLoader.ts
  1. Add `externalAssetDirs: string[]` to provider state (loaded from globalState)
  2. Implement `scanExternalDirectory(dirPath, webview, extensionUri): Promise<LoadedAssets>`
  3. For each subdirectory in `dirPath`: look for `manifest.json`, parse, validate required fields
  4. Use `webview.asWebviewUri()` only for assets within extensionUri; for external ones, read as bytes and convert to data URIs
  5. Implement `mergeLoadedAssets(base, extra): LoadedAssets` without overwriting existing IDs
  6. Handle `addAssetDirectory` message from webview: open `vscode.window.showOpenDialog`, save to globalState

- [ ] 14. Implement watchAllSessions in fileWatcher.ts
  1. Implement `startExternalSessionScanning(projectsRoot, knownFiles, ...)` — scan all subdirs of `~/.claude/projects/`
  2. Each new unknown JSONL → create external agent
  3. Implement `startStaleExternalAgentCheck(agents, ...)` — every 30s, remove external agents whose JSONL no longer exists on disk
  4. Controlled by `watchAllSessions.current: boolean` flag
  5. On toggle off: stop scanning and keep existing agents until they finish

- [ ] 15. Add global settings persistence in PixelAgentsViewProvider.ts
  1. On receiving `setSetting`: save to `context.globalState`, forward to webview if relevant
  2. On receiving `setHooksEnabled { enabled }`:
     - If true: `installHooks(server.port, server.token)`
     - If false: `uninstallHooks()`
     - Save to globalState `hooksEnabled`
  3. On startup: read all settings from globalState and send them to webview in a `settingsLoaded` message
  4. On version upgrade detection (`lastSeenVersion !== currentVersion`): send `versionUpgraded` to webview

- [ ] 16. Write webview tests (Vitest)
  1. Create `webview-ui/test/layoutSerializer.test.ts`
     - Round-trip: serialize → deserialize → equals original
     - Migration: layout without version field migrates correctly
     - Prototype pollution: `{"__proto__":{"x":1}}` does not contaminate Object.prototype
  2. Create `webview-ui/test/tileMap.test.ts`
     - get/set return the correct value
     - set out-of-bounds does not throw
     - resize preserves existing tiles
     - toArray/fromArray round-trip
  3. Create `webview-ui/test/characters.test.ts`
     - BFS finds path in open grid
     - BFS returns [] when no path exists (full obstacles)
     - BFS does not pass through obstacles
     - State machine: setCharacterTool('Write') → state 'type'
     - State machine: setCharacterTool('Read') → state 'read'
     - State machine: clearCharacterTools → state 'idle'
  4. Create `webview-ui/test/editorActions.test.ts`
     - paintTile returns new layout with modified tile (immutability)
     - eraseTile sets 'empty'
     - undo/redo cycle is correct
     - redo stack cleared after new action

- [ ] 17. Write server tests (Vitest)
  1. Create `server/__tests__/hookEventHandler.test.ts`
     - PreToolUse with known sessionId → calls callback with permissionRequest
     - Stop with known sessionId → calls callback with turnEnd and hookDelivered=true
     - Event with unknown sessionId → does not call callbacks
  2. Create `server/__tests__/claudeHookInstaller.test.ts`
     - installHooks writes hooks to settings.json correctly
     - installHooks is idempotent (second call does not duplicate)
     - uninstallHooks removes only pixel-agents hooks
     - Atomic write: uses .tmp file + rename

- [ ] 18. Write E2E tests with Playwright
  1. Create `e2e/playwright.config.ts` with `@vscode/test-electron`
  2. Create `e2e/basic.test.ts`:
     - Verify Pixel Agents panel appears
     - Click "+ Agent" → terminal opens with command `claude --session-id ...`
     - Inject a JSONL line of type `assistant` with tool_use → verify `agentToolStart` message in webview
     - Inject `system.turn_duration` → verify `agentStatus: waiting`
  3. Create `e2e/layout.test.ts`:
     - Open editor → paint tile → close editor → reopen → tile persists

- [ ] 19. Create scripts/asset-manager.html
  1. Standalone HTML (no server) for editing furniture manifests
  2. Form fields: id, name, sprites[], rotations[], states[], frames, size.w, size.h
  3. Preview of selected PNG sprite
  4. Button "Export manifest.json" that generates the JSON and downloads it
  5. Button "Import manifest.json" to edit an existing manifest

- [ ] 20. Configure .vscodeignore and packaging
  1. Exclude: `src/`, `webview-ui/src/`, `webview-ui/node_modules/`, `server/src/`, `server/node_modules/`
  2. Exclude: `e2e/`, `scripts/`, `docs/`
  3. Exclude: config files (tsconfig, eslint, prettier, etc.)
  4. Include: `dist/`, `shared/assets/`, `icon.png`, `README.md`, `CHANGELOG.md`, `LICENSE`
  5. Verify with `bunx vsce ls` that only necessary files are included

- [ ] 21. Verify build and tests
  1. `bun run build` without errors
  2. `bun run test` passes (webview + server)
  3. `bun run e2e` passes
  4. `bunx vsce package` generates .vsix without errors
  5. Install .vsix in real VS Code and verify full functionality

- [ ] 22. Add context indicator (tokens) per agent
  1. In `transcriptParser.ts`: extract `contextUsed` and `contextMax` from the `system.turn_duration` record (fields `input_tokens`, `cache_read_input_tokens` and `context_window` or equivalent)
  2. In `agentManager.ts`: add `contextUsed?: number` and `contextMax?: number` fields to `AgentState` and update them on each `turnEnd`
  3. In the webview: show a progress bar below each character proportional to usage (0–100%)
  4. Change color by threshold: green < 60%, yellow 60–85%, red > 85%
  5. Hide if `contextMax` is not available (compatibility with models that do not provide this info)
  6. Transmit `contextUsed` and `contextMax` in the `turnEnd` message to the webview

- [ ] 23. Add rate limit indicator per agent
  1. Detect rate limit responses in the transcript (record with error type `rate_limit` or similar)
  2. Show an "energy" bar below the character, distinct from the context bar
  3. Animate character in `sleeping` state (ZZZ speech bubble) while rate-limited
  4. Auto-recovery when next activity is received from the agent

- [ ] 24. Verify full runtime
  1. Launch agent → character appears and walks to its desk
  2. Run tool → correct animation (type/read depending on tool)
  3. Turn end → "waiting" speech bubble + notification chime if sound is enabled
  4. Permission required → permission speech bubble
  5. Sub-agent (Task tool) → secondary character appears linked to parent
  6. Editor: paint floor/wall, place furniture, undo/redo, export/import JSON
  7. Settings: toggles persist after closing and reopening VS Code
  8. External asset dir: furniture from external directory appears in editor catalog
  9. Debug view: shows correct info per agent
  10. VersionIndicator: opens changelog, marks current version
