import { FloorTile } from './types';

interface FloorTileEntry {
  id: string;
  name: string;
  imageUrl: string;
}

const floorTiles = new Map<string, FloorTile>();

export function loadFloorTiles(entries: FloorTileEntry[]): void {
  for (const entry of entries) {
    floorTiles.set(entry.id, {
      id: entry.id,
      name: entry.name,
      imageUrl: entry.imageUrl,
    });
  }
}

export function getFloorTile(id: string): FloorTile | undefined {
  return floorTiles.get(id);
}

export function getAllFloorTiles(): FloorTile[] {
  return [...floorTiles.values()];
}
