let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let columns: number[] = [];

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';
const FONT_SIZE = 14;
const SPEED_MIN = 1;
const SPEED_MAX = 5;

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function init(): void {
  if (!canvas) return;
  
  columns = [];
  const numCols = Math.floor(canvas.width / FONT_SIZE);
  
  for (let i = 0; i < numCols; i++) {
    columns[i] = Math.random() * canvas.height;
  }
}

function draw(): void {
  if (!canvas || !ctx) return;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#0f0';
  ctx.font = `${FONT_SIZE}px monospace`;
  
  for (let i = 0; i < columns.length; i++) {
    const x = i * FONT_SIZE;
    const y = columns[i];
    
    ctx.fillText(randomChar(), x, y);
    
    if (y > canvas.height && Math.random() > 0.975) {
      columns[i] = 0;
    }
    
    columns[i] += SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  }
}

function loop(): void {
  draw();
  rafId = requestAnimationFrame(loop);
}

export function start(container: HTMLElement): void {
  canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1000';
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  ctx = canvas.getContext('2d');
  
  container.appendChild(canvas);
  
  init();
  loop();
}

export function stop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
  
  canvas = null;
  ctx = null;
  columns = [];
}
