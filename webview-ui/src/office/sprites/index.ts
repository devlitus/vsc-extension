export { ANIMATIONS, getFrameRect, SPRITE_SHEET_COLS, SPRITE_TILE_SIZE, type SpriteAnimation } from './spriteData';
export { preload, get, applyPaletteSwap, clear, type SpriteEntry } from './spriteCache';

interface BubbleFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Default bubble frame rects (these would come from JSON in real impl)
const BUBBLE_FRAMES: Record<string, BubbleFrame[]> = {
  permission: [{ x: 0, y: 0, w: 32, h: 24 }],
  waiting: [{ x: 0, y: 24, w: 32, h: 24 }],
};

export function getBubbleFrameRect(type: string, frame: number): BubbleFrame {
  const frames = BUBBLE_FRAMES[type] ?? BUBBLE_FRAMES.waiting;
  return frames[frame % frames.length];
}
