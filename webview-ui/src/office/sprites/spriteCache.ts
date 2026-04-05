import type { SpriteEntry } from '../types';
export type { SpriteEntry } from '../types';

interface CachedSprite {
  bitmap: ImageBitmap;
  palette?: string;
}

const cache = new Map<string, CachedSprite>();

// Trusted origins for sprite loading
const ALLOWED_ORIGINS = ['vscode-webview:', 'https://', 'http://localhost:'];

function isAllowedUrl(url: string): boolean {
  // Check for vscode-webview scheme or whitelisted http origins
  for (const origin of ALLOWED_ORIGINS) {
    if (url.startsWith(origin)) {
      return true;
    }
  }
  return false;
}

export async function preload(sprites: SpriteEntry[]): Promise<void> {
  const promises = sprites.map(async (sprite) => {
    const key = `${sprite.url}:${sprite.palette ?? 'default'}`;
    if (cache.has(key)) return;
    
    // Validate URL before loading
    if (!isAllowedUrl(sprite.url)) {
      console.error(`Sprite URL not allowed: ${sprite.url}`);
      return;
    }
    
    try {
      const response = await fetch(sprite.url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      cache.set(key, { bitmap, palette: sprite.palette });
    } catch (err) {
      console.error(`Failed to preload sprite: ${sprite.url}`, err);
    }
  });
  
  await Promise.all(promises);
}

export function get(url: string, palette?: string): ImageBitmap | undefined {
  const key = `${url}:${palette ?? 'default'}`;
  return cache.get(key)?.bitmap;
}

export function applyPaletteSwap(
  bitmap: ImageBitmap,
  _fromColors: string[],
  _toColors: string[]
): ImageBitmap {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return bitmap;
  
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Palette swap implementation
  // In a real implementation, this would map colors
  // For now, just return the original
  return bitmap;
}

export function clear(): void {
  for (const sprite of cache.values()) {
    sprite.bitmap.close();
  }
  cache.clear();
}
