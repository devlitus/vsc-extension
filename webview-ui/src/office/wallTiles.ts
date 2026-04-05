import { TileMap } from './layout/tileMap';

export interface WallTileset {
  id: string;
  name: string;
  imageUrl: string;
  tileSize: number;
  cols: number;
}

interface WallTileEntry {
  id: string;
  name: string;
  imageUrl: string;
  tileSize: number;
  cols: number;
}

const wallTilesets = new Map<string, WallTileset>();

export function loadWallTiles(entries: WallTileEntry[]): void {
  for (const entry of entries) {
    wallTilesets.set(entry.id, {
      id: entry.id,
      name: entry.name,
      imageUrl: entry.imageUrl,
      tileSize: entry.tileSize,
      cols: entry.cols,
    });
  }
}

export function getWallTileRect(
  _tilesetId: string,
  neighborMask: number
): { x: number; y: number; w: number; h: number } {
  // Bitmask: N=1, E=2, S=4, W=8
  // In a real implementation, this would look up the correct sprite
  // based on the neighbor mask for auto-tiling
  const index = neighborMask % 16;
  const tileSize = 16;
  return {
    x: (index % 4) * tileSize,
    y: Math.floor(index / 4) * tileSize,
    w: tileSize,
    h: tileSize,
  };
}

export function computeNeighborMask(tileMap: TileMap, x: number, y: number): number {
  let mask = 0;
  if (tileMap.get(x, y - 1) === 'wall') mask |= 1; // North
  if (tileMap.get(x + 1, y) === 'wall') mask |= 2; // East
  if (tileMap.get(x, y + 1) === 'wall') mask |= 4; // South
  if (tileMap.get(x - 1, y) === 'wall') mask |= 8; // West
  return mask;
}
