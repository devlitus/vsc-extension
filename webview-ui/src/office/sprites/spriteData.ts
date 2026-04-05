export interface SpriteAnimation {
  frames: number[];
  frameDuration: number;
  loop: boolean;
}

export const SPRITE_SHEET_COLS = 4;
export const SPRITE_TILE_SIZE = 16;

export const ANIMATIONS: Record<string, SpriteAnimation> = {
  idle: { frames: [0], frameDuration: 1000, loop: true },
  'walk-down': { frames: [0, 1, 2, 3], frameDuration: 150, loop: true },
  'walk-up': { frames: [4, 5, 6, 7], frameDuration: 150, loop: true },
  'walk-left': { frames: [8, 9, 10, 11], frameDuration: 150, loop: true },
  'walk-right': { frames: [12, 13, 14, 15], frameDuration: 150, loop: true },
  type: { frames: [0, 1], frameDuration: 200, loop: true },
  read: { frames: [0, 1], frameDuration: 300, loop: true },
  waiting: { frames: [0, 1], frameDuration: 500, loop: true },
};

export function getFrameRect(frameIndex: number): { x: number; y: number; w: number; h: number } {
  return {
    x: (frameIndex % SPRITE_SHEET_COLS) * SPRITE_TILE_SIZE,
    y: Math.floor(frameIndex / SPRITE_SHEET_COLS) * SPRITE_TILE_SIZE,
    w: SPRITE_TILE_SIZE,
    h: SPRITE_TILE_SIZE,
  };
}
