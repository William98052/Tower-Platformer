import { VIEW_H, VIEW_W } from '../core/constants';
import type { CollisionSolid } from '../physics/collision';
import type { SurfaceType } from '../stages/types';

const COLORS = {
  skyTop: '#0e1815',
  skyBottom: '#223428',
  far: '#17241e',
  farWindow: 'rgba(170, 220, 140, 0.10)',
  mid: '#1c2c23',
  vine: '#2f4a35',
  body: '#2a3b30',
  bodyShade: '#223127',
  seam: '#344a3b',
  edge: '#bcd98c',
  moss: '#7ea55a',
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

const SURFACE_COLORS: Record<SurfaceType, { body: string; edge: string }> = {
  normal: { body: '#2a3b30', edge: '#bcd98c' },
  oneWay: { body: '#314838', edge: '#d5eba5' },
  vine: { body: '#27452f', edge: '#8fc76b' },
  bouncy: { body: '#53623a', edge: '#edf2a6' },
  slopeUp: { body: '#304334', edge: '#acd47d' },
  slopeDown: { body: '#354738', edge: '#b7da86' },
};

export function surfaceColors(surface: SurfaceType = 'normal'): { body: string; edge: string } {
  return SURFACE_COLORS[surface];
}

/** Moss tuft height 2..5 for a tile index; Fibonacci hashing on the high bits so neighbours vary. */
export function mossHeight(i: number): number {
  return 2 + (Math.imul(i, 0x9e3779b1) >>> 30);
}

/** Calls `draw` for every tile of a w×h grid scrolled by (offX, offY) that touches the view. */
function tile(offX: number, offY: number, w: number, h: number, draw: (x: number, y: number) => void): void {
  const startX = -mod(offX, w) - w;
  const startY = -mod(offY, h) - h;
  for (let x = startX; x < VIEW_W + w; x += w) {
    for (let y = startY; y < VIEW_H + h; y += h) draw(x, y);
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  tile(camX * 0.25, camY * 0.25, 240, 360, (x, y) => drawRuin(ctx, x, y));
  tile(camX * 0.5, camY * 0.5, 320, 420, (x, y) => drawVines(ctx, x, y, t));
  drawSpores(ctx, camY, t);
}

function drawRuin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.far;
  ctx.fillRect(x + 20, y, 34, 360); // column
  ctx.fillRect(x + 12, y + 40, 50, 10); // capital
  ctx.fillRect(x + 54, y + 60, 186, 16); // lintel
  ctx.fillStyle = COLORS.farWindow;
  ctx.beginPath();
  ctx.roundRect(x + 130, y + 170, 22, 40, [11, 11, 0, 0]);
  ctx.fill();
}

function drawVines(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = COLORS.mid;
  ctx.fillRect(x + 140, y + 220, 44, 200); // broken pillar
  ctx.save();
  ctx.strokeStyle = COLORS.vine;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const baseX = x + 60 + k * 90;
    const sway = Math.sin(t * 0.8 + x * 0.01 + k);
    ctx.beginPath();
    ctx.moveTo(baseX, y);
    ctx.quadraticCurveTo(baseX + sway * 10, y + 60, baseX + sway * 4, y + 120 + k * 30);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpores(ctx: CanvasRenderingContext2D, camY: number, t: number): void {
  for (let i = 0; i < 40; i++) {
    const x = ((i * 137.5) % VIEW_W) + Math.sin(t + i) * 6;
    const y = mod(i * 89 - t * 12 - camY * 0.8, VIEW_H);
    const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(200, 235, 160, ${a})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

export function drawSolids(
  ctx: CanvasRenderingContext2D,
  solids: readonly CollisionSolid[],
  camX: number,
  camY: number,
  blurScale = 1,
): void {
  for (const s of solids) {
    const sx = s.x - camX;
    const sy = s.y - camY;
    if (sx > VIEW_W || sx + s.w < 0 || sy > VIEW_H || sy + s.h < 0) continue;

    const surface = s.surface ?? 'normal';
    const palette = surfaceColors(surface);
    const isSlope = surface === 'slopeUp' || surface === 'slopeDown';
    const isPlatform = s.h <= 40 || isSlope;
    if (isPlatform) {
      const fade = ctx.createLinearGradient(0, sy + s.h, 0, sy + s.h + 22);
      fade.addColorStop(0, 'rgba(42, 59, 48, 0.55)');
      fade.addColorStop(1, 'rgba(42, 59, 48, 0)');
      ctx.fillStyle = fade;
      ctx.fillRect(sx, sy + s.h, s.w, 22);
    }

    ctx.fillStyle = palette.body;
    if (isSlope) {
      ctx.beginPath();
      ctx.moveTo(sx, surface === 'slopeUp' ? sy + s.h : sy);
      ctx.lineTo(sx + s.w, surface === 'slopeUp' ? sy : sy + s.h);
      ctx.lineTo(sx + s.w, sy + s.h);
      ctx.lineTo(sx, sy + s.h);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(sx, sy, s.w, s.h);
      ctx.fillStyle = COLORS.bodyShade;
      ctx.fillRect(sx, sy + 6, s.w, Math.max(0, s.h - 6));
    }

    ctx.fillStyle = COLORS.seam;
    if (isPlatform) {
      for (let k = 36; k < s.w - 8; k += 40) ctx.fillRect(sx + k, sy + 6, 2, s.h - 6);
    } else {
      for (let k = 48; k < s.h; k += 48) ctx.fillRect(sx, sy + k, s.w, 2);
    }

    ctx.save();
    ctx.shadowColor = palette.edge;
    ctx.shadowBlur = 8 * blurScale;
    ctx.fillStyle = palette.edge;
    if (isSlope) {
      ctx.beginPath();
      ctx.moveTo(sx, surface === 'slopeUp' ? sy + s.h : sy);
      ctx.lineTo(sx + s.w, surface === 'slopeUp' ? sy : sy + s.h);
      ctx.lineWidth = 3;
      ctx.strokeStyle = palette.edge;
      ctx.stroke();
    } else {
      ctx.fillRect(sx, sy, s.w, surface === 'oneWay' ? 5 : 3);
    }
    ctx.restore();

    if (!isSlope) {
      ctx.fillStyle = surface === 'bouncy' ? '#dce99a' : COLORS.moss;
      for (let k = 4; k < s.w - 4; k += 14) {
        const h = mossHeight(Math.floor(s.x + k));
        ctx.fillRect(sx + k, sy - h + 1, 6, h);
      }
    }
    if (surface === 'vine') {
      ctx.strokeStyle = '#6fa453';
      ctx.lineWidth = 3;
      for (let y = sy + 10; y < sy + s.h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(sx + 3, y);
        ctx.quadraticCurveTo(sx + s.w / 2, y + 8, sx + s.w - 3, y + 14);
        ctx.stroke();
      }
    }
  }
}
