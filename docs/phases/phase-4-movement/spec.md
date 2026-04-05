# Phase 4 — Movement

Objetivo: renderizar la oficina pixel-art con personajes animados que reflejan el estado de cada agente en tiempo real.

## Estructura de archivos webview-ui/src/office/

```
office/
├── types.ts
├── colorize.ts
├── floorTiles.ts
├── wallTiles.ts
├── toolUtils.ts
├── engine/
│   ├── gameLoop.ts
│   ├── renderer.ts
│   ├── characters.ts
│   └── pathfinding.ts
├── layout/
│   ├── furnitureCatalog.ts
│   ├── tileMap.ts
│   └── layoutSerializer.ts
├── sprites/
│   └── spriteSheet.ts
└── editor/
    ├── editorState.ts
    └── editorActions.ts
```

---

## office/types.ts

```ts
export type AgentStatus = 'idle' | 'walking' | 'typing' | 'reading' | 'waiting';

export interface Character {
  id: number;
  x: number;          // posición en grid (tiles)
  y: number;
  targetX: number;
  targetY: number;
  path: Array<[number, number]>;
  status: AgentStatus;
  colorIndex: number;  // 0-5 paletas predefinidas, >5 usa hue shift
  animFrame: number;
  animTick: number;
  speechBubble?: 'permission' | 'thinking';
  bubbleTimer?: number;
}

export interface Tile {
  floor?: number;       // índice de patrón de suelo
  wall?: number;        // bitmask de pared (0-15)
  furniture?: FurniturePlacement;
}

export interface FurniturePlacement {
  id: string;
  rotation: 0 | 90 | 180 | 270;
  toggled?: boolean;
}

export interface OfficeLayout {
  width: number;        // en tiles, máx 64
  height: number;
  tiles: Tile[][];
  version: number;
}

export interface OfficeState {
  layout: OfficeLayout;
  characters: Map<number, Character>;
  zoom: number;         // 1-10 (píxeles de dispositivo por píxel de sprite)
  cameraX: number;
  cameraY: number;
  isPanning: boolean;
}
```

---

## office/engine/pathfinding.ts

BFS sobre el grid. No atravesar tiles con `wall` o `furniture` sin flag `walkable`:

```ts
export function findPath(
  layout: OfficeLayout,
  from: [number, number],
  to: [number, number]
): Array<[number, number]>;
```

Retorna array de coordenadas de tile desde `from` hasta `to` (exclusivo del origen). Retorna `[]` si no hay camino.

---

## office/engine/characters.ts

Gestión de sprites y animación:

**Paletas:** 6 PNGs pre-coloreados (`char_0.png` … `char_5.png`). Para agentes 7+, aplicar `colorize.ts` con hue shift en pasos de 45° (45, 90, 135, 180, 225, 270, 315).

**Estados de animación:**
| Status | Frames | Descripción |
|--------|--------|-------------|
| `idle` | 2 | respiración suave |
| `walking` | 4 | ciclo de caminar |
| `typing` | 2 | manos en teclado |
| `reading` | 2 | cabeza inclinada |
| `waiting` | 2 | burbuja ámbar parpadeante |

**Transiciones:**
- `agentAdded` → spawn en tile aleatorio libre → `idle`
- `toolStart (Write/Edit/Bash)` → caminar al escritorio → `typing`
- `toolStart (Read/Grep/Glob)` → caminar al escritorio → `reading`
- `permissionRequest` → `waiting` + burbuja ámbar + timer 5s
- `turnEnd` / timer expirado → caminar a tile aleatorio → `idle`
- `agentRemoved` → efecto de desvanecimiento

**Sub-agentes** (id negativo): misma lógica pero con efecto Matrix al aparecer (cascada de caracteres verdes durante 1s).

```ts
export function updateCharacter(char: Character, dt: number): void;
export function spawnCharacter(agentId: number, layout: OfficeLayout): Character;
export function applyAgentEvent(
  chars: Map<number, Character>,
  layout: OfficeLayout,
  event: WebviewMessage
): void;
```

---

## office/engine/renderer.ts

Renderizado Canvas 2D, sin `ctx.scale(dpr)` — usar zoom entero (n píxeles de dispositivo por píxel de sprite):

```ts
export function render(
  ctx: CanvasRenderingContext2D,
  state: OfficeState,
  sprites: SpriteCache,
  editorState: EditorState | null
): void;
```

**Orden de capas:**
1. Fondo (color sólido)
2. Tiles de suelo (`floorTiles.ts`)
3. Tiles de pared (`wallTiles.ts`, auto-tiling con bitmask 16 sprites)
4. Muebles (debajo del personaje si en tile anterior, encima si en tile posterior)
5. Personajes con animación
6. Speech bubbles
7. Grid del editor (si `editorState !== null`)
8. Cursor del editor

---

## office/engine/gameLoop.ts

```ts
export function startGameLoop(
  canvas: HTMLCanvasElement,
  getState: () => OfficeState,
  onTick: (dt: number) => void
): () => void;  // retorna función stop
```

- `requestAnimationFrame` loop
- `dt` = tiempo desde último frame en segundos, capped a 100ms
- Llama `onTick(dt)` → actualiza posiciones, animaciones
- Llama `renderer.render(...)`
- Retorna función que cancela el loop

---

## office/floorTiles.ts / wallTiles.ts

`floorTiles.ts`: 7 patrones colorables. Cada patrón es un tile 16×16 del spritesheet `floors.png`. Color aplicado via `colorize.ts`.

`wallTiles.ts`: auto-tiling de 16 bits. Función:
```ts
export function getWallSpriteIndex(bitmask: number): number;
```
Mapea los 16 combinaciones N/S/E/O a índices en `walls.png`.

---

## office/layout/furnitureCatalog.ts

```ts
export interface FurnitureItem {
  id: string;
  name: string;
  sprite: string;       // ruta relativa al spritesheet
  width: number;        // en tiles
  height: number;
  walkable: boolean;
  surfaceOnly: boolean; // solo en tiles sin wall
  wallOnly: boolean;    // solo en tiles con wall
  toggleable: boolean;
  states?: { on: string; off: string };
}

export const FURNITURE_CATALOG: FurnitureItem[];
```

Muebles bundled: `desk`, `chair`, `computer`, `plant`, `bookshelf`, `whiteboard`, `lamp`, `sofa`, `table`, `coffee_machine`.

---

## office/layout/tileMap.ts

```ts
export function createEmptyLayout(width: number, height: number): OfficeLayout;
export function getTile(layout: OfficeLayout, x: number, y: number): Tile;
export function setTile(layout: OfficeLayout, x: number, y: number, tile: Partial<Tile>): OfficeLayout;
export function isWalkable(layout: OfficeLayout, x: number, y: number): boolean;
export function expandGrid(layout: OfficeLayout, newWidth: number, newHeight: number): OfficeLayout;
```

---

## office/layout/layoutSerializer.ts

```ts
export function serializeLayout(layout: OfficeLayout): string;
export function deserializeLayout(json: string): OfficeLayout;
export function migrateLayout(raw: unknown): OfficeLayout;  // migración de versiones antiguas
```

---

## office/editor/editorState.ts

```ts
export type EditorTool = 'floor' | 'wall' | 'furniture' | 'eraser' | 'select';

export interface EditorState {
  active: boolean;
  tool: EditorTool;
  selectedFloor?: number;
  selectedFurnitureId?: string;
  selectedColor?: string;
  cursorX: number;
  cursorY: number;
  isDragging: boolean;
}
```

---

## Hooks React (webview-ui/src/hooks/)

### useExtensionMessages.ts
```ts
export function useExtensionMessages(
  onMessage: (msg: WebviewMessage) => void
): void;
```
Wrapper sobre `window.addEventListener('message', ...)` con cleanup.

### useEditorActions.ts
```ts
export function useEditorActions(
  editorState: EditorState,
  officeState: OfficeState,
  dispatch: Dispatch
): EditorActionHandlers;
```
Handlers para click/drag sobre el canvas en modo editor.

### useEditorKeyboard.ts
Atajos de teclado del editor:
- `F` → tool floor, `W` → wall, `U` → furniture, `E` → eraser
- `R` → rotar mueble seleccionado
- `Escape` → salir del editor

---

## App.tsx actualizado

```tsx
export default function App() {
  // Estado: officeState, editorState, messages
  // useExtensionMessages → despachar eventos a characters.ts
  // startGameLoop en useEffect
  return (
    <>
      <canvas id="office-canvas" />
      {editorActive && <EditActionBar />}
      <BottomToolbar onEditToggle={...} />
      <ZoomControls zoom={...} onZoom={...} />
    </>
  );
}
```

---

## Componentes UI

### BottomToolbar.tsx
Barra inferior con: botón editor, botón settings, indicador de agentes activos.

### EditActionBar.tsx
Barra lateral del editor: selector de tool, selector de suelo/mueble, paleta de colores.

### ZoomControls.tsx
Botones `+` / `-` y label con nivel actual.

---

## Constantes (webview-ui/src/constants.ts)

```ts
export const TILE_SIZE = 16;            // píxeles por tile en el spritesheet
export const DEFAULT_ZOOM = 3;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 10;
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 15;
export const MAX_GRID_SIZE = 64;
export const WALK_SPEED = 3;            // tiles por segundo
export const ANIM_FPS = 8;
export const PERMISSION_BUBBLE_MS = 5000;
export const MATRIX_EFFECT_MS = 1000;
```

---

## Criterio de éxito
- Al recibir `agentAdded`, aparece un personaje en el canvas
- El personaje camina al escritorio cuando llega `toolStart`
- Al recibir `turnEnd`, el personaje vuelve a vagar
- El editor permite pintar suelo y colocar muebles; los cambios persisten al reiniciar VSCode
- El zoom funciona con rueda del ratón
