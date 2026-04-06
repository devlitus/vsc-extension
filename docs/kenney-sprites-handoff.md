# Handoff: Kenney Roguelike Indoors Sprites → Renderer

## Objetivo
Reemplazar el rendering canvas 2D hardcoded (rectángulos de colores) del office por sprites reales del tileset de Kenney, para mejorar el aspecto visual.

---

## Repo
`/home/carles/work/vsc-extension`  
Build: `bun run build` (ext + webview)  
Test: `bun run test`

---

## Tileset

**Archivo**: `kenney_roguelike-indoors/Tilesheets/roguelikeIndoor_transparent.png`  
**Licencia**: CC0 (dominio público)  
**Dimensiones**: 458×305 px, RGBA  
**Tile size**: 16×16 px  
**Margen entre tiles**: 1 px  
**Stride**: 17 px  
**Grid**: 27 columnas × 18 filas  
**Fórmula**: `src_x = col * 17`, `src_y = row * 17`

### Tiles identificados visualmente (col, row):

| Tile | Col | Row | Descripción |
|------|-----|-----|-------------|
| Silla naranja frente | 2 | 2 | Silla marrón con cojín naranja |
| Silla naranja variante | 3 | 2 | Silla marrón variante |
| Silla clara frente | 2 | 8 | Silla blanca/gris |
| Mesa/desk superficie | 5 | 5 | Superficie blanca de escritorio |
| Mesa/desk frente | 5 | 6 | Parte frontal escritorio |
| Mesa rectangular top-izq | 0 | 10 | Esquina de mesa grande |
| Mesa rectangular top | 1 | 10 | Centro de mesa grande |
| Mesa rectangular top-der | 2 | 10 | Esquina derecha |
| Planta (teal pot) | 16 | 0 | Planta verde en maceta teal |
| Planta variante | 17 | 0 | Otra planta verde |
| Cajón/estantería top | 0 | 12 | Parte superior armario/cajón |
| Cajón/estantería mid | 0 | 13 | Parte media |
| Cajón/estantería bot | 0 | 14 | Parte inferior |
| Alfombra ornamental | 16 | 14 | Alfombra decorativa |
| Piano/keyboard | 23 | 8 | Piano de pared |
| Candelabro | 19 | 0 | Candelabro decorativo |

> ⚠️ Verificar coordenadas ejecutando este script Python para generar PNGs anotados:
> ```bash
> python3 docs/gen_kenney_annotations.py
> # Genera /tmp/kenney_chairs_area.png, /tmp/kenney_tables_area.png, etc.
> ```

---

## Estado actual del código

### 1. Tileset analizado ✅
- PNG inspeccionado: 27×18 tiles, 16×16px, stride 17px
- Tiles útiles mapeados en la tabla arriba

### 2. Renderer — `webview-ui/src/office/engine/renderer.ts` ✅
Tiene funciones canvas 2D que hay que reemplazar con sprites:
- `drawDesk(ctx, gx, gy)` — rectángulos manuales
- `drawPlant(ctx, gx, gy)` — rectángulos manuales
- `drawBookshelf(ctx, gx, gy)` — rectángulos manuales
- `drawClock(ctx, gx, gy)` — arcos manuales
- `drawWaterCooler(ctx, gx, gy)` — rectángulos manuales
- `renderOfficeDecorations(ctx, width, height)` — llama a todos los anteriores
- `renderFurniture(ctx, furn)` — también usa canvas 2D
- `renderSeat(ctx, seat)` — silla con canvas 2D

`SPRITE_TILE_SIZE = 16` (importado de `../sprites/spriteData.ts`) — coincide exactamente con el tile size de Kenney ✅

### 3. Sistema de assets — `src/assetLoader.ts` ✅
- `getAssetUris(context, webview)` → devuelve `AssetManifest`
- El manifest se envía al webview como mensaje `assetsLoaded` desde `PixelAgentsViewProvider`
- En `App.tsx` los mensajes del webview se pasan a `enqueueMessage()` → `processMessageQueue()` en `gameLoop.ts`
- **Problema actual**: el manifest solo tiene `furniturePacks` con URIs de `assets/pixel-office/` (directorio inexistente)

### 4. CSP del webview — `src/PixelAgentsViewProvider.ts` ✅
La CSP ya permite imágenes: `img-src ${webview.cspSource} https: data:`  
Las imágenes deben cargarse via `asWebviewUri`, nunca rutas absolutas.

---

## Qué falta por hacer

### Paso 1: Copiar tileset a `media/`
```bash
cp kenney_roguelike-indoors/Tilesheets/roguelikeIndoor_transparent.png media/kenney_tileset.png
```

### Paso 2: Añadir `tilesetUri` al `AssetManifest`

**`src/types.ts`** — añadir campo:
```ts
export interface AssetManifest {
  furniturePacks: Array<{ id: string; name: string; uris: Record<string, string> }>;
  tilesetUri?: string;  // ← añadir esto
}
```

**`src/assetLoader.ts`** — en `getAssetUris()`, después de construir el manifest:
```ts
const tilesetUri = webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'media', 'kenney_tileset.png')
);
manifest.tilesetUri = tilesetUri.toString();
```

### Paso 3: Propagar URI al game loop

**`webview-ui/src/App.tsx`** — en el `handleMessage`, antes del `enqueueMessage` final:
```ts
if (message.type === 'assetsLoaded') {
  const manifest = message.manifest as { tilesetUri?: string } | null;
  if (manifest?.tilesetUri) {
    enqueueMessage({ type: 'tilesetReady', uri: manifest.tilesetUri });
  }
  return;
}
```

**`webview-ui/src/office/engine/gameLoop.ts`** — en `processMessageQueue`, añadir case:
```ts
import { initTileset } from '../sprites/kenneySprites';

case 'tilesetReady':
  if (typeof message.uri === 'string') {
    initTileset(message.uri);
  }
  break;
```

### Paso 4: Crear `webview-ui/src/office/sprites/kenneySprites.ts`

```ts
export const KENNEY_STRIDE = 17;
export const KENNEY_TILE = 16;

export function tile(col: number, row: number) {
  return { sx: col * KENNEY_STRIDE, sy: row * KENNEY_STRIDE };
}

export const TILES = {
  chairOrange:    tile(2, 2),
  chairOrangeAlt: tile(3, 2),
  chairWhite:     tile(2, 8),
  deskSurface:    tile(5, 5),
  deskFront:      tile(5, 6),
  tableTopLeft:   tile(0, 10),
  tableTopMid:    tile(1, 10),
  tableTopRight:  tile(2, 10),
  tableMidLeft:   tile(0, 11),
  tableMidMid:    tile(1, 11),
  tableMidRight:  tile(2, 11),
  plant:          tile(16, 0),
  plantAlt:       tile(17, 0),
  cabinetTop:     tile(0, 12),
  cabinetMid:     tile(0, 13),
  cabinetBot:     tile(0, 14),
  rug:            tile(16, 14),
  piano:          tile(23, 8),
  candelabra:     tile(19, 0),
};

let tilesetImage: HTMLImageElement | null = null;

export function initTileset(uri: string): void {
  const img = new Image();
  img.onload = () => { tilesetImage = img; };
  img.src = uri;
}

export function getTileset(): HTMLImageElement | null {
  return tilesetImage;
}

export function drawKenneyTile(
  ctx: CanvasRenderingContext2D,
  tileCoord: { sx: number; sy: number },
  gx: number,
  gy: number,
  tileSize: number = KENNEY_TILE
): void {
  if (!tilesetImage) return;
  ctx.drawImage(
    tilesetImage,
    tileCoord.sx, tileCoord.sy, KENNEY_TILE, KENNEY_TILE,
    gx * tileSize, gy * tileSize, tileSize, tileSize
  );
}
```

### Paso 5: Actualizar `renderer.ts`

Añadir import al principio:
```ts
import { drawKenneyTile, TILES } from '../sprites/kenneySprites';
```

Reemplazar las funciones canvas 2D por sprites:
```ts
function drawDesk(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  drawKenneyTile(ctx, TILES.deskSurface, gx, gy);
  drawKenneyTile(ctx, TILES.deskFront, gx, gy + 1);
}

function drawPlant(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  drawKenneyTile(ctx, TILES.plant, gx, gy);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  drawKenneyTile(ctx, TILES.cabinetTop, gx, gy);
  drawKenneyTile(ctx, TILES.cabinetMid, gx, gy + 1);
  drawKenneyTile(ctx, TILES.cabinetBot, gx, gy + 2);
}
```

Reemplazar `renderSeat`:
```ts
function renderSeat(ctx: CanvasRenderingContext2D, seat: Seat): void {
  drawKenneyTile(ctx, TILES.chairOrange, seat.position.x, seat.position.y);
}
```

Eliminar `drawClock` y `drawWaterCooler` (no hay tiles equivalentes, o dejar canvas 2D como fallback).

### Paso 6: Verificar `.vscodeignore`
Asegurarse de que `media/` no está excluido del vsix.

### Paso 7: Build y test
```bash
bun run build
bun run package
code --install-extension work-agents-*.vsix
```

---

## Notas clave

- **Tile size coincide**: `SPRITE_TILE_SIZE = 16` en el office = tile size de Kenney = sin escalado necesario ✅
- **CSP**: imágenes solo via `asWebviewUri` — nunca `file://` ni rutas absolutas
- **Personajes**: el renderer dibuja agentes con canvas 2D pixel art manual → **NO cambiar**, Kenney no tiene personajes compatibles
- **Fallback**: si `tilesetImage === null` (imagen no cargada aún), `drawKenneyTile` no hace nada — el office aparece vacío hasta que carga. Considerar mantener canvas 2D como fallback mientras carga.
- **El tileset es roguelike/fantasy**, no oficina moderna: no hay monitores ni teclados, pero hay mesas, sillas, plantas y armarios perfectamente válidos
