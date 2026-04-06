export const KENNEY_STRIDE = 17;
export const KENNEY_TILE = 16;

function tile(col: number, row: number) {
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
