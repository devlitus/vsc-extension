# Phase 4 — Movement: Tasks

## Tasks

- [ ] 1. Crear webview-ui/src/vscodeApi.ts + browserMock.ts + runtime.ts
  1. `vscodeApi.ts`: Llamar `acquireVsCodeApi()`, exportar `postMessage(msg)` y `getState()`
  2. `browserMock.ts`: Implementar mock con `postMessage` que loguea en consola y `getState` que retorna `{}`
  3. `runtime.ts`: Detectar si `acquireVsCodeApi` existe (window), exportar la implementación correcta
  4. Exportar `onMessage(handler)` para registrar callbacks de mensajes entrantes desde la extension

- [ ] 2. Crear webview-ui/src/office/types.ts
  1. Definir `Position { x: number; y: number }`
  2. Definir `CharacterState: 'idle' | 'walk' | 'type' | 'read' | 'waiting'`
  3. Definir `FacingDir: 'up' | 'down' | 'left' | 'right'`
  4. Definir `Character { id, position, targetPath, state, facingDir, palette, animFrame, animTimer, toolStatus?, bubbleType? }`
  5. Definir `Seat { id, position, facingDir }`
  6. Definir `FurnitureInstance { id, itemId, position, rotation, state }`
  7. Definir `OfficeLayout { version, width, height, tiles, furniture, seats }`
  8. Definir `EditorTool: 'select' | 'paint' | 'erase' | 'place' | 'eyedropper' | 'pick'`
  9. Definir `TileType: 'empty' | 'floor' | 'wall'`

- [ ] 3. Crear webview-ui/src/office/sprites/spriteData.ts
  1. Definir `SpriteAnimation { frames: number[], frameDuration: number, loop: boolean }`
  2. Definir animaciones por estado: `idle` (1 frame), `walk-down/up/left/right` (4 frames cada una), `type` (2 frames), `read` (2 frames), `waiting` (2 frames)
  3. Definir `SPRITE_SHEET_COLS` y `SPRITE_TILE_SIZE` (16px)
  4. Exportar `ANIMATIONS: Record<CharacterState | string, SpriteAnimation>`
  5. Exportar función `getFrameRect(frameIndex)` que retorna `{ x, y, w, h }` en el spritesheet

- [ ] 4. Crear webview-ui/src/office/sprites/spriteCache.ts
  1. Mantener `Map<string, ImageBitmap>` con clave `"<spriteUrl>:<palette>"`
  2. Implementar `preload(sprites: SpriteEntry[]): Promise<void>` — fetch + `createImageBitmap` en paralelo
  3. Implementar `get(url, palette): ImageBitmap | undefined`
  4. Implementar `applyPaletteSwap(bitmap, fromColors, toColors): ImageBitmap` con OffscreenCanvas + pixel manipulation
  5. Implementar `clear()` para liberar memoria en dispose

- [ ] 5. Crear webview-ui/src/office/sprites/index.ts
  1. Cargar JSON de bubble-waiting.json y bubble-permission.json
  2. Exportar `getBubbleFrameRect(type, frame)` para obtener rect de la burbuja en su spritesheet
  3. Re-exportar spriteData y spriteCache

- [ ] 6. Crear webview-ui/src/office/layout/tileMap.ts
  1. Implementar clase `TileMap` con array 2D interno
  2. `constructor(width, height)` — inicializa todo en `'empty'`
  3. `get(x, y): TileType`
  4. `set(x, y, type): void` — ignorar out-of-bounds
  5. `clear(): void`
  6. `resize(newW, newH): void` — preservar tiles existentes
  7. `toArray(): TileType[][]` — serializable
  8. `static fromArray(data): TileMap`

- [ ] 7. Crear webview-ui/src/office/layout/furnitureCatalog.ts
  1. Definir `FurnitureManifest { id, name, sprites, rotations, states, frames, size }`
  2. Implementar `loadCatalog(manifestEntries: ManifestEntry[]): Promise<void>` — recibir URIs + manifests desde extension
  3. Implementar `getCatalogItem(id): FurnitureManifest | undefined`
  4. Implementar `getAllItems(): FurnitureManifest[]`
  5. Implementar `getSpriteUrl(itemId, rotation, state, frame): string`

- [ ] 8. Crear webview-ui/src/office/layout/layoutSerializer.ts
  1. Implementar `serialize(layout: OfficeLayout): string` — JSON.stringify con indent 2
  2. Implementar `deserialize(json: string): OfficeLayout | null` — parse + validación básica
  3. Implementar `migrate(raw: unknown): OfficeLayout` — manejar layouts v1 sin campo version
  4. Añadir protección prototype pollution (skip `__proto__`, `constructor`, `prototype`)

- [ ] 9. Crear webview-ui/src/office/colorize.ts
  1. Implementar `colorizeCanvas(source: ImageBitmap, hue, saturation, brightness): ImageBitmap`
  2. Usar OffscreenCanvas, leer pixels con `getImageData`, aplicar transformación HSB
  3. Preservar canal alpha intacto

- [ ] 10. Crear webview-ui/src/office/floorTiles.ts
  1. Definir `FloorTile { id, name, imageUrl }`
  2. Implementar `loadFloorTiles(entries: FloorTileEntry[]): void` — recibir desde extension
  3. Implementar `getFloorTile(id): FloorTile | undefined`
  4. Implementar `getAllFloorTiles(): FloorTile[]`

- [ ] 11. Crear webview-ui/src/office/wallTiles.ts
  1. Definir `WallTileset { id, name, imageUrl, tileSize, cols }`
  2. Implementar `loadWallTiles(entries: WallTileEntry[]): void`
  3. Implementar `getWallTileRect(tilesetId, neighborMask: number): { x, y, w, h }` — bitmask 4-bit (N/E/S/W)
  4. Computar `neighborMask` para celda (x, y) mirando las 4 celdas adyacentes en el TileMap

- [ ] 12. Crear webview-ui/src/office/engine/officeState.ts
  1. Definir `OfficeState` con: `characters: Map<number, Character>`, `seats: Seat[]`, `layout: OfficeLayout`, `zoom: number`, `pan: Position`, `selectedCharacterId: number | null`
  2. Implementar `addCharacter(id, folderName?)` — crear Character en posición por defecto, asignar primer seat libre
  3. Implementar `removeCharacter(id)` — liberar seat
  4. Implementar `setLayout(layout)` — reemplazar layout y reinicializar seats desde layout.seats
  5. Implementar `assignSeat(characterId, seatId)` — reasignar seat, desencadenar pathfinding
  6. Implementar `setZoom(level)` — niveles 1-4

- [ ] 13. Crear webview-ui/src/office/engine/characters.ts
  1. Implementar `updateCharacters(state: OfficeState, deltaMs: number): void`
  2. Por cada character: avanzar `animTimer`, cambiar `animFrame` cuando vence
  3. Si character tiene `targetPath` y `state === 'walk'`: avanzar posición hacia siguiente tile en el path
  4. Cuando llega al tile destino: sacar siguiente de la path, o si path vacía → `state = 'idle'`, orientar hacia desk
  5. Implementar `bfsPath(tileMap, from, to, obstacles): Position[]` — BFS con 4 direcciones, devolver [] si no hay camino
  6. Implementar `setCharacterTool(character, toolName)` → mapear toolName a state (`type`/`read`/`idle`)
  7. Implementar `clearCharacterTools(character)` → `state = 'idle'`
  8. Implementar `setCharacterWaiting(character, waiting)` → `state = 'waiting'` o `'idle'`

- [ ] 14. Crear webview-ui/src/office/engine/renderer.ts
  1. Implementar `render(ctx: CanvasRenderingContext2D, state: OfficeState): void`
  2. Clear canvas
  3. Pasar transformación: `ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y)`
  4. Renderizar floor tiles: iterar TileMap, dibujar sprites de suelo colorizado
  5. Renderizar wall tiles: pasar por auto-tiling con neighborMask, dibujar tile correcto
  6. Renderizar furniture: dibujar sprites de muebles con rotación/estado correcto
  7. Renderizar character shadows: elipses semi-transparentes bajo cada personaje
  8. Renderizar characters: dibujar frame de animación correcto desde spriteCache
  9. Renderizar speech bubbles: si character tiene `bubbleType`, dibujar burbuja animada encima
  10. Renderizar labels: si `alwaysShowLabels`, dibujar nombre/folder debajo del personaje
  11. En editor mode: renderizar grid overlay, hover highlight, selection rectangle

- [ ] 15. Crear webview-ui/src/office/engine/gameLoop.ts
  1. Implementar `startGameLoop(canvas: HTMLCanvasElement, state: OfficeState): () => void`
  2. Loop con `requestAnimationFrame`, calcular deltaTime, cap en 100ms
  3. Llamar `updateCharacters(state, deltaTime)` cada frame
  4. Llamar `processMessageQueue(state)` para drenar mensajes VS Code pendientes
  5. Llamar `renderer.render(ctx, state)` cada frame
  6. Retornar función `stop()` que cancela el rAF
  7. Implementar `processMessageQueue`: mapear cada mensaje a mutaciones en `OfficeState`

- [ ] 16. Crear webview-ui/src/office/engine/matrixEffect.ts
  1. Implementar `MatrixEffect` con su propio canvas overlay (posición absolute, pointer-events: none)
  2. Columnas de caracteres verdes cayendo, velocidad aleatoria por columna
  3. Loop independiente con `requestAnimationFrame`
  4. Exportar `start(container)` y `stop()`

- [ ] 17. Crear webview-ui/src/office/editor/editorState.ts
  1. Definir `EditorState { tool, selectedTileType, selectedFurnitureId, selectedRotation, undoStack, redoStack, isDragging, hoverPos }`
  2. Implementar `pushUndo(layout)` — máximo 50 snapshots, mutar array (no inmutable para eficiencia)
  3. Implementar `undo(currentLayout)` → layout anterior o null
  4. Implementar `redo()` → layout posterior o null
  5. Implementar `clearRedo()` — llamar en cada acción que no sea undo/redo

- [ ] 18. Crear webview-ui/src/office/editor/editorActions.ts
  1. Implementar `paintTile(layout, pos, tileType): OfficeLayout` — retornar copia con tile modificado
  2. Implementar `eraseTile(layout, pos): OfficeLayout`
  3. Implementar `placeFurniture(layout, pos, itemId, rotation): OfficeLayout`
  4. Implementar `removeFurniture(layout, furnitureInstanceId): OfficeLayout`
  5. Implementar `moveFurniture(layout, instanceId, newPos): OfficeLayout`
  6. Implementar `eyedropper(layout, pos): TileType | string` — retornar tipo de tile o ID de furniture
  7. Implementar `expandGrid(layout, direction): OfficeLayout` — crecer en 1 tile en la dirección
  8. Cada acción debe ser pura (retornar nuevo layout, no mutar el existente)

- [ ] 19. Crear webview-ui/src/office/editor/EditorToolbar.tsx
  1. Botones para cada EditorTool (Select, Paint, Erase, Place, Eyedropper, Pick)
  2. Selector de tipo de tile (floor, wall) cuando tool es Paint
  3. Catálogo de furniture con thumbnails cuando tool es Place
  4. Undo/Redo buttons con Ctrl+Z / Ctrl+Y keybindings
  5. Props: `editorState`, `onToolChange`, `onTileTypeChange`, `onFurnitureSelect`, `onUndo`, `onRedo`

- [ ] 20. Actualizar webview-ui/src/App.tsx para integrar game engine
  1. Montar canvas `<canvas id="office-canvas">` al 100% del viewport
  2. En `useEffect`: inicializar `OfficeState`, llamar `startGameLoop(canvas, state)`
  3. Registrar `onMessage` handler: encolar mensajes para `processMessageQueue`
  4. Mouse events en canvas: click para selección/asignación, drag para pan, scroll para zoom
  5. Modo editor: condicionar render de `EditorToolbar` y cambio de cursor
  6. Cleanup en `useEffect` return: llamar `stop()` del game loop

- [ ] 21. Verificar compilación
  1. `bun run build` sin errores de TypeScript
  2. `bun run test:webview` pasa

- [ ] 22. Verificar runtime
  1. Personajes aparecen al lanzar agentes Claude Code
  2. Personajes caminan al asignarse a un seat
  3. Personaje anima tipo "type" al usar herramientas de escritura
  4. Speech bubble aparece cuando agente está esperando input
  5. Editor permite pintar floor y wall tiles
  6. Undo/Redo funciona con Ctrl+Z / Ctrl+Y
