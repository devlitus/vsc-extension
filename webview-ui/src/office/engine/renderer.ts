import { Character, Seat, FurnitureInstance, SubagentCharacter } from '../types';
import type { OfficeState } from './officeState';
import { SPRITE_TILE_SIZE, get } from '../sprites';
import { getWallTileRect, computeNeighborMask } from '../wallTiles';
import { get as getSprite } from '../sprites/spriteCache';
import { drawKenneyTile, TILES } from '../sprites/kenneySprites';

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
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Set transform for zoom/pan
    ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);

    // Render floor tiles
    for (let y = 0; y < tileMap.height; y++) {
      for (let x = 0; x < tileMap.width; x++) {
        const tile = tileMap.get(x, y);
        if (tile === 'floor') {
          const px = x * SPRITE_TILE_SIZE;
          const py = y * SPRITE_TILE_SIZE;
          // Wood plank base
          const shade = (x + y) % 2 === 0 ? '#c8964a' : '#b8864a';
          ctx.fillStyle = shade;
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
          // Plank lines
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, 1);
          ctx.fillRect(px, py, 1, SPRITE_TILE_SIZE);
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(px + 1, py + 1, SPRITE_TILE_SIZE - 2, 2);
        } else if (tile === 'floor2') {
          const px = x * SPRITE_TILE_SIZE;
          const py = y * SPRITE_TILE_SIZE;
          // Light ceramic tile (break room)
          const shade = (x + y) % 2 === 0 ? '#ddd4c0' : '#cdc4b0';
          ctx.fillStyle = shade;
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
          // Grout lines
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, 1);
          ctx.fillRect(px, py, 1, SPRITE_TILE_SIZE);
          // Sheen
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(px + 1, py + 1, SPRITE_TILE_SIZE - 2, 2);
        } else if (tile === 'carpet') {
          const px = x * SPRITE_TILE_SIZE;
          const py = y * SPRITE_TILE_SIZE;
          // Blue-grey carpet (conference room)
          const shade = (x + y) % 2 === 0 ? '#3a6888' : '#346078';
          ctx.fillStyle = shade;
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
          // Carpet weave lines
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(px, py + 4, SPRITE_TILE_SIZE, 1);
          ctx.fillRect(px, py + 8, SPRITE_TILE_SIZE, 1);
          ctx.fillRect(px, py + 12, SPRITE_TILE_SIZE, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(px, py, 1, SPRITE_TILE_SIZE);
        } else if (tile === 'wall') {
          const px = x * SPRITE_TILE_SIZE;
          const py = y * SPRITE_TILE_SIZE;
          const mask = computeNeighborMask(tileMap, x, y);
          const cacheKey = `${x},${y},${mask}`;
          let rect = this.wallTileRectCache.get(cacheKey);
          if (!rect) {
            rect = getWallTileRect('default', mask);
            this.wallTileRectCache.set(cacheKey, rect);
          }
          // Wall base
          ctx.fillStyle = '#4a3f6b';
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
          // Wall bricks pattern
          const brickRow = y % 2;
          const brickOffset = brickRow === 0 ? 0 : SPRITE_TILE_SIZE / 2;
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, 1);
          ctx.fillRect(px + brickOffset, py, 1, SPRITE_TILE_SIZE);
          // Top highlight
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(px, py, SPRITE_TILE_SIZE, 2);
        }
      }
    }

    // Render furniture
    for (const furn of layout.furniture ?? []) {
      renderFurniture(ctx, furn);
    }

    // Render built-in office decorations
    renderOfficeDecorations(ctx, layout.width, layout.height);

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

    // Render tool name speech bubbles (bubbleText)
    for (const character of state.characters.values()) {
      if (character.bubbleText) {
        const cx = character.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
        const cy = character.position.y * SPRITE_TILE_SIZE - SPRITE_TILE_SIZE;
        ctx.font = 'bold 8px monospace';
        const textW = ctx.measureText(character.bubbleText).width;
        const pad = 4;
        const bw = textW + pad * 2;
        const bh = 12;
        const bx = cx - bw / 2;
        const by = cy - bh;
        // Bubble background
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();
        // Bubble border
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.stroke();
        // Triangle pointer
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(cx - 3, by + bh);
        ctx.lineTo(cx + 3, by + bh);
        ctx.lineTo(cx, by + bh + 4);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 3, by + bh);
        ctx.lineTo(cx, by + bh + 4);
        ctx.lineTo(cx + 3, by + bh);
        ctx.stroke();
        // Text
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(character.bubbleText, cx, by + bh - 3);
        ctx.textAlign = 'left';
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

// Palette of skin/hair combos for characters keyed by agent id
const CHAR_PALETTES: Array<{ skin: string; hair: string; shirt: string; pants: string }> = [
  { skin: '#f5cba7', hair: '#3b2314', shirt: '#e74c3c', pants: '#2c3e50' },
  { skin: '#f5cba7', hair: '#c0a060', shirt: '#3498db', pants: '#34495e' },
  { skin: '#c68642', hair: '#1a1a1a', shirt: '#9b59b6', pants: '#2c3e50' },
  { skin: '#f5cba7', hair: '#e0e0e0', shirt: '#1abc9c', pants: '#2c3e50' },
  { skin: '#8d5524', hair: '#1a1a1a', shirt: '#e67e22', pants: '#2c3e50' },
];

function getPalette(id: number) {
  return CHAR_PALETTES[Math.abs(id) % CHAR_PALETTES.length];
}

function drawPlant(ctx: CanvasRenderingContext2D, gx: number, gy: number, alt = false): void {
  drawKenneyTile(ctx, alt ? TILES.plantAlt : TILES.plant, gx, gy, SPRITE_TILE_SIZE);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;

  // Top shelf (3 tiles tall total)
  ctx.fillStyle = '#8B4513'; // Wood frame
  ctx.fillRect(x, y, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
  ctx.fillStyle = '#A0522D'; // Wood top surface
  ctx.fillRect(x, y + 2, SPRITE_TILE_SIZE, 2);
  // Books on top shelf
  const bookColors = ['#8B0000', '#00008B', '#006400', '#FF8C00', '#4B0082', '#B22222'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = bookColors[i];
    ctx.fillRect(x + 1 + i * 2, y + 4, 2, 8);
  }

  // Middle shelf
  const y2 = y + SPRITE_TILE_SIZE;
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x, y2, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(x, y2 + 2, SPRITE_TILE_SIZE, 2);
  // Books on middle shelf
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = bookColors[(i + 3) % 6];
    ctx.fillRect(x + 1 + i * 2, y2 + 4, 2, 8);
  }

  // Bottom shelf
  const y3 = y + SPRITE_TILE_SIZE * 2;
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x, y3, SPRITE_TILE_SIZE, SPRITE_TILE_SIZE);
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(x, y3 + 2, SPRITE_TILE_SIZE, 2);
  // Books on bottom shelf
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = bookColors[(i + 5) % 6];
    ctx.fillRect(x + 1 + i * 2, y3 + 4, 2, 8);
  }
}

function drawDeskWithMonitor(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  drawKenneyTile(ctx, TILES.deskSurface, gx, gy, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.deskFront, gx, gy + 1, SPRITE_TILE_SIZE);

  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;

  // Monitor bezel
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(x + 1, y - 14, 14, 13);
  // Screen
  ctx.fillStyle = '#071221';
  ctx.fillRect(x + 2, y - 13, 12, 11);
  // Code lines on screen
  ctx.fillStyle = 'rgba(56,189,248,0.85)';
  ctx.fillRect(x + 3, y - 12, 9, 1);
  ctx.fillStyle = 'rgba(56,189,248,0.5)';
  ctx.fillRect(x + 5, y - 10, 7, 1);
  ctx.fillRect(x + 3, y - 8, 10, 1);
  ctx.fillStyle = 'rgba(167,243,208,0.65)';
  ctx.fillRect(x + 3, y - 6, 6, 1);
  ctx.fillStyle = 'rgba(56,189,248,0.4)';
  ctx.fillRect(x + 7, y - 4, 5, 1);
  // Screen glow
  ctx.fillStyle = 'rgba(56,189,248,0.06)';
  ctx.fillRect(x + 2, y - 13, 12, 11);
  // Monitor stand neck
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x + 6, y - 1, 3, 2);
  // Monitor base
  ctx.fillStyle = '#444';
  ctx.fillRect(x + 4, y, 8, 2);
  // Keyboard
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 2, y + 3, 11, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let col = 0; col < 4; col++) {
    ctx.fillRect(x + 3 + col * 2, y + 4, 1, 1);
    ctx.fillRect(x + 4 + col * 2, y + 6, 1, 1);
  }
  // Mouse
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 14, y + 4, 3, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x + 15, y + 4, 1, 2);
}

function drawPcTower(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;
  // Tower body
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 1, y + 3, 7, 12);
  // Front panel
  ctx.fillStyle = '#374151';
  ctx.fillRect(x + 2, y + 4, 5, 10);
  // Power LED
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(x + 4, y + 6, 1, 0, Math.PI * 2);
  ctx.fill();
  // Drive slot
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 2, y + 9, 5, 1);
  // USB ports
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x + 2, y + 11, 2, 1);
  ctx.fillRect(x + 2, y + 13, 2, 1);
}

function drawClock(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const y = gy * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const r = 5;
  ctx.fillStyle = '#ecf0f1';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 2); ctx.stroke();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
}

function drawWaterCooler(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;
  ctx.fillStyle = '#95a5a6';
  ctx.fillRect(x + 3, y + 8, 10, 8);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 4, y + 2, 8, 8);
  ctx.fillStyle = 'rgba(52,152,219,0.7)';
  ctx.fillRect(x + 5, y + 1, 6, 5);
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(x + 6, y, 4, 2);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(x + 4, y + 11, 2, 2);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x + 10, y + 11, 2, 2);
}

function drawVendingMachine(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;
  // Body spans 2 tiles tall
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(x + 1, y, 14, SPRITE_TILE_SIZE * 2);
  // Display window
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(x + 2, y + 2, 12, 10);
  // Product slots
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x + 3, y + 3, 4, 3);
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(x + 9, y + 3, 4, 3);
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(x + 3, y + 7, 4, 3);
  ctx.fillStyle = '#8e44ad';
  ctx.fillRect(x + 9, y + 7, 4, 3);
  // Coin slot + button (second tile)
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 3, y + SPRITE_TILE_SIZE + 4, 5, 1);
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(x + 12, y + SPRITE_TILE_SIZE + 5, 2, 0, Math.PI * 2); ctx.fill();
  // Left highlight strip
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 1, y, 3, SPRITE_TILE_SIZE * 2);
}

function drawPainting(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;
  // Frame
  ctx.fillStyle = '#7d5a2f';
  ctx.fillRect(x + 2, y + 2, 12, 9);
  // Sky
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(x + 4, y + 4, 8, 5);
  // Ground
  ctx.fillStyle = '#4a8c3f';
  ctx.fillRect(x + 4, y + 7, 8, 2);
  // Sun
  ctx.fillStyle = '#f9d71c';
  ctx.beginPath(); ctx.arc(x + 10, y + 5, 2, 0, Math.PI * 2); ctx.fill();
  // Frame highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 2, y + 2, 2, 9);
}

function renderOfficeDecorations(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
  // ── MAIN OFFICE ─────────────────────────────────────────────
  // Library on left wall (x=1)
  drawBookshelf(ctx, 1, 2);  // spans y=2,3,4
  drawBookshelf(ctx, 1, 7);  // spans y=7,8,9
  drawBookshelf(ctx, 1, 12); // spans y=12,13,14

  // Clock on top wall
  drawClock(ctx, 8, 1);

  // Corner plants
  drawPlant(ctx, 1, 1);
  drawPlant(ctx, 14, 1, true);
  drawPlant(ctx, 1, 13);
  drawPlant(ctx, 14, 13, true);
  drawPlant(ctx, 7, 7);

  // Desks with monitors (2 rows of 2) + PC towers
  drawDeskWithMonitor(ctx, 3, 4);
  drawPcTower(ctx, 4, 5);
  drawDeskWithMonitor(ctx, 8, 4);
  drawPcTower(ctx, 9, 5);
  drawDeskWithMonitor(ctx, 3, 10);
  drawPcTower(ctx, 4, 11);
  drawDeskWithMonitor(ctx, 8, 10);
  drawPcTower(ctx, 9, 11);

  // Decorative rugs (under the desk area)
  drawKenneyTile(ctx, TILES.rug, 6, 7, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.rug, 7, 7, SPRITE_TILE_SIZE);

  // Water cooler near divider wall
  drawWaterCooler(ctx, 13, 8);

  // ── BREAK ROOM (top-right) ───────────────────────────────────
  drawPlant(ctx, 16, 1);
  drawPlant(ctx, 22, 6, true);

  // Vending machine against back wall
  drawVendingMachine(ctx, 21, 1);

  // Water cooler
  drawWaterCooler(ctx, 17, 1);

  // Break table + chairs
  drawKenneyTile(ctx, TILES.tableTopLeft, 19, 3, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableTopRight, 20, 3, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableMidLeft, 19, 4, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableMidRight, 20, 4, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairWhite, 19, 2, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairWhite, 20, 2, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairWhite, 19, 5, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairWhite, 20, 5, SPRITE_TILE_SIZE);

  // ── CONFERENCE ROOM (bottom-right) ──────────────────────────
  drawPlant(ctx, 16, 9);
  drawPlant(ctx, 22, 9, true);
  drawPlant(ctx, 16, 14);
  drawPlant(ctx, 22, 14, true);

  // Painting on back wall
  drawPainting(ctx, 18, 9);
  drawPainting(ctx, 20, 9);

  // Rug under table (draw first so table appears on top)
  drawKenneyTile(ctx, TILES.rug, 18, 11, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.rug, 19, 11, SPRITE_TILE_SIZE);

  // Conference table (4 wide × 2 tall)
  drawKenneyTile(ctx, TILES.tableTopLeft, 17, 11, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableTopMid, 18, 11, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableTopMid, 19, 11, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableTopRight, 20, 11, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableMidLeft, 17, 12, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableMidMid, 18, 12, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableMidMid, 19, 12, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.tableMidRight, 20, 12, SPRITE_TILE_SIZE);

  // Chairs around conference table
  drawKenneyTile(ctx, TILES.chairOrangeAlt, 17, 10, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrangeAlt, 18, 10, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrangeAlt, 19, 10, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrangeAlt, 20, 10, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrange, 17, 13, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrange, 18, 13, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrange, 19, 13, SPRITE_TILE_SIZE);
  drawKenneyTile(ctx, TILES.chairOrange, 20, 13, SPRITE_TILE_SIZE);
}

function renderFurniture(ctx: CanvasRenderingContext2D, furn: FurnitureInstance): void {
  const x = furn.position.x * SPRITE_TILE_SIZE;
  const y = furn.position.y * SPRITE_TILE_SIZE;
  const w = SPRITE_TILE_SIZE * 2;
  const h = SPRITE_TILE_SIZE;

  // Desk - brown wooden surface
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(x, y, w, h);
  // Desk top highlight
  ctx.fillStyle = '#A0801E';
  ctx.fillRect(x, y, w, 3);
  // Monitor on desk
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x + 4, y - 8, 10, 7);
  ctx.fillStyle = '#1a252f';
  ctx.fillRect(x + 5, y - 7, 8, 5);
  ctx.fillStyle = '#34495e';
  ctx.fillRect(x + 8, y - 1, 2, 2);
}

function renderSeat(ctx: CanvasRenderingContext2D, seat: Seat): void {
  drawOfficeChair(ctx, seat.position.x, seat.position.y);
}

function drawOfficeChair(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
  const x = gx * SPRITE_TILE_SIZE;
  const y = gy * SPRITE_TILE_SIZE;
  // Chair back
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(x + 4, y + 1, 8, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 4, y + 1, 8, 2);
  // Seat cushion
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(x + 3, y + 6, 10, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + 3, y + 6, 10, 2);
  // Armrests
  ctx.fillStyle = '#374151';
  ctx.fillRect(x + 2, y + 6, 2, 4);
  ctx.fillRect(x + 12, y + 6, 2, 4);
  // Central column
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x + 7, y + 12, 2, 2);
  // Wheel base cross
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x + 4, y + 13, 8, 1);
  ctx.fillRect(x + 7, y + 11, 2, 4);
  // Wheels
  ctx.fillStyle = '#374151';
  ctx.fillRect(x + 3, y + 14, 2, 2);
  ctx.fillRect(x + 11, y + 14, 2, 2);
  ctx.fillRect(x + 7, y + 14, 2, 2);
}

function renderCharacterShadow(ctx: CanvasRenderingContext2D, character: Character): void {
  const x = character.position.x * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE / 2;
  const y = character.position.y * SPRITE_TILE_SIZE + SPRITE_TILE_SIZE - 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function renderCharacter(ctx: CanvasRenderingContext2D, character: Character): void {
  const x = character.position.x * SPRITE_TILE_SIZE;
  const y = character.position.y * SPRITE_TILE_SIZE - 6;
  const pal = getPalette(character.id);

  // Body / shirt
  ctx.fillStyle = pal.shirt;
  ctx.fillRect(x + 4, y + 8, 8, 7);

  // Pants
  ctx.fillStyle = pal.pants;
  ctx.fillRect(x + 4, y + 14, 3, 5);
  ctx.fillRect(x + 9, y + 14, 3, 5);

  // Head
  ctx.fillStyle = pal.skin;
  ctx.fillRect(x + 4, y + 1, 8, 7);

  // Hair
  ctx.fillStyle = pal.hair;
  ctx.fillRect(x + 4, y + 1, 8, 3);
  ctx.fillRect(x + 4, y + 4, 1, 2);
  ctx.fillRect(x + 11, y + 4, 1, 2);

  // Eyes
  ctx.fillStyle = '#1a1a1a';
  if (character.facingDir === 'left') {
    ctx.fillRect(x + 5, y + 5, 2, 2);
  } else if (character.facingDir === 'right') {
    ctx.fillRect(x + 9, y + 5, 2, 2);
  } else {
    ctx.fillRect(x + 5, y + 5, 2, 2);
    ctx.fillRect(x + 9, y + 5, 2, 2);
  }

  // Arms
  ctx.fillStyle = pal.skin;
  if (character.state === 'type') {
    // Arms forward for typing
    ctx.fillRect(x + 2, y + 9, 2, 5);
    ctx.fillRect(x + 12, y + 9, 2, 5);
    // Animate fingers
    ctx.fillStyle = pal.skin;
    ctx.fillRect(x + 1, y + 13, 2, 2);
    ctx.fillRect(x + 13, y + 13, 2, 2);
  } else if (character.state === 'read') {
    // Arms up holding book
    ctx.fillRect(x + 2, y + 8, 2, 4);
    ctx.fillRect(x + 12, y + 8, 2, 4);
    // Book
    ctx.fillStyle = '#e8d5a3';
    ctx.fillRect(x + 3, y + 4, 10, 7);
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(x + 7, y + 4, 1, 7);
  } else if (character.state === 'waiting') {
    // One arm up
    ctx.fillRect(x + 2, y + 9, 2, 4);
    ctx.fillRect(x + 2, y + 7, 2, 3);
    ctx.fillRect(x + 12, y + 9, 2, 6);
  } else {
    // Idle / walk
    ctx.fillRect(x + 2, y + 9, 2, 6);
    ctx.fillRect(x + 12, y + 9, 2, 6);
  }

  // Agent ID label below
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x + 1, y + 20, 14, 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = '4px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`#${character.id}`, x + 8, y + 25);
  ctx.textAlign = 'left';

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
  const x = subagent.position.x * SPRITE_TILE_SIZE + 3;
  const y = subagent.position.y * SPRITE_TILE_SIZE - 2;
  const pal = getPalette(subagent.agentId);

  // Mini character at 0.6x scale
  ctx.fillStyle = pal.skin;
  ctx.fillRect(x + 3, y + 1, 5, 4);
  ctx.fillStyle = pal.hair;
  ctx.fillRect(x + 3, y + 1, 5, 2);
  ctx.fillStyle = pal.shirt;
  ctx.fillRect(x + 3, y + 5, 5, 4);
  ctx.fillStyle = pal.pants;
  ctx.fillRect(x + 3, y + 9, 2, 3);
  ctx.fillRect(x + 6, y + 9, 2, 3);

  // Sub indicator dot
  ctx.fillStyle = '#88ccff';
  ctx.beginPath();
  ctx.arc(x + 5, y - 2, 2, 0, Math.PI * 2);
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
