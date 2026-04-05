# Phase 2 — Agents: Tasks

## Tasks

- [x] 1. Create src/types.ts
  1. Define AgentState interface with all fields
  2. Define PersistedAgent interface with all fields
  3. Types for terminalRef, sets and maps

- [x] 2. Create src/constants.ts
  1. POLL_INTERVAL_MS = 500
  2. READ_CHUNK_BYTES = 65536
  3. IDLE_THRESHOLD_MS = 5000
  4. PERMISSION_TIMEOUT_MS = 5000
  5. CLEAR_COOLDOWN_MS = 3000
  6. EXTERNAL_SCAN_DELAY_TICKS = 2
  7. COMMAND_SHOW_PANEL
  8. COMMAND_EXPORT_DEFAULT_LAYOUT
  9. PERMISSION_EXEMPT_TOOLS Set

- [x] 3. Create src/transcriptParser.ts
  1. Implement processTranscriptLine(line, agent, postMessage)
  2. Parse JSON, ignore errors
  3. Handle record.type === 'assistant' → toolStart
  4. Handle record.type === 'tool_result' → toolEnd
  5. Handle record.type === 'system' && subtype === 'turn_duration' → turnEnd
  6. Handle record.type === 'system' && subtype === 'progress' → toolProgress
  7. Implement formatToolStatus(toolName, input)

- [x] 4. Create src/timerManager.ts
  1. Implement TimerManager class
  2. startPermissionTimer(agentId, onTimeout, ms)
  3. cancelTimer(agentId)
  4. disposeAll()

- [x] 5. Create src/fileWatcher.ts
  1. Define AgentUpdateCallback type
  2. Implement FileWatcher class
  3. start(projectDirs, onAgentUpdate)
  4. stop()
  5. Polling loop every POLL_INTERVAL_MS
  6. Scan ~/.claude/projects/ for *.jsonl files
  7. Read from fileOffset with buffer for partial lines
  8. Adopt new files as external agents
  9. Detect /clear with </command-name>
  10. Listen to onDidOpenTerminal and onDidCloseTerminal
  11. Associate terminals with "claude" in their name

- [x] 6. Create src/agentManager.ts
  1. Implement AgentManager class
  2. createAgent(sessionId, jsonlFile, projectDir, terminal?)
  3. removeAgent(id)
  4. getAgent(id)
  5. getAllAgents()
  6. Positive IDs for terminals, negative for sub-agents

- [x] 7. Create src/configPersistence.ts
  1. saveAgents(context, agents)
  2. loadAgents(context)
  3. Use context.globalState

- [x] 8. Create src/layoutPersistence.ts
  1. saveLayout(layout)
  2. loadLayout()
  3. Use ~/.pixel-agents/layout.json

- [x] 9. Create src/assetLoader.ts
  1. Define AssetManifest type
  2. getAssetUris(webview, extensionUri)
  3. Load from dist/assets/ and external directories

- [x] 10. Update PixelAgentsViewProvider.ts
  1. Instantiate FileWatcher, AgentManager, TimerManager
  2. Pass postMessage to FileWatcher
  3. In dispose(): stop FileWatcher, clear timers
  4. Forward messages to webview according to protocol

- [x] 11. Define webview message types
  1. agentAdded
  2. agentRemoved
  3. toolStart
  4. toolEnd
  5. toolProgress
  6. turnEnd
  7. permissionRequest
  8. layoutLoaded
  9. assetsLoaded

- [x] 12. Verify build
  1. bun run build without errors
  2. TypeScript without type errors

- [x] 13. Verify runtime
  1. Open terminal with Claude Code
  2. Webview receives agentAdded
  3. Run a tool → toolStart
  4. Complete turn → turnEnd
