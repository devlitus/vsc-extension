# Phase 4 — Movement: Architecture

This document describes the architecture of the Phase 4 game engine: canvas rendering, character animation, BFS pathfinding, layout system, and layout editor.

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Webview (React)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐  │
│  │   App.tsx   │──▶│  OfficeState │──▶│      GameLoop            │  │
│  └─────────────┘   └──────┬───────┘   └───────────┬──────────────┘  │
│                           │                       │                  │
│                           ▼                       ▼                  │
│                    ┌─────────────┐      ┌──────────────────┐        │
│                    │ Characters  │      │    Renderer      │        │
│                    │ (BFS + FSM) │      │  (Canvas 2D)     │        │
│                    └─────────────┘      └──────────────────┘        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Layout System                           │    │
│  │  TileMap ── FurnitureCatalog ── LayoutSerializer            │    │
│  │  FloorTiles ── WallTiles ── Colorize                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Editor System                           │    │
│  │  EditorState ── EditorActions ── EditorToolbar              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### VS Code API Layer (`vscodeApi.ts`, `browserMock.ts`, `runtime.ts`)

Abstracts the VS Code webview API so the frontend can run in both the extension and a standalone browser (for development/testing).

- `vscodeApi.ts`: Wraps `acquireVsCodeApi()`, exposes `postMessage()` and `getState()`
- `browserMock.ts`: Mock implementation of the VS Code API for browser-based dev
- `runtime.ts`: Detects environment, exports the correct implementation

### Office Types (`office/types.ts`)

Shared TypeScript interfaces for the entire game engine:
- `Tile`: position + type (floor/wall/furniture)
- `Character`: id, position, target, state, palette, animation frame
- `Seat`: id, position, facing direction
- `OfficeLayout`: complete serializable layout (tiles, seats, furniture instances)
- `EditorTool`: enum for select/paint/erase/place/eyedropper/pick

### Sprite System (`office/sprites/`)

Manages sprite sheets and animation data.

**`spriteData.ts`**: Defines all animation sequences per character state:
```typescript
interface SpriteAnimation {
  frames: number[];          // frame indices in spritesheet
  frameDuration: number;     // ms per frame
  loop: boolean;
}
```
States: `idle`, `walk-up/down/left/right`, `type`, `read`, `waiting`

**`spriteCache.ts`**: Caches `ImageBitmap` objects per sprite sheet + palette combination. Avoids repeated image decoding during the render loop.

**Bubble sprites** (`bubble-waiting.json`, `bubble-permission.json`): JSON definitions for the speech bubble animation frames rendered above characters.

### Layout System (`office/layout/`)

**`tileMap.ts`**: 2D grid data structure (up to 64×64). Stores tile type per cell. Provides methods: `get()`, `set()`, `clear()`, `resize()`, `toArray()`, `fromArray()`.

**`furnitureCatalog.ts`**: Parses `manifest.json` from each furniture folder:
```json
{
  "id": "desk-1",
  "sprites": ["default.png"],
  "rotations": ["n","e","s","w"],
  "states": ["on","off"],
  "frames": 1,
  "size": { "w": 2, "h": 1 }
}
```
Exposes `getCatalogItem(id)` and `getAllItems()`.

**`layoutSerializer.ts`**: Serializes/deserializes `OfficeLayout` to/from JSON. Handles version migration (v1 → v2 etc.). Called on save/load.

### Floor & Wall Tiles (`floorTiles.ts`, `wallTiles.ts`, `colorize.ts`)

**`floorTiles.ts`**: Loads individual PNG floor tiles, maps tile IDs to image sources.

**`wallTiles.ts`**: Implements auto-tiling. Given a tile map, computes the correct wall sprite for each wall cell based on its neighbors (16-tile bitmask approach).

**`colorize.ts`**: Applies HSB color transforms to tile sprites. Used to colorize floor tiles and walls without requiring separate sprite sheets per color.

### Office State (`engine/officeState.ts`)

Central state object for the running office:
```typescript
interface OfficeState {
  characters: Map<number, Character>;  // agentId → Character
  seats: Seat[];
  layout: OfficeLayout;
  zoom: number;
  panOffset: { x: number; y: number };
  selectedCharacterId: number | null;
}
```
Exposes mutators used by the game loop and message handler.

### Character State Machine + BFS (`engine/characters.ts`)

**State Machine:**
```
idle ──────────▶ walk ──────────▶ type
  ▲                                 │
  └─────────── tool_done ◀──────────┘
  │
  ├──▶ read (on read/search tools)
  ├──▶ waiting (on turnEnd / permissionRequest)
  └──▶ idle (default)
```

**BFS Pathfinding:**
- Grid-based BFS on the tile map
- Obstacles: wall tiles + occupied seats (except target seat)
- Returns `Position[]` path from current to target cell
- Characters walk path cell-by-cell at configurable speed (tiles/sec)

**Character assignment:**
- On `agentCreated`: spawn character at a default position, assign first free seat
- On `agentClosed`: remove character, free seat
- On click: allow seat reassignment via selection → click flow

### Canvas Renderer (`engine/renderer.ts`)

Renders a single frame to the HTML canvas element:

1. **Clear** canvas
2. **Floor tiles**: iterate tile map, draw floor sprites (colorized)
3. **Wall tiles**: auto-tiling pass, draw correct wall sprites
4. **Furniture**: draw furniture sprites from layout, handle rotation + states
5. **Shadows**: draw character shadows (semi-transparent ellipses)
6. **Characters**: draw animated character frames from spriteCache
7. **Speech bubbles**: draw bubble sprite + status text above character
8. **Labels**: draw agent name/folder label below character (optional, toggled by setting)
9. **Editor overlays**: draw grid, hover highlights, selection rectangle (only in editor mode)

All drawing uses integer pixel positions at the current zoom level. No sub-pixel rendering.

### Game Loop (`engine/gameLoop.ts`)

```
requestAnimationFrame
    │
    ▼
tick(deltaTime)
    │
    ├── updateCharacters(deltaTime)  ← advance walk animation, BFS step
    │       └── update sprite frame counters
    │
    ├── processMessageQueue()        ← drain VS Code messages received between frames
    │
    └── renderer.render(officeState) ← draw frame
```

Targets 60fps. Delta time capped at 100ms to avoid large jumps after tab focus restore.

### Matrix Effect (`engine/matrixEffect.ts`)

Optional overlay rendered on top of the office canvas. Green falling characters in the style of The Matrix. Toggled via settings. Runs its own animation state separate from the main game loop.

### Editor System (`office/editor/`)

**`editorState.ts`**: Tracks current editor mode state:
- Selected tool: select / paint / erase / place / eyedropper / pick
- Selected tile/furniture item
- Current drag operation
- Undo/redo stacks (max 50 snapshots of `OfficeLayout`)

**`editorActions.ts`**: Pure functions for tile mutations:
- `paintTile(state, pos, tileType)`
- `eraseTile(state, pos)`
- `placeFurniture(state, pos, itemId, rotation)`
- `moveFurniture(state, furnitureId, newPos)`
- `eyedropper(state, pos)` → returns tile type at pos
- `undo(state)` / `redo(state)`

**`EditorToolbar.tsx`**: React component rendering the editor toolbar. Communicates with editor state via props + callbacks.

## Data Flow

### Message handling (Extension → Webview)

```
Extension host
    │  postMessage({ type, ...data })
    ▼
runtime.ts onMessage handler
    │
    ▼
messageQueue (buffered between frames)
    │
    ▼ (each frame, in game loop)
processMessageQueue()
    │
    ├── agentCreated    → OfficeState.addCharacter()
    ├── agentClosed     → OfficeState.removeCharacter()
    ├── agentToolStart  → Character.setState('type'|'read')
    ├── agentToolDone   → Character.setState('idle')
    ├── agentStatus     → Character.setState('waiting')
    ├── agentToolsClear → Character.clearTools()
    ├── layoutLoaded    → OfficeState.setLayout()
    ├── assetsLoaded    → SpriteCache.preload()
    └── existingAgents  → restore all agents
```

### Layout save/load

```
User edits layout in editor
    │
    ▼
EditorActions mutates OfficeLayout
    │
    ▼
LayoutSerializer.serialize(layout) → JSON
    │
    ▼
postMessage({ type: 'saveLayout', layout })
    │
    ▼ (Extension host)
layoutPersistence.writeLayoutToFile()
```

## Zoom & Pan

- Integer zoom levels: 1×, 2×, 3×, 4× (pixel-perfect)
- Pan via mouse drag on canvas (outside editor mode)
- Zoom via `ZoomControls` component or scroll wheel
- Canvas size = grid size × tile size × zoom

## Tile Coordinate System

```
(0,0) ──────────▶ x (col)
  │
  │
  ▼
  y (row)
```

Screen position = `(tileX * tileSize + panOffset.x) * zoom`

## Asset Loading Sequence

```
1. Extension sends assetsLoaded (character sprites, furniture URIs)
2. SpriteCache.preload() — fetch all ImageBitmaps in parallel
3. Extension sends floorTilesLoaded + wallTilesLoaded
4. Extension sends layoutLoaded
5. GameLoop starts rendering
```
