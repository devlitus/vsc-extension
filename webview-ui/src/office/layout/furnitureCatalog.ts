export interface FurnitureManifest {
  id: string;
  name: string;
  sprites: string[];
  rotations: string[];
  states: string[];
  frames: number;
  size: { w: number; h: number };
}

interface CatalogEntry {
  manifest: FurnitureManifest;
  baseUrl: string;
}

const catalog = new Map<string, CatalogEntry>();

export async function loadCatalog(manifestEntries: Array<{ uri: string; manifest: FurnitureManifest }>): Promise<void> {
  for (const entry of manifestEntries) {
    catalog.set(entry.manifest.id, {
      manifest: entry.manifest,
      baseUrl: entry.uri.replace(/\/[^/]+$/, ''),
    });
  }
}

export function getCatalogItem(id: string): FurnitureManifest | undefined {
  return catalog.get(id)?.manifest;
}

export function getAllItems(): FurnitureManifest[] {
  return [...catalog.values()].map(e => e.manifest);
}

export function getSpriteUrl(itemId: string, rotation: number, state: string, frame: number): string {
  const entry = catalog.get(itemId);
  if (!entry) return '';
  
  const { manifest } = entry;
  const rotIndex = rotation % manifest.rotations.length;
  const stateIndex = manifest.states.indexOf(state);
  const frameIndex = frame % manifest.frames;
  
  const spriteIndex = rotIndex + (stateIndex * manifest.rotations.length) + (frameIndex * manifest.rotations.length * manifest.states.length);
  const spriteName = manifest.sprites[spriteIndex % manifest.sprites.length] ?? manifest.sprites[0];
  
  return `${entry.baseUrl}/${spriteName}`;
}
