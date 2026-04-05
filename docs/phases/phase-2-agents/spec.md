# Phase 2 — Agents

Objetivo: detectar terminales de Claude Code, leer sus archivos JSONL y enviar eventos al webview cuando el agente inicia/termina una herramienta o completa un turno.

## Archivos a crear

### src/types.ts
```ts
export interface AgentState {
  id: number;
  sessionId: string;
  terminalRef?: vscode.Terminal;
  projectDir: string;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;

  // Tool tracking
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  subagentToolIds: Set<string>;
  backgroundAgentToolIds: Set<string>;

  // State flags
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
  hookDelivered: boolean;
  isExternal: boolean;

  // Monitoring
  lastDataAt: number;
  linesProcessed: number;
  seenUnknownRecordTypes: Set<string>;
}

export interface PersistedAgent {
  id: number;
  sessionId: string;
  jsonlFile: string;
  projectDir: string;
  terminalName: string;   // '' para sesiones de panel
  folderName?: string;
  isExternal: boolean;
}
```

### src/constants.ts
Constantes agrupadas en objetos exportados:
```ts
export const POLL_INTERVAL_MS = 500;
export const READ_CHUNK_BYTES = 65536;          // 64KB por ciclo
export const IDLE_THRESHOLD_MS = 5000;
export const PERMISSION_TIMEOUT_MS = 5000;
export const CLEAR_COOLDOWN_MS = 3000;
export const EXTERNAL_SCAN_DELAY_TICKS = 2;

export const COMMAND_SHOW_PANEL = 'pixel-agents.showPanel';
export const COMMAND_EXPORT_DEFAULT_LAYOUT = 'pixel-agents.exportDefaultLayout';

// Herramientas exentas de timer de permisos
export const PERMISSION_EXEMPT_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'LS', 'WebSearch', 'WebFetch',
  'TodoRead', 'TodoWrite', 'exit_plan_mode',
]);
```

### src/transcriptParser.ts
Función principal: `processTranscriptLine(line: string, agent: AgentState, postMessage: (msg: unknown) => void): void`

Lógica:
1. `JSON.parse(line)` — ignorar si falla
2. Si `record.type === 'assistant'`: extraer tool_use blocks, añadir a `activeToolIds`, llamar `postMessage({ type: 'toolStart', agentId, toolName, status })`
3. Si `record.type === 'tool_result'`: limpiar tool de `activeToolIds`, `postMessage({ type: 'toolEnd', agentId })`
4. Si `record.type === 'system' && record.subtype === 'turn_duration'`: limpiar todos los tools activos no-background, `postMessage({ type: 'turnEnd', agentId })`
5. Si `record.type === 'system' && record.subtype === 'progress'`: `postMessage({ type: 'toolProgress', agentId, status })`

Función auxiliar: `formatToolStatus(toolName: string, input: Record<string, unknown>): string`
- `Bash` → truncar comando a 60 chars
- `Read`/`Write`/`Edit` → mostrar ruta relativa
- `WebFetch`/`WebSearch` → mostrar URL/query
- Default → `toolName`

### src/timerManager.ts
```ts
export class TimerManager {
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  startPermissionTimer(agentId: number, onTimeout: () => void, ms: number): void;
  cancelTimer(agentId: number): void;
  disposeAll(): void;
}
```

### src/fileWatcher.ts
Clase `FileWatcher`:
- `start(projectDirs: string[], onAgentUpdate: AgentUpdateCallback): void`
- `stop(): void`
- Loop interno cada `POLL_INTERVAL_MS` ms:
  1. Escanear `~/.claude/projects/` buscando archivos `*.jsonl` con actividad reciente
  2. Para cada archivo conocido: leer desde `fileOffset`, procesar líneas completas (buffer para líneas parciales), actualizar `fileOffset`
  3. Adoptar nuevos archivos JSONL como agentes externos si no están en `knownJsonlFiles`
  4. Detectar `/clear` buscando `</command-name>` en los primeros bytes del archivo
- Tres sets de dismissal: `dismissedJsonlFiles` (temporal), `clearDismissedFiles` (permanente), `knownJsonlFiles`

Detección de terminales Claude: escuchar `vscode.window.onDidOpenTerminal` y `onDidCloseTerminal`. Asociar terminal a agente si el nombre contiene "claude".

### src/agentManager.ts
Clase `AgentManager`:
- `createAgent(sessionId, jsonlFile, projectDir, terminal?): AgentState`
- `removeAgent(id): void`
- `getAgent(id): AgentState | undefined`
- `getAllAgents(): AgentState[]`
- IDs: positivos para terminales, negativos para sub-agentes

### src/configPersistence.ts
Guardar/cargar lista de `PersistedAgent[]` en `context.globalState`:
```ts
export function saveAgents(context: vscode.ExtensionContext, agents: PersistedAgent[]): void;
export function loadAgents(context: vscode.ExtensionContext): PersistedAgent[];
```

### src/layoutPersistence.ts
Guardar/cargar layout en `~/.pixel-agents/layout.json`:
```ts
export async function saveLayout(layout: unknown): Promise<void>;
export async function loadLayout(): Promise<unknown | null>;
```

### src/assetLoader.ts
Cargar lista de furniture packs desde:
1. `dist/assets/` (bundled)
2. Directorios externos configurados por el usuario
```ts
export function getAssetUris(webview: vscode.Webview, extensionUri: vscode.Uri): AssetManifest;
```

### Integración en PixelAgentsViewProvider
- Instanciar `FileWatcher`, `AgentManager`, `TimerManager`
- Pasar `postMessage` al `FileWatcher` para reenviar eventos al webview
- En `dispose()`: detener FileWatcher, limpiar timers

### Mensajes webview (protocolo)
El webview recibe mensajes con esta forma:
```ts
type WebviewMessage =
  | { type: 'agentAdded';    agentId: number; sessionId: string }
  | { type: 'agentRemoved';  agentId: number }
  | { type: 'toolStart';     agentId: number; toolName: string; status: string }
  | { type: 'toolEnd';       agentId: number }
  | { type: 'toolProgress';  agentId: number; status: string }
  | { type: 'turnEnd';       agentId: number }
  | { type: 'permissionRequest'; agentId: number }
  | { type: 'layoutLoaded';  layout: unknown }
  | { type: 'assetsLoaded';  manifest: unknown };
```

## Criterio de éxito
- Al abrir una terminal con Claude Code activo, la consola del webview muestra `agentAdded`
- Al ejecutar una herramienta, se recibe `toolStart` con el nombre formateado
- Al completar el turno, se recibe `turnEnd`
