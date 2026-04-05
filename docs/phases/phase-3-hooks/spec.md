# Phase 3 — Hooks

Objetivo: servidor HTTP local que recibe eventos de hooks de Claude Code, permitiendo detección fiable de fin de turno y notificaciones de permisos sin depender únicamente del polling JSONL.

## Por qué hace falta

El polling JSONL detecta ~98% de los fin de turno via `turn_duration`, pero los hooks de Claude Code envían eventos síncronos con más detalle. El servidor actúa como fallback y complemento.

## Archivos a crear

### server/src/constants.ts
```ts
export const SERVER_CONFIG_PATH = '~/.pixel-agents/server.json';
export const SERVER_DIR = '~/.pixel-agents/';
export const MAX_BODY_BYTES = 65536;
export const PROVIDER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
export const SHUTDOWN_TIMEOUT_MS = 5000;
```

### server/src/server.ts
Clase `PixelAgentsServer`:

**Propiedades:**
- `port: number` (asignado dinámicamente al bind en `0`)
- `token: string` (32 bytes aleatorios en hex)
- `httpServer: http.Server`
- `callbacks: Map<string, (event: unknown) => void>`

**Métodos:**
- `async start(): Promise<void>` — bind en `127.0.0.1:0`, escribir `~/.pixel-agents/server.json`
- `async stop(): Promise<void>` — graceful shutdown, limpiar PID del config
- `onEvent(providerId: string, cb: (event: unknown) => void): void`
- `static async findExisting(): Promise<{ port, token } | null>` — leer `server.json`, verificar PID activo

**Endpoints:**
- `POST /api/hooks/:providerId`
  - Header `Authorization: Bearer <token>` — verificar con `crypto.timingSafeEqual`
  - Body JSON, máx `MAX_BODY_BYTES`
  - 401 si token inválido, 400 si providerId no válido, 200 OK
  - Invocar callback registrado para ese providerId
- `GET /api/health` — `{ uptime, pid }` sin auth

**Config en disco** (`server.json`, permisos `0o600`):
```json
{ "port": 54321, "token": "abc123...", "pid": 12345 }
```
Operaciones atómicas: escribir a `.tmp`, luego `rename`.

**Multi-ventana:** si ya existe un servidor activo (PID vivo), reusar su configuración en lugar de arrancar uno nuevo.

### server/src/hookEventHandler.ts
```ts
export interface HookEvent {
  type: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'SubagentStop';
  sessionId: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

export function handleHookEvent(
  event: HookEvent,
  agents: AgentState[],
  postMessage: (agentId: number, msg: unknown) => void
): void;
```

Lógica:
- `PreToolUse`: marcar `permissionSent = true`, `postMessage(agentId, { type: 'permissionRequest' })`
- `PostToolUse`: `postMessage(agentId, { type: 'toolEnd' })`
- `Stop` / `SubagentStop`: `postMessage(agentId, { type: 'turnEnd', source: 'hook' })`, marcar `hookDelivered = true`

### server/src/providers/file/claudeHookInstaller.ts
Instalar/desinstalar hooks en `~/.claude/settings.json`:

```ts
export async function installHooks(serverPort: number, token: string): Promise<void>;
export async function uninstallHooks(): Promise<void>;
```

**Estructura del hook instalado en settings.json:**
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "..." }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "..." }] }]
  }
}
```

El command es un shell script inline que hace `curl -s -X POST http://127.0.0.1:<port>/api/hooks/claude -H "Authorization: Bearer <token>" -d @-`.

### server/src/providers/file/hooks/claude-hook.ts
Script generado dinámicamente que se invoca como hook:
- Lee stdin (JSON del evento)
- Hace POST al servidor local
- Falla silenciosamente (no bloquear Claude Code)

### Integración en PixelAgentsViewProvider
1. Al activar: `server = new PixelAgentsServer(); await server.start()`
2. Registrar callback: `server.onEvent('claude', (event) => handleHookEvent(event, ...))`
3. Llamar `installHooks(server.port, server.token)`
4. En `dispose()`: `uninstallHooks()`, `server.stop()`

**Coordinación con polling JSONL:**
Si `hookDelivered === true` para un agente, el polling no emite `turnEnd` duplicado en ese turno. El flag se resetea al inicio del siguiente turno.

## Criterio de éxito
- `GET http://127.0.0.1:<port>/api/health` devuelve 200
- Al ejecutar Claude Code con hooks instalados, el evento `Stop` llega al servidor y se registra en consola
- No hay errores si Claude Code no tiene hooks instalados (degradación elegante)
