# Pixel Agents — Visión Final

> "El Sims para agentes IA: donde gestionar agentes se siente como jugar, pero los resultados son reales."

---

## 1. Filosofía

Pixel Agents nació como una extensión de VS Code que muestra agentes Claude Code como personajes de pixel art en una oficina. El objetivo final va mucho más allá: convertirse en **la interfaz estándar para orquestar cualquier sistema de agentes IA**, independientemente de la plataforma, del proveedor de IA, o del tema visual.

El principio fundamental es que los agentes deben ser **visibles, comprensibles y manejables** — no cajas negras ejecutándose en terminales. Cuando puedes ver a un agente caminando hacia su escritorio, escribir código, o levantar la mano para pedir permiso, el sistema deja de ser opaco. La interfaz convierte la complejidad en algo intuitivo.

---

## 2. Conceptos Centrales

### 2.1 La Oficina

La oficina es el espacio de trabajo compartido donde viven los agentes. Es editable, persistente, y refleja la estructura real del trabajo:

- **Grid de tiles** expandible hasta 64×64 (objetivo: sin límite práctico)
- **Escritorios** representan directorios de trabajo o proyectos
- **Tablero Kanban** en la pared: lista de tareas pendientes que los agentes pueden tomar de forma autónoma cuando quedan inactivos
- **Salas** como agrupadores lógicos: una sala por proyecto, equipo o dominio
- **Assets totalmente personalizables**: muebles, suelos, paredes — importables desde cualquier directorio externo

### 2.2 Los Agentes

Cada agente es un **personaje independiente** con identidad propia:

| Propiedad | Descripción |
|-----------|-------------|
| Rol visual | Designer, Coder, Writer, Reviewer (iconografía diferenciada) |
| Modelo | El modelo de IA que lo alimenta (Claude Sonnet, GPT-4o, Gemini, etc.) |
| Directorio activo | El proyecto en el que está trabajando actualmente |
| Estado | Idle / Walking / Typing / Reading / Running / Waiting / Blocked |
| Contexto | Tokens usados vs. ventana total, visualizado como barra de salud |
| Rate limit | Límite de peticiones por minuto, visualizado como barra de energía |
| Historial | Registro completo de todas las acciones del turno actual y anteriores |

### 2.3 Sub-agentes

Cuando un agente invoca la herramienta `Task` o `Agent`, nace un sub-agente:

- Aparece como un personaje más pequeño vinculado al padre por una línea punteada
- Tiene su propio estado visual y barra de contexto
- Desaparece cuando el sub-agente completa su trabajo
- El árbol de sub-agentes se puede inspeccionar visualmente

### 2.4 El Tablero Kanban

Panel visual en la oficina donde se gestionan tareas:

- Columnas configurables: **Backlog → En Progreso → En Revisión → Hecho**
- Los agentes inactivos pueden tomar tareas del Backlog de forma autónoma
- Las tareas pueden asignarse manualmente arrastrando al personaje de un agente
- Integrable con sistemas externos (GitHub Issues, Jira, Linear, Notion)
- Cada tarjeta muestra: título, descripción, prioridad, agente asignado, y tiempo invertido

---

## 3. Especificaciones de Funcionalidades

### 3.1 Gestión de Agentes

#### Lanzar un agente
- Click en "+ Agent" o arrastrar una tarjeta de personaje al escritorio
- Selector de: modelo de IA, directorio de trabajo, rol, permisos
- Soporte para perfiles predefinidos ("agente de revisión de PR", "agente de refactor")

#### Inspección profunda
Click en cualquier personaje abre un panel lateral con:
```
┌────────────────────────────────────┐
│  🤖 Agent #3 — "Coder"             │
│  Modelo: Claude Sonnet 4.6         │
│  Directorio: ~/projects/my-app     │
│  Branch: feat/auth-refactor        │
├────────────────────────────────────┤
│  CONTEXTO  ████████░░░░  64%       │
│  RATE      ██████████░░  80%       │
├────────────────────────────────────┤
│  System prompt: [ver completo]     │
│  Turno actual: 4m 32s              │
│  Herramientas usadas este turno:   │
│    Read ×5  Edit ×3  Bash ×2       │
├────────────────────────────────────┤
│  [Interrumpir]  [Chat]  [Redirigir]│
└────────────────────────────────────┘
```

#### Interacción directa
- **Interrumpir**: envía señal de parada al agente
- **Chat**: abre panel de conversación directa con el agente activo
- **Redirigir**: cambia el directorio de trabajo o la tarea asignada
- **Clonar**: lanza una copia del agente con el mismo contexto de sistema

#### Asignación por arrastre
- Arrastra un personaje a un escritorio → el agente cambia su `cwd` al directorio asociado
- Arrastra una tarjeta Kanban al personaje → el agente recibe la tarea como prompt

### 3.2 Visualización de Estado

#### Animaciones según actividad
| Acción del agente | Animación del personaje |
|-------------------|------------------------|
| Idle              | Respiración sutil, parpadeo |
| Walking           | Movimiento BFS hacia destino |
| Write/Edit        | Escribiendo en teclado |
| Read/Grep/Glob    | Leyendo pantalla |
| Bash/Run command  | Terminal activa, humo del CPU |
| Waiting for input | Speech bubble "?" animado |
| Permission needed | Speech bubble con signo de stop |
| Finished turn     | Estiramiento + animación de celebración |
| Error/Blocked     | Personaje con X roja, vibración |
| Rate limited      | Personaje dormido con ZZZ |

#### Speech bubbles
- **"?"**: esperando input del usuario
- **"🛑"**: solicitud de permiso pendiente
- **"✓"**: turno completado (desaparece tras 3s)
- **"💬"**: texto libre del último mensaje (truncado a 40 caracteres)
- **"⚡"**: rate limit alcanzado

#### Barras de estado globales
Panel inferior con métricas agregadas de todos los agentes activos:
- Total tokens consumidos en la sesión
- Agentes activos / inactivos / bloqueados
- Tareas completadas hoy

### 3.3 Editor de Oficina

Mejoras sobre la implementación actual:

- **Salas**: selecciona un área rectangular y nómbrala ("Backend", "Frontend", "QA")
- **Decoración automática**: el editor sugiere disposiciones según el número de agentes
- **Preset de layouts**: plantillas predefinidas (startup loft, corporate office, home studio)
- **Modo nocturno**: el office cambia de apariencia según la hora local
- **Cámara libre**: modo panorámico para oficinas grandes (>32×32)
- **Minimapa**: para oficinas grandes, renderizado en esquina

### 3.4 Personalización Visual

#### Temas
El sistema de temas reemplaza no solo colores sino sprites completos:
- **Pixel Office** (por defecto): oficina moderna pixel art
- **Cyberpunk Lab**: neón, dark mode extremo
- **Fantasy Dungeon**: agentes como aventureros, tareas como misiones
- **Space Station**: gravedad cero, robots como agentes

#### Personajes personalizados
- Importar spritesheets propios siguiendo la especificación de frames
- Editor de personajes integrado (próxima fase): pintar pixel a pixel
- Marketplace comunitario de packs de personajes y muebles

---

## 4. Arquitectura Objetivo

### 4.1 Principio: Tres capas de independencia

```
┌─────────────────────────────────────────────────────┐
│                  PLATAFORMA HOST                      │
│  VS Code Extension │ Electron App │ Web App │ CLI    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  NÚCLEO (Core)                        │
│  Office State Engine   │   Agent State Machine       │
│  Layout System         │   Task Queue                │
│  Event Bus             │   Persistence Layer         │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│               ADAPTADORES DE AGENTE                   │
│  ClaudeCodeAdapter │ OpenAICodexAdapter │ GeminiAdapter│
│  CursorAdapter     │ CopilotAdapter     │ CustomAdapter│
└─────────────────────────────────────────────────────┘
```

### 4.2 Core Module

El núcleo es **agnóstico de plataforma y de agente**. Expone:

```typescript
interface PixelAgentsCore {
  // Estado
  office: OfficeState;
  agents: AgentRegistry;
  tasks: TaskQueue;

  // Eventos
  on(event: CoreEvent, handler: EventHandler): void;

  // Acciones
  spawnAgent(config: AgentConfig): AgentId;
  terminateAgent(id: AgentId): void;
  assignTask(agentId: AgentId, task: Task): void;
  updateOfficeLayout(layout: OfficeLayout): void;
}
```

Puede ejecutarse en:
- **Hilo principal de VS Code** (implementación actual)
- **Proceso Electron** separado
- **Worker web** en entorno browser
- **Servidor Node/Bun** para modo headless/remoto

### 4.3 Adaptadores de Agente

Cada adaptador implementa la interfaz `AgentAdapter`:

```typescript
interface AgentAdapter {
  readonly name: string;
  readonly version: string;

  // Ciclo de vida
  spawn(config: SpawnConfig): Promise<AgentHandle>;
  terminate(handle: AgentHandle): Promise<void>;

  // Observación
  watchActivity(handle: AgentHandle): Observable<AgentActivity>;

  // Interacción
  sendMessage(handle: AgentHandle, message: string): Promise<void>;
  interrupt(handle: AgentHandle): Promise<void>;
  requestPermission(handle: AgentHandle, decision: boolean): Promise<void>;
}
```

**ClaudeCodeAdapter** (existente, refactorizado):
- Detecta sesiones via JSONL transcript files
- Hooks para eventos en tiempo real (PreToolUse, PostToolUse, Stop)
- Lanza terminales con `claude --session-id <id>`

**Adaptadores futuros**:
- `OpenAICodexAdapter`: via OpenAI API + streaming events
- `GeminiAdapter`: via Google AI Studio events
- `CursorAdapter`: via Cursor extension API
- `GenericLSPAdapter`: para cualquier herramienta que implemente Language Server Protocol

### 4.4 Capa de Plataforma

Cada plataforma implementa `PlatformAdapter`:

```typescript
interface PlatformAdapter {
  // Terminal / proceso
  launchProcess(command: string, cwd: string): Promise<ProcessHandle>;
  killProcess(handle: ProcessHandle): Promise<void>;

  // Filesystem
  watchFile(path: string): Observable<FileChangeEvent>;
  readFile(path: string): Promise<string>;

  // UI
  showPanel(): void;
  openNativeFilePicker(): Promise<string | null>;
  sendNotification(message: string): void;
}
```

**VSCodePlatformAdapter** (existente, refactorizado):
- Usa `vscode.window`, `vscode.workspace`, WebviewViewProvider
- Terminal via `vscode.window.createTerminal`

**ElectronPlatformAdapter** (futuro):
- App nativa en macOS/Windows/Linux
- Sin restricciones de sandbox
- Acceso completo al filesystem y procesos

**WebPlatformAdapter** (futuro):
- Ejecuta en navegador
- Conecta a agentes via WebSocket a un servidor local
- Modo solo-lectura o con proxy de permisos

### 4.5 Persistencia

```
~/.pixel-agents/
├── config.json          # Settings globales
├── layouts/             # Layouts de oficina (uno por workspace)
│   └── <workspace-hash>.json
├── agents/              # Perfiles de agente guardados
│   └── <agent-id>.json
└── assets/              # Assets externos descargados/importados
    └── <pack-name>/
```

Formato de config.json:
```json
{
  "version": 2,
  "theme": "pixel-office",
  "sound": true,
  "externalAssetDirs": ["/path/to/my-assets"],
  "agentProfiles": [...],
  "kanbanIntegration": {
    "provider": "github",
    "repo": "owner/repo"
  }
}
```

---

## 5. Integraciones Externas

### 5.1 Sistemas de Tareas

| Sistema | Tipo de integración |
|---------|---------------------|
| GitHub Issues | OAuth + API REST |
| Linear | API GraphQL |
| Jira | Atlassian REST API |
| Notion | Notion API |
| Fichero local | JSON/Markdown en el repo |

Las tarjetas del Kanban se sincronizan bidireccionalmente: cerrar una tarjeta en el tablero cierra el issue en GitHub.

### 5.2 Notificaciones

- **Desktop notifications**: cuando un agente espera input o termina
- **Slack/Discord webhook**: mensaje automático al canal del equipo
- **Email**: resumen diario de actividad de agentes (opt-in)

### 5.3 Telemetría (opt-in)

Métricas anónimas de uso para mejorar el producto:
- Número de agentes por sesión
- Tiempo medio de turno por herramienta
- Frecuencia de tipos de herramientas usadas

---

## 6. Hoja de Ruta

### Fase 6 — Core Module
**Objetivo**: Extraer el núcleo agnóstico de plataforma

- [ ] Crear paquete `@pixel-agents/core` en `packages/core/`
- [ ] Definir interfaces `AgentAdapter`, `PlatformAdapter`, `CoreEvent`
- [ ] Refactorizar `agentManager.ts` para usar `AgentAdapter`
- [ ] Refactorizar `PixelAgentsViewProvider.ts` para usar `PlatformAdapter`
- [ ] Tests unitarios del core sin dependencias de VS Code

### Fase 7 — Agent Inspection Panel
**Objetivo**: Click en agente muestra panel con contexto, historial y controles

- [ ] Panel lateral con métricas del agente (tokens, rate, tiempo)
- [ ] Historial de herramientas usadas en el turno
- [ ] Botones Interrumpir / Chat / Redirigir
- [ ] Visualización de system prompt
- [ ] Árbol de sub-agentes expandible

### Fase 8 — Kanban Integration
**Objetivo**: Tablero de tareas en la oficina con asignación autónoma

- [ ] Componente KanbanBoard en el webview
- [ ] Integración básica con ficheros Markdown locales
- [ ] Lógica de auto-asignación cuando agente queda idle
- [ ] Integración con GitHub Issues (OAuth)

### Fase 9 — Electron App
**Objetivo**: Versión standalone sin depender de VS Code

- [ ] `ElectronPlatformAdapter`
- [ ] App wrapper con menú nativo
- [ ] Packaging multiplataforma (Mac/Windows/Linux)
- [ ] Publicación en sitio propio + Homebrew

### Fase 10 — Agent Marketplace
**Objetivo**: Conectar con agentes de distintos proveedores

- [ ] `OpenAICodexAdapter`
- [ ] `GeminiAdapter` 
- [ ] UI para configurar credenciales por adaptador
- [ ] Selector de adaptador al lanzar un agente

### Fase 11 — Themes & Asset Marketplace
**Objetivo**: Ecosistema de personalización comunitario

- [ ] Sistema de temas completo (sprites + colores + sonidos)
- [ ] Repositorio público de asset packs
- [ ] UI de descarga e instalación en un click
- [ ] Editor de personajes integrado (pixel por pixel)

---

## 7. Criterios de Éxito

### 7.1 Técnicos
- El core funciona sin VS Code (tests pasan en entorno Node puro)
- Añadir un nuevo adaptador de agente requiere menos de 200 líneas de código
- La oficina renderiza sin drops de frame con 20 agentes activos simultáneos
- Cold start de la extensión en VS Code < 500ms

### 7.2 Experiencia de usuario
- Un nuevo usuario puede lanzar su primer agente en < 30 segundos
- El estado de un agente es comprensible de un vistazo sin leer logs
- Interrumpir un agente desde la UI tarda < 1 segundo en reflejarse

### 7.3 Comunidad
- Guía de "crear tu primer adapter" de < 10 pasos
- Guía de "crear tu primer asset pack" de < 5 pasos
- Proceso de contribución documentado con ejemplos reproducibles

---

## 8. Principios de Diseño No Negociables

1. **Observación, no modificación**: Pixel Agents nunca modifica el comportamiento de los agentes. Solo observa, visualiza, y facilita la interacción. No inyecta prompts sin consentimiento explícito.

2. **Local-first**: toda la información de sesiones y layouts se guarda localmente. Sin cuentas obligatorias, sin telemetría involuntaria.

3. **Modularidad extrema**: ninguna parte del sistema debe depender directamente de VS Code, Claude Code, o cualquier vendor. Todo pasa por adaptadores con interfaces definidas.

4. **Juego, no dashboard**: la UI debe sentirse ligera y divertida. Los personajes son el centro de atención, no las métricas. Las métricas existen pero no dominan.

5. **Open source, siempre**: el núcleo y los adaptadores oficiales son y seguirán siendo MIT. Los temas premium son el modelo de monetización, nunca las funciones core.
