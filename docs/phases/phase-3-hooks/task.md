# Phase 3 — Hooks: Tasks

## Tasks

- [ ] 1. Crear server/src/constants.ts
  1. Definir `SERVER_CONFIG_PATH = '~/.pixel-agents/server.json'`
  2. Definir `SERVER_DIR = '~/.pixel-agents/'`
  3. Definir `MAX_BODY_BYTES = 65536`
  4. Definir `PROVIDER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/`
  5. Definir `SHUTDOWN_TIMEOUT_MS = 5000`

- [ ] 2. Crear server/src/server.ts - Clase PixelAgentsServer
  1. Definir propiedad `port: number` (asignado dinámicamente al bind en `0`)
  2. Definir propiedad `token: string` (32 bytes aleatorios en hex)
  3. Definir propiedad `httpServer: http.Server`
  4. Definir propiedad `callbacks: Map<string, (event: unknown) => void>`
  5. Implementar método `async start(): Promise<void>` — bind en `127.0.0.1:0`, escribir `~/.pixel-agents/server.json`
  6. Implementar método `async stop(): Promise<void>` — graceful shutdown, limpiar PID del config
  7. Implementar método `onEvent(providerId: string, cb: (event: unknown) => void): void`
  8. Implementar método estático `static async findExisting(): Promise<{ port, token } | null>` — leer `server.json`, verificar PID activo
  9. Implementar endpoint `POST /api/hooks/:providerId`
     - Verificar header `Authorization: Bearer <token>` con `crypto.timingSafeEqual`
     - Validar body JSON, máximo `MAX_BODY_BYTES`
     - Retornar 401 si token inválido, 400 si providerId no válido, 200 OK
     - Invocar callback registrado para ese providerId
  10. Implementar endpoint `GET /api/health` — retornar `{ uptime, pid }` sin auth
  11. Implementar escritura atómica de config: escribir a `.tmp`, luego `rename`
  12. Implementar permisos `0o600` para server.json
  13. Implementar soporte multi-ventana: si ya existe servidor activo (PID vivo), reusar configuración

- [ ] 3. Crear server/src/hookEventHandler.ts
  1. Definir interface `HookEvent` con campos:
     - `type: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'SubagentStop'`
     - `sessionId: string`
     - `toolName?: string`
     - `toolInput?: unknown`
     - `toolResult?: unknown`
  2. Implementar función `handleHookEvent(event: HookEvent, agents: AgentState[], postMessage: (agentId: number, msg: unknown) => void): void`
  3. Manejar `PreToolUse`: marcar `permissionSent = true`, invocar `postMessage(agentId, { type: 'permissionRequest' })`
  4. Manejar `PostToolUse`: invocar `postMessage(agentId, { type: 'toolEnd' })`
  5. Manejar `Stop` / `SubagentStop`: invocar `postMessage(agentId, { type: 'turnEnd', source: 'hook' })`, marcar `hookDelivered = true`

- [ ] 4. Crear server/src/providers/file/claudeHookInstaller.ts
  1. Definir función `installHooks(serverPort: number, token: string): Promise<void>`
  2. Definir función `uninstallHooks(): Promise<void>`
  3. Leer `~/.claude/settings.json` existente
  4. Insertar hooks en estructura:
     - `PreToolUse`: `[{ "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }]`
     - `PostToolUse`: `[{ "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }]`
     - `Stop`: `[{ "hooks": [{ "type": "command", "command": "..." }] }]`
  5. Generar comando curl inline: `curl -s -X POST http://127.0.0.1:<port>/api/hooks/claude -H "Authorization: Bearer <token>" -d @-`
  6. Escribir settings.json actualizado de forma atómica
  7. Implementar uninstallHooks que elimine los hooks del settings.json

- [ ] 5. Crear server/src/providers/file/hooks/claude-hook.ts
  1. Crear script que lea stdin (JSON del evento)
  2. Hacer POST al servidor local con el evento
  3. Implementar fallo silencioso (no bloquear Claude Code)

- [ ] 6. Actualizar PixelAgentsViewProvider.ts para integrar hooks
  1. Al activar: instanciar `PixelAgentsServer` y llamar `await server.start()`
  2. Registrar callback: `server.onEvent('claude', (event) => handleHookEvent(event, ...))`
  3. Llamar `installHooks(server.port, server.token)` para instalar hooks en Claude Code
  4. En `dispose()`: llamar `uninstallHooks()` y `server.stop()`
  5. Coordinar con polling JSONL: si `hookDelivered === true`, no emitir `turnEnd` duplicado
  6. Resetear flag `hookDelivered` al inicio de cada nuevo turno

- [ ] 7. Verificar compilación
  1. `bun run build` sin errores
  2. TypeScript sin errores de tipos

- [ ] 8. Verificar runtime
  1. `GET http://127.0.0.1:<port>/api/health` devuelve 200 con `{ uptime, pid }`
  2. Al ejecutar Claude Code con hooks instalados, el evento `Stop` llega al servidor
  3. No hay errores si Claude Code no tiene hooks instalados (degradación elegante)
