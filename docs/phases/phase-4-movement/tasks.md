# Phase 4 — Movement: Tasks

## Tasks

- [ ] 1. Create webview-ui/src/vscodeApi.ts + browserMock.ts + runtime.ts
  1. `vscodeApi.ts`: Call `acquireVsCodeApi()`, export `postMessage(msg)` and `getState()`
  2. `browserMock.ts`: Implement mock with `postMessage` that logs to console and `getState` that returns `{}`
  3. `runtime.ts`: Detect whether `acquireVsCodeApi` exists on window, export the correct implementation
  4. Export `onMessage(handler)` to register callbacks for incoming messages from the extension

- [ ] 2. Create webview-ui/src/office/types.ts
  1. Define `Position { x: number; y: number }`
  2. Define `CharacterState: 'idle' | 'walk' | 'type' | 'read' | 'waiting' | 'sleeping'`
  3. Define `FacingDir: 'up' | 'down' | 'left' | 'right'`
  4. Define `Character { id, position, targetPath, state, facingDir, palette, animFrame, animTimer, toolStatus?, bubbleType?, contextUsed?, contextMax?, rateLimited? }`
  5. Define `Seat { id, position, facingDir }`
  6. Define `FurnitureInstance { id, itemId, position, rotation, state }`
  7. Define `OfficeLayout { version, width, height, tiles, furniture, seats }`
  8. Define `EditorTool: 'select' | 'paint' | 'erase' | 'place' | 'eyedropper' | 'pick'`
  9. Define `TileType: 'empty' | 'floor' | 'wall'`

- [ ] 3. Create webview-ui/src/office/sprites/spriteData.ts
  1. Define `SpriteAnimation { frames: number[], frameDuration: number, loop: boolean }`
  2. Define animations per state: `idle` (1 frame), `walk-down/up/left/right` (4 frames each), `type` (2 frames), `read` (2 frames), `waiting` (2 frames), `sleeping` (2 frames)
  3. Define `SPRITE_SHEET_COLS` and `SPRITE_TILE_SIZE` (16px)
  4. Export `ANIMATIONS: Record<CharacterState | string, SpriteAnimation>`
  5. Export function `getFrameRect(frameIndex)` that returns `{ x, y, w, h }` in the spritesheet

- [ ] 4. Create webview-ui/src/office/sprites/spriteCache.ts
  1. Maintain `Map<string, ImageBitmap>` keyed by `"<spriteUrl>:<palette>"`
  2. Implement `preload(sprites: SpriteEntry[]): Promise<void>` — parallel fetch + `createImageBitmap`
  3. Implement `get(url, palette): ImageBitmap | undefined`
  4. Implement `applyPaletteSwap(bitmap, fromColors, toColors): ImageBitmap` using OffscreenCanvas + pixel manipulation
  5. Implement `clear()` to free memory on dispose

- [ ] 5. Create webview-ui/src/office/sprites/index.ts
  1. Load JSON from bubble-waiting.json and bubble-permission.json
  2. Export `getBubbleFrameRect(type, frame)` to get the bubble rect in its spritesheet
  3. Re-export spriteData and spriteCache

- [ ] 6. Create webview-ui/src/office/layout/tileMap.ts
  1. Implement `TileMap` class with internal 2D array
  2. `constructor(width, height)` — initialize all cells to `'empty'`
  3. `get(x, y): TileType`
  4. `set(x, y, type): void` — ignore out-of-bounds
  5. `clear(): void`
  6. `resize(newW, newH): void` — preserve existing tiles
  7. `toArray(): TileType[][]` — serializable
  8. `static fromArray(data): TileMap`

- [ ] 7. Create webview-ui/src/office/layout/furnitureCatalog.ts
  1. Define `FurnitureManifest { id, name, sprites, rotations, states, frames, size }`
  2. Implement `loadCatalog(manifestEntries: ManifestEntry[]): Promise<void>` — receive URIs + manifests from extension
  3. Implement `getCatalogItem(id): FurnitureManifest | undefined`
  4. Implement `getAllItems(): FurnitureManifest[]`
  5. Implement `getSpriteUrl(itemId, rotation, state, frame): string`

- [ ] 8. Create webview-ui/src/office/layout/layoutSerializer.ts
  1. Implement `serialize(layout: OfficeLayout): string` — JSON.stringify with indent 2
  2. Implement `deserialize(json: string): OfficeLayout | null` — parse + basic validation
  3. Implement `migrate(raw: unknown): OfficeLayout` — handle v1 layouts without a version field
  4. Add prototype pollution protection (skip `__proto__`, `constructor`, `prototype`)

- [ ] 9. Create webview-ui/src/office/colorize.ts
  1. Implement `colorizeCanvas(source: ImageBitmap, hue, saturation, brightness): ImageBitmap`
  2. Use OffscreenCanvas, read pixels with `getImageData`, apply HSB transformation
  3. Preserve alpha channel intact

- [ ] 10. Create webview-ui/src/office/floorTiles.ts
  1. Define `FloorTile { id, name, imageUrl }`
  2. Implement `loadFloorTiles(entries: FloorTileEntry[]): void` — receive from extension
  3. Implement `getFloorTile(id): FloorTile | undefined`
  4. Implement `getAllFloorTiles(): FloorTile[]`

- [ ] 11. Create webview-ui/src/office/wallTiles.ts
  1. Define `WallTileset { id, name, imageUrl, tileSize, cols }`
  2. Implement `loadWallTiles(entries: WallTileEntry[]): void`
  3. Implement `getWallTileRect(tilesetId, neighborMask: number): { x, y, w, h }` — 4-bit bitmask (N/E/S/W)
  4. Compute `neighborMask` for cell (x, y) by checking the 4 adjacent cells in the TileMap

- [ ] 12. Create webview-ui/src/office/engine/officeState.ts
  1. Define `OfficeState` with: `characters: Map<number, Character>`, `seats: Seat[]`, `layout: OfficeLayout`, `zoom: number`, `pan: Position`, `selectedCharacterId: number | null`
  2. Implement `addCharacter(id, folderName?)` — create Character at default position, assign first free seat
  3. Implement `removeCharacter(id)` — release seat
  4. Implement `setLayout(layout)` — replace layout and reinitialize seats from layout.seats
  5. Implement `assignSeat(characterId, seatId)` — reassign seat, trigger pathfinding
  6. Implement `setZoom(level)` — levels 1–4

- [ ] 13. Create webview-ui/src/office/engine/characters.ts
  1. Implement `updateCharacters(state: OfficeState, deltaMs: number): void`
  2. For each character: advance `animTimer`, change `animFrame` when it expires
  3. If character has `targetPath` and `state === 'walk'`: advance position toward next tile in path
  4. When the target tile is reached: pop next from path, or if path is empty → `state = 'idle'`, face desk
  5. Implement `bfsPath(tileMap, from, to, obstacles): Position[]` — BFS with 4 directions, return [] if no path
  6. Implement `setCharacterTool(character, toolName)` → map toolName to state (`type`/`read`/`idle`)
  7. Implement `clearCharacterTools(character)` → `state = 'idle'`
  8. Implement `setCharacterWaiting(character, waiting)` → `state = 'waiting'` or `'idle'`
  9. Implement `setCharacterSleeping(character, sleeping)` → `state = 'sleeping'` or `'idle'` (used for rate-limit)

- [ ] 14. Create webview-ui/src/office/engine/renderer.ts
  1. Implement `render(ctx: CanvasRenderingContext2D, state: OfficeState): void`
  2. Clear canvas
  3. Apply transform: `ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y)`
  4. Render floor tiles: iterate TileMap, draw colorized floor sprites
  5. Render wall tiles: pass through auto-tiling with neighborMask, draw correct tile
  6. Render furniture: draw furniture sprites with correct rotation/state
  7. Render character shadows: semi-transparent ellipses under each character
  8. Render characters: draw correct animation frame from spriteCache
  9. Render speech bubbles: if character has `bubbleType`, draw animated bubble above
  10. Render labels: if `alwaysShowLabels`, draw name/folder below character
  11. Render context bar: if `contextMax` is set, draw a small colored bar below character (green/yellow/red)
  12. In editor mode: render grid overlay, hover highlight, selection rectangle

- [ ] 15. Create webview-ui/src/office/engine/gameLoop.ts
  1. Implement `startGameLoop(canvas: HTMLCanvasElement, state: OfficeState): () => void`
  2. Loop with `requestAnimationFrame`, calculate deltaTime, cap at 100ms
  3. Call `updateCharacters(state, deltaTime)` every frame
  4. Call `processMessageQueue(state)` to drain pending VS Code messages
  5. Call `renderer.render(ctx, state)` every frame
  6. Return `stop()` function that cancels the rAF
  7. Implement `processMessageQueue`: map each message to mutations on `OfficeState`

- [ ] 16. Create webview-ui/src/office/engine/matrixEffect.ts
  1. Implement `MatrixEffect` with its own overlay canvas (position absolute, pointer-events: none)
  2. Columns of falling green characters, random speed per column
  3. Independent loop with `requestAnimationFrame`
  4. Export `start(container)` and `stop()`
  > **Note**: Easter egg — does not cover any requirement in product-spec or vision-final. If time is tight, this task is the first candidate to cut with no milestone impact.

- [ ] 17. Create webview-ui/src/office/editor/editorState.ts
  1. Define `EditorState { tool, selectedTileType, selectedFurnitureId, selectedRotation, undoStack, redoStack, isDragging, hoverPos }`
  2. Implement `pushUndo(layout)` — maximum 50 snapshots, mutate array (not immutable, for efficiency)
  3. Implement `undo(currentLayout)` → previous layout or null
  4. Implement `redo()` → next layout or null
  5. Implement `clearRedo()` — call on every action that is not undo/redo

- [ ] 18. Create webview-ui/src/office/editor/editorActions.ts
  1. Implement `paintTile(layout, pos, tileType): OfficeLayout` — return copy with modified tile
  2. Implement `eraseTile(layout, pos): OfficeLayout`
  3. Implement `placeFurniture(layout, pos, itemId, rotation): OfficeLayout`
  4. Implement `removeFurniture(layout, furnitureInstanceId): OfficeLayout`
  5. Implement `moveFurniture(layout, instanceId, newPos): OfficeLayout`
  6. Implement `eyedropper(layout, pos): TileType | string` — return tile type or furniture ID
  7. Implement `expandGrid(layout, direction): OfficeLayout` — grow by 1 tile in the given direction
  8. Every action must be pure (return new layout, do not mutate existing)

- [ ] 19. Create webview-ui/src/office/editor/EditorToolbar.tsx
  1. Buttons for each EditorTool (Select, Paint, Erase, Place, Eyedropper, Pick)
  2. Tile type selector (floor, wall) when tool is Paint
  3. Furniture catalog with thumbnails when tool is Place
  4. Undo/Redo buttons with Ctrl+Z / Ctrl+Y keybindings
  5. Props: `editorState`, `onToolChange`, `onTileTypeChange`, `onFurnitureSelect`, `onUndo`, `onRedo`

- [ ] 20. Update webview-ui/src/App.tsx to integrate game engine
  1. Mount `<canvas id="office-canvas">` at 100% of viewport
  2. In `useEffect`: initialize `OfficeState`, call `startGameLoop(canvas, state)`
  3. Register `onMessage` handler: enqueue messages for `processMessageQueue`
  4. Mouse events on canvas: click for selection/assignment, drag for pan, scroll for zoom
  5. Editor mode: conditionally render `EditorToolbar` and change cursor
  6. Cleanup in `useEffect` return: call `stop()` on the game loop

- [ ] 21. Verify build
  1. `bun run build` without TypeScript errors
  2. `bun run test:webview` passes

- [ ] 22. Verify runtime
  1. Characters appear when Claude Code agents are launched
  2. Characters walk when assigned to a seat
  3. Character animates as "type" when using write tools
  4. Speech bubble appears when agent is waiting for input
  5. Editor allows painting floor and wall tiles
  6. Undo/Redo works with Ctrl+Z / Ctrl+Y
