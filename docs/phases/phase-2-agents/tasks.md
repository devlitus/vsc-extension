# Phase 2 — Agents: Tasks

## Tasks

- [x] 1. Crear src/types.ts
  1. Definir AgentState interface con todos los campos
  2. Definir PersistedAgent interface con todos los campos
  3. Tipos para terminalRef, sets y maps

- [x] 2. Crear src/constants.ts
  1. POLL_INTERVAL_MS = 500
  2. READ_CHUNK_BYTES = 65536
  3. IDLE_THRESHOLD_MS = 5000
  4. PERMISSION_TIMEOUT_MS = 5000
  5. CLEAR_COOLDOWN_MS = 3000
  6. EXTERNAL_SCAN_DELAY_TICKS = 2
  7. COMMAND_SHOW_PANEL
  8. COMMAND_EXPORT_DEFAULT_LAYOUT
  9. PERMISSION_EXEMPT_TOOLS Set

- [x] 3. Crear src/transcriptParser.ts
  1. Implementar processTranscriptLine(line, agent, postMessage)
  2. Parsear JSON, ignorar errores
  3. Manejar record.type === 'assistant' → toolStart
  4. Manejar record.type === 'tool_result' → toolEnd
  5. Manejar record.type === 'system' && subtype === 'turn_duration' → turnEnd
  6. Manejar record.type === 'system' && subtype === 'progress' → toolProgress
  7. Implementar formatToolStatus(toolName, input)

- [x] 4. Crear src/timerManager.ts
  1. Implementar clase TimerManager
  2. startPermissionTimer(agentId, onTimeout, ms)
  3. cancelTimer(agentId)
  4. disposeAll()

- [x] 5. Crear src/fileWatcher.ts
  1. Definir AgentUpdateCallback type
  2. Implementar clase FileWatcher
  3. start(projectDirs, onAgentUpdate)
  4. stop()
  5. Loop de polling cada POLL_INTERVAL_MS
  6. Escanear ~/.claude/projects/ para *.jsonl
  7. Leer desde fileOffset con buffer para líneas parciales
  8. Adoptar nuevos archivos como agentes externos
  9. Detectar /clear con </command-name>
  10. Escuchar onDidOpenTerminal y onDidCloseTerminal
  11. Asociar terminales con "claude" en el nombre

- [x] 6. Crear src/agentManager.ts
  1. Implementar clase AgentManager
  2. createAgent(sessionId, jsonlFile, projectDir, terminal?)
  3. removeAgent(id)
  4. getAgent(id)
  5. getAllAgents()
  6. IDs positivos para terminales, negativos para sub-agentes

- [x] 7. Crear src/configPersistence.ts
  1. saveAgents(context, agents)
  2. loadAgents(context)
  3. Usar context.globalState

- [x] 8. Crear src/layoutPersistence.ts
  1. saveLayout(layout)
  2. loadLayout()
  3. Usar ~/.pixel-agents/layout.json

- [x] 9. Crear src/assetLoader.ts
  1. Definir AssetManifest type
  2. getAssetUris(webview, extensionUri)
  3. Cargar desde dist/assets/ y directorios externos

- [x] 10. Actualizar PixelAgentsViewProvider.ts
  1. Instanciar FileWatcher, AgentManager, TimerManager
  2. Pasar postMessage al FileWatcher
  3. En dispose(): detener FileWatcher, limpiar timers
  4. Reenviar mensajes al webview según protocolo

- [x] 11. Definir tipos de mensajes webview
  1. agentAdded
  2. agentRemoved
  3. toolStart
  4. toolEnd
  5. toolProgress
  6. turnEnd
  7. permissionRequest
  8. layoutLoaded
  9. assetsLoaded

- [x] 12. Verificar compilación
  1. bun run build sin errores
  2. TypeScript sin errores de tipos

- [x] 13. Verificar runtime
  1. Abrir terminal con Claude Code
  2. Webview recibe agentAdded
  3. Ejecutar herramienta → toolStart
  4. Completar turno → turnEnd
