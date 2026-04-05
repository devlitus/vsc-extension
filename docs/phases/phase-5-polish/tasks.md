# Phase 5 — Polish: Tasks

## Tasks

- [ ] 1. Crear webview-ui/src/components/Tooltip.tsx
  1. Props: `children`, `text: string`, `position?: 'top' | 'bottom' | 'left' | 'right'`
  2. Mostrar tooltip en hover con delay de 400ms
  3. CSS puro, sin dependencias externas

- [ ] 2. Crear webview-ui/src/components/ZoomControls.tsx
  1. Botones `+` y `-` para zoom in/out
  2. Mostrar nivel actual: "2×"
  3. Props: `zoom: number`, `onZoomIn: () => void`, `onZoomOut: () => void`
  4. Deshabilitar `+` en zoom máximo (4×), `-` en zoom mínimo (1×)

- [ ] 3. Crear webview-ui/src/components/VersionIndicator.tsx
  1. Leer versión desde constante `EXTENSION_VERSION` (inyectada en build)
  2. Badge clickeable en esquina inferior derecha
  3. Al click: abrir `ChangelogModal`
  4. Mostrar indicador visual si hay versión nueva (comparar con `lastSeenVersion` globalState)

- [ ] 4. Crear webview-ui/src/changelogData.ts
  1. Array de entradas `{ version, date, changes: string[] }`
  2. Incluir al menos la entrada de la versión actual

- [ ] 5. Crear webview-ui/src/components/ChangelogModal.tsx
  1. Modal con overlay oscuro
  2. Listar entradas de changelog desde `changelogData.ts`
  3. Resaltar la versión actual en la lista
  4. Botón cerrar (X) y click en overlay para cerrar
  5. Props: `isOpen`, `onClose`

- [ ] 6. Crear webview-ui/src/components/MigrationNotice.tsx
  1. Banner amarillo en la parte superior del canvas
  2. Texto: "Layout was reset due to a format update"
  3. Auto-dismissal después de 5s con `setTimeout`
  4. Botón X para dismiss manual
  5. Props: `visible`, `onDismiss`

- [ ] 7. Crear webview-ui/src/components/DebugView.tsx
  1. Panel overlay posicionado arriba-derecha, fondo semitransparente
  2. Por cada agente: mostrar id, sessionId (truncado), jsonlFile (solo basename)
  3. Mostrar status: "JSONL found" / "JSONL not found"
  4. Mostrar `linesProcessed` y `lastDataAt` (tiempo relativo: "2s ago")
  5. Mostrar `hookDelivered` flag
  6. Props: `agents: DebugAgentInfo[]`

- [ ] 8. Crear webview-ui/src/components/EditActionBar.tsx
  1. Barra flotante visible solo en modo editor
  2. Color picker de floor (HSB sliders: hue 0-360, saturation 0-100, brightness 0-100)
  3. Color picker de wall (mismo esquema)
  4. Mostrar dimensiones actuales del grid (ej: "20×15")
  5. Botón Export layout → `postMessage({ type: 'exportLayout' })`
  6. Botón Import layout → input file invisible + click trigger

- [ ] 9. Crear webview-ui/src/components/SettingsModal.tsx
  1. Abrirse desde botón de engranaje en BottomToolbar
  2. Toggle "Sound notifications" — postMessage `setSetting { key: 'soundEnabled', value }`
  3. Toggle "Always show labels" — postMessage `setSetting { key: 'alwaysShowLabels', value }`
  4. Toggle "Watch all sessions" — postMessage `setSetting { key: 'watchAllSessions', value }`
  5. Toggle "Hooks enabled" — postMessage `setHooksEnabled { enabled }` (instala/desinstala hooks)
  6. Botón "Add Asset Directory" — postMessage `addAssetDirectory`, la extension abre picker nativo
  7. Mostrar lista de directorios externos añadidos, con botón X para eliminar cada uno
  8. Botón "Export layout as default" — postMessage `exportDefaultLayout`
  9. Toggle "Debug View" — controla visibilidad de `DebugView`
  10. Información: mostrar puerto del servidor de hooks si está activo

- [ ] 10. Crear webview-ui/src/components/BottomToolbar.tsx
  1. Botón "+ Agent" — postMessage `launchAgent { bypassPermissions: false }`
  2. Right-click (contextmenu) en "+ Agent" — mostrar menú con opción "Launch (skip permissions)" → `launchAgent { bypassPermissions: true }`
  3. Botón "Layout" — toggle modo editor, cambiar icono según estado
  4. Botón de engranaje — abrir `SettingsModal`
  5. Integrar `ZoomControls` al lado derecho
  6. Integrar `VersionIndicator`

- [ ] 11. Crear webview-ui/src/notificationSound.ts
  1. Implementar `playNotificationSound(): void` con Web Audio API
  2. Crear `AudioContext` lazy (solo cuando se necesita, para evitar autoplay policy)
  3. Dos osciladores: 440Hz + 554Hz, OscillatorType `sine`
  4. GainNode con fade-out exponencial en 200ms
  5. Verificar `document.visibilityState === 'visible'` antes de reproducir
  6. No hacer nada si `soundEnabled` es false

- [ ] 12. Implementar sub-agent visualization en engine
  1. En `officeState.ts`: añadir `subagents: Map<string, SubagentCharacter>` con clave `"<agentId>:<toolId>"`
  2. `SubagentCharacter`: position cerca del padre, estado visual (animando/idle), linkedToParentId
  3. En `processMessageQueue`: manejar `subagentToolStart` → `addSubagent()`, `subagentToolDone`/`subagentClear` → `removeSubagent()`
  4. En `renderer.ts`: dibujar sub-agentes con escala 0.75× del personaje principal
  5. En `renderer.ts`: dibujar línea punteada del sub-agente al padre

- [ ] 13. Implementar external asset directory support en assetLoader.ts
  1. Añadir `externalAssetDirs: string[]` al estado del proveedor (cargado desde globalState)
  2. Implementar `scanExternalDirectory(dirPath, webview, extensionUri): Promise<LoadedAssets>`
  3. Para cada subdirectorio en `dirPath`: buscar `manifest.json`, parsear, validar campos requeridos
  4. Usar `webview.asWebviewUri()` solo para activos del propio extensionUri; para externos, leer como bytes y convertir a data URIs
  5. Implementar `mergeLoadedAssets(base, extra): LoadedAssets` sin sobrescribir IDs existentes
  6. Manejar `addAssetDirectory` mensaje desde webview: abrir `vscode.window.showOpenDialog`, guardar en globalState

- [ ] 14. Implementar watchAllSessions en fileWatcher.ts
  1. Implementar `startExternalSessionScanning(projectsRoot, knownFiles, ...)` — escanear todos los subdirs de `~/.claude/projects/`
  2. Cada JSONL nuevo no conocido → crear agente externo
  3. Implementar `startStaleExternalAgentCheck(agents, ...)` — cada 30s, eliminar agentes externos cuyo JSONL ya no existe en disco
  4. Controlar con flag `watchAllSessions.current: boolean`
  5. Al toggle off: detener scan y mantener agentes existentes hasta que terminen

- [ ] 15. Añadir global settings persistence en PixelAgentsViewProvider.ts
  1. Al recibir `setSetting`: guardar en `context.globalState`, reenviar al webview si es relevante
  2. Al recibir `setHooksEnabled { enabled }`:
     - Si true: `installHooks(server.port, server.token)`
     - Si false: `uninstallHooks()`
     - Guardar en globalState `hooksEnabled`
  3. Al iniciar: leer todos los settings de globalState y enviarlos al webview en `settingsLoaded` message
  4. Al detectar upgrade de versión (`lastSeenVersion !== currentVersion`): enviar `versionUpgraded` al webview

- [ ] 16. Escribir tests de webview (Vitest)
  1. Crear `webview-ui/test/layoutSerializer.test.ts`
     - Round-trip: serialize → deserialize → igual al original
     - Migration: layout sin version field se migra correctamente
     - Prototype pollution: `{"__proto__":{"x":1}}` no contamina Object.prototype
  2. Crear `webview-ui/test/tileMap.test.ts`
     - get/set retornan el valor correcto
     - set out-of-bounds no lanza
     - resize preserva tiles existentes
     - toArray/fromArray round-trip
  3. Crear `webview-ui/test/characters.test.ts`
     - BFS encuentra camino en grid libre
     - BFS devuelve [] cuando no hay camino (obstáculos totales)
     - BFS no pasa por obstáculos
     - State machine: setCharacterTool('Write') → state 'type'
     - State machine: setCharacterTool('Read') → state 'read'
     - State machine: clearCharacterTools → state 'idle'
  4. Crear `webview-ui/test/editorActions.test.ts`
     - paintTile retorna nuevo layout con tile modificado (inmutabilidad)
     - eraseTile pone 'empty'
     - undo/redo cycle correcto
     - redo stack limpiado tras nueva acción

- [ ] 17. Escribir tests de server (Vitest)
  1. Crear `server/__tests__/hookEventHandler.test.ts`
     - PreToolUse con sessionId conocido → llama callback con permissionRequest
     - Stop con sessionId conocido → llama callback con turnEnd y hookDelivered=true
     - Evento con sessionId desconocido → no llama callbacks
  2. Crear `server/__tests__/claudeHookInstaller.test.ts`
     - installHooks escribe hooks en settings.json correctamente
     - installHooks es idempotente (segunda llamada no duplica)
     - uninstallHooks elimina solo los hooks de pixel-agents
     - Escritura atómica: usa archivo .tmp + rename

- [ ] 18. Escribir tests E2E con Playwright
  1. Crear `e2e/playwright.config.ts` con `@vscode/test-electron`
  2. Crear `e2e/basic.test.ts`:
     - Verificar que el panel Pixel Agents aparece
     - Click "+ Agent" → terminal se abre con comando `claude --session-id ...`
     - Inyectar una línea JSONL de tipo `assistant` con tool_use → verificar message `agentToolStart` en webview
     - Inyectar `system.turn_duration` → verificar `agentStatus: waiting`
  3. Crear `e2e/layout.test.ts`:
     - Abrir editor → pintar tile → cerrar editor → reabrir → tile persiste

- [ ] 19. Crear scripts/asset-manager.html
  1. HTML standalone (sin servidor) para editar manifests de furniture
  2. Form con campos: id, name, sprites[], rotations[], states[], frames, size.w, size.h
  3. Preview del sprite PNG seleccionado
  4. Botón "Export manifest.json" que genera el JSON y lo descarga
  5. Botón "Import manifest.json" para editar un manifest existente

- [ ] 20. Configurar .vscodeignore y packaging
  1. Excluir: `src/`, `webview-ui/src/`, `webview-ui/node_modules/`, `server/src/`, `server/node_modules/`
  2. Excluir: `e2e/`, `scripts/`, `docs/`
  3. Excluir: archivos de configuración (tsconfig, eslint, prettier, etc.)
  4. Incluir: `dist/`, `shared/assets/`, `icon.png`, `README.md`, `CHANGELOG.md`, `LICENSE`
  5. Verificar con `bunx vsce ls` que solo incluye lo necesario

- [ ] 21. Verificar compilación y tests
  1. `bun run build` sin errores
  2. `bun run test` pasa (webview + server)
  3. `bun run e2e` pasa
  4. `bunx vsce package` genera .vsix sin errores
  5. Instalar .vsix en VS Code real y verificar funcionamiento completo

- [ ] 22. Verificar runtime completo
  1. Lanzar agente → personaje aparece y camina a su escritorio
  2. Ejecutar herramienta → animación correcta (type/read según herramienta)
  3. Fin de turno → speech bubble "waiting" + chime de notificación si sound enabled
  4. Permiso requerido → speech bubble de permiso
  5. Sub-agente (Task tool) → personaje secundario aparece vinculado
  6. Editor: pintar suelo/pared, colocar mueble, undo/redo, export/import JSON
  7. Settings: toggles persisten tras cerrar y reabrir VS Code
  8. External asset dir: furniture de directorio externo aparece en catálogo del editor
  9. Debug view: muestra info correcta por agente
  10. VersionIndicator: abre changelog, marca versión actual
