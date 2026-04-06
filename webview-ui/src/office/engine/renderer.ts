import { Character, Seat, FurnitureInstance, SubagentCharacter } from '../types';
import type { OfficeState } from './officeState';
import { SPRITE_TILE_SIZE, get } from '../sprites';
import { getWallTileRect, computeNeighborMask } from '../wallTiles';
import { get as getSprite } from '../sprites/spriteCache';

export class Renderer {
  private wallTileRectCache: Map<string, { x: number; y: number; w: number; h: number }> = new Map();
  private lastLayoutVersion: number = -1;

  render(ctx: CanvasRenderingContext2D, state: OfficeState): void {
    const { zoom, pan, tileMap, layout } = state;

    // Check if layout changed, invalidate cache if needed
    if (this.lastLayoutVersion !== layout.version) {
      this.wallTileRectCache.clear();
      this.lastLayoutVersion = layout.version;
    }

    // Clear canvas
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Set transform for zoom/pan
    ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);

    // Render floor tiles
    for (let y = 0; y < tileMap.height; y++) {
      for (let x = 0; x < tileMap.width; x++) {
        const tile = tileMap.get(x, y);
        if (tile === 'floor') {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(x * SPRITE_TILE_SIZE, y * SPRITE_TILE_SIZE, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
        } else if (tile === 'wall') {
          const mask = computeNeighborMask(tileMap, x, y);
          const cacheKey = `${x},${y},${mask}`;
          let rect = this.wallTileRectCache.get(cacheKey);
          if (!rect) {
            rect = getWallTileRect('default', mask);
            this.wallTileRectCache.set(cacheKey, rect);
          }
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x * SPRITE_TILE_SIZE, y * SPRITE_TILE_SIZE, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
        }
      }
    }

    // Render furniture
    for (const furn of layout.furniture ?? []) {
      renderFurniture(ctx, furn);
    }

    // Render seats
    for (const seat of state.seats) {
      renderSeat(ctx, seat);
    }

    // Render character shadows
    for (const character of state.characters.values()) {
      renderCharacterShadow(ctx, character);
    }

    // Render characters
    for (const character of state.characters.values()) {
      renderCharacter(ctx, character);
    }

    // Render speech bubbles
    for (const character of state.characters.values()) {
      if (character.bubbleType) {
        renderBubble(ctx, character);
      }
    }

    // Render task assignment speech bubbles (bubbleText)
    for (const character of state.characters.values()) {
      if (character.bubbleText) {
        const x = character.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
        const y = character.position.y * SPRITE_TILE_SIZE - 10;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(character.bubbleText, x, y);
      }
    }

    // Render subagent links
    for (const subagent of state.subagents.values()) {
      renderSubagentLink(ctx, subagent, state);
    }

    // Render subagents
    for (const subagent of state.subagents.values()) {
      renderSubagent(ctx, subagent);
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  clearCache(): void {
    this.wallTileRectCache.clear();
  }
}

// Default renderer instance
const defaultRenderer = new Renderer();

// Backwards-compatible render function
export function render(ctx: CanvasRenderingContext2D, state: OfficeState): void {
  defaultRenderer.render(ctx, state);
}

function renderFurniture(ctx: CanvasRenderingContext2D, furn: FurnitureInstance): void {
  const x = furn.position.x * SPRITE_TILE_SIZE;
  const y = furn.position.y * SPRITE_TILE_SIZE;
  
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(x, y, SPRITE_TILE_SIZE * 2, SPRITE_TILE_SIZE);
}

function renderSeat(ctx: CanvasRenderingContext2D, seat: Seat): void {
  const x = seat.position.x * SPRITE_TILE_SIZE;
  const y = seat.position.y * SPRITE_TILE_SIZE;
  
  ctx.fillStyle = '#4a6a8a';
  ctx.beginPath();
  ctx.arc(x + SPRITE_TILE_SIZE / 2, y + SPRITE_TILE_SIZE / 2, SPRITE_TILE_SIZE / 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderCharacterShadow(ctx: CanvasRenderingContext2D, character: Character): void {
  const x = character.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const y = character.position.y * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE - 2;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, SPRITE_TILE_SIZE / 2, SPRITE_TILE_SIZE / 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function renderCharacter(ctx: CanvasRenderingContext2D, character: Character): void {
  const x = character.position.x * SPRITE_TILE_SIZE;
  const y = character.position.y * SPRITE_TILE_SIZE;

  // Determine sprite URL based on character state and facing direction
  const spriteUrl = `/sprites/characters/${character.state}-${character.facingDir}.png`;
  const sprite = getSprite(spriteUrl, character.palette);

  if (sprite) {
    ctx.drawImage(
      sprite,
      x, // x offset (center)
      y - 8, // y offset (bottom anchor)
      SPRITE_TILE_SIZE, // width
      SPRITE_TILE_SIZE  // height
    );
  } else {
    // Fallback to colored rectangle if sprite not loaded
    const colors: Record<string, string> = {
      idle: '#6a6',
      walk: '#6a6',
      type: '#aa6',
      read: '#66a',
      waiting: '#a66',
    };

    ctx.fillStyle = colors[character.state] ?? '#6a6';
    ctx.fillRect(x, y, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);

    // Draw facing direction indicator
    ctx.fillStyle = '#fff';
    const eyeX = x + SPRITE_TILE_SIZE / 2;
    const eyeY = y + SPRITE_TILE_SIZE / 3;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Render context bar if contextMax is defined and contextUsed is set
  if (character.contextMax !== undefined && character.contextMax > 0 && character.contextUsed !== undefined) {
    const contextUsed = character.contextUsed;
    const ratio = Math.min(contextUsed / character.contextMax, 1);

    const barWidth = SPRITE_TILE_SIZE;
    const barHeight = 3;
    const barX = x;
    const barY = y + SPRITE_TILE_SIZE + 2;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Fill based on ratio with color thresholds
    let barColor = '#4ade80'; // green < 60%
    if (ratio >= 0.85) {
      barColor = '#f87171'; // red >= 85%
    } else if (ratio >= 0.60) {
      barColor = '#fbbf24'; // yellow 60-85%
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
  }

  // Render energy bar if rate limited
  if (character.isRateLimited) {
    const barWidth = SPRITE_TILE_SIZE;
    const barHeight = 3;
    const barX = x;
    const barY = y + SPRITE_TILE_SIZE + 6;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Rate limited = empty bar (energy depleted), yellow border
    ctx.fillStyle = '#fbbf24'; // yellow
    ctx.fillRect(barX, barY, 0, barHeight);
  }
}

function renderBubble(ctx: CanvasRenderingContext2D, character: Character): void {
  if (!character.bubbleType) return;

  const x = character.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const y = character.position.y * SPRITE_TILE_SIZE - SPRITE_TILE_SIZE;

  if (character.bubbleType === 'zzz') {
    // ZZZ bubble for rate limited
    ctx.fillStyle = '#aaccff';
    ctx.font = '10px monospace';
    ctx.fillText('zzZ', x - 6, y);
    return;
  }

  if (character.bubbleType === 'done') {
    // Green checkmark bubble for turn completion
    ctx.fillStyle = '#4ade80'; // Green background
    ctx.beginPath();
    ctx.ellipse(x, y, SPRITE_TILE_SIZE / 2, SPRITE_TILE_SIZE / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw checkmark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 1, y + 3);
    ctx.lineTo(x + 4, y - 3);
    ctx.stroke();

    // Triangle pointer
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + SPRITE_TILE_SIZE / 3);
    ctx.lineTo(x + 4, y + SPRITE_TILE_SIZE / 3);
    ctx.lineTo(x, y + SPRITE_TILE_SIZE / 3 + 6);
    ctx.fill();
    return;
  }

  // Default bubble (permission or waiting)
  ctx.fillStyle = character.bubbleType === 'permission' ? '#ffcc00' : '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, SPRITE_TILE_SIZE / 2, SPRITE_TILE_SIZE / 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Triangle pointer
  ctx.beginPath();
  ctx.moveTo(x - 4, y + SPRITE_TILE_SIZE / 3);
  ctx.lineTo(x + 4, y + SPRITE_TILE_SIZE / 3);
  ctx.lineTo(x, y + SPRITE_TILE_SIZE / 3 + 6);
  ctx.fill();
}

function renderSubagent(ctx: CanvasRenderingContext2D, subagent: SubagentCharacter): void {
  const x = subagent.position.x * SPRITE_TILE_SIZE;
  const y = subagent.position.y * SPRITE_TILE_SIZE;
  const scale = 0.75;
  const scaledSize = SPRITE_TILE_SIZE * scale;
  const offset = (SPRITE_TILE_SIZE - scaledSize) / 2;
  
  // Render at 0.75x scale
  ctx.fillStyle = '#88aacc';
  ctx.fillRect(x + offset, y + offset, scaledSize, scaledSize);
  
  // Subagent indicator
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + SPRITE_TILE_SIZE / 2, y + SPRITE_TILE_SIZE / 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function renderSubagentLink(ctx: CanvasRenderingContext2D, subagent: SubagentCharacter, state: OfficeState): void {
  const parent = state.characters.get(subagent.linkedToParentId);
  if (!parent) return;
  
  const subX = subagent.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const subY = subagent.position.y * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const parentX = parent.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const parentY = parent.position.y * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  
  ctx.strokeStyle = '#666666';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(parentX, parentY);
  ctx.lineTo(subX, subY);
  ctx.stroke();
  ctx.setLineDash([]);
}
