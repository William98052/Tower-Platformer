import { VIEW_H, VIEW_W } from '../core/constants';
import type { CollisionSolid } from '../physics/collision';
import type { SolidRole, SurfaceType } from '../stages/types';
import { CLOCKWORK_THEME_RENDERER } from './clockwork-draw';
import type { ThemeBlend, ThemeRenderer } from './themes';

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
  conveyorLeft: { body: '#343a38', edge: '#c9a75d' },
  conveyorRight: { body: '#343a38', edge: '#c9a75d' },
};

export function surfaceColors(surface: SurfaceType = 'normal'): { body: string; edge: string } {
  return SURFACE_COLORS[surface];
}

export function solidStyle(role: SolidRole = 'main'): { alpha: number } {
  if (role === 'recovery') return { alpha: 0.56 };
  if (role === 'boundary') return { alpha: 0.82 };
  return { alpha: 1 };
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

function drawMossBackground(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number, effectsScale = 1): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawLightShafts(ctx, t);
  tile(camX * 0.22, camY * 0.22, 360, 420, (x, y) => drawRuin(ctx, x, y));
  tile(camX * 0.48, camY * 0.48, 420, 500, (x, y) => drawVines(ctx, x, y, t));
  drawMist(ctx, camY, t);
  drawSpores(ctx, camY, t, effectsScale);
}

function drawLightShafts(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.save();
  ctx.globalAlpha = 0.045 + Math.sin(t * 0.18) * 0.008;
  ctx.fillStyle = '#d9edb3';
  ctx.beginPath();
  ctx.moveTo(100, 0);
  ctx.lineTo(250, 0);
  ctx.lineTo(390, VIEW_H);
  ctx.lineTo(275, VIEW_H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(720, 0);
  ctx.lineTo(805, 0);
  ctx.lineTo(690, VIEW_H);
  ctx.lineTo(610, VIEW_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRuin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.far;
  ctx.fillRect(x + 18, y + 38, 42, 382);
  ctx.fillRect(x + 8, y + 72, 62, 12);
  ctx.fillRect(x + 60, y + 92, 250, 20);
  ctx.fillRect(x + 282, y + 38, 38, 382);
  ctx.fillRect(x + 272, y + 72, 58, 12);

  // A large recessed arch makes the background read as a ruined hall, not random rectangles.
  ctx.fillStyle = '#111d19';
  ctx.beginPath();
  ctx.roundRect(x + 112, y + 148, 138, 272, [69, 69, 0, 0]);
  ctx.fill();
  ctx.fillStyle = COLORS.far;
  ctx.fillRect(x + 135, y + 205, 18, 215);
  ctx.fillRect(x + 210, y + 205, 18, 215);
  ctx.fillRect(x + 135, y + 250, 93, 14);

  ctx.fillStyle = COLORS.farWindow;
  for (const wx of [145, 188]) {
    ctx.beginPath();
    ctx.roundRect(x + wx, y + 168, 24, 50, [12, 12, 0, 0]);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(126, 165, 90, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 88, y + 112);
  ctx.lineTo(x + 102, y + 143);
  ctx.lineTo(x + 90, y + 178);
  ctx.moveTo(x + 278, y + 112);
  ctx.lineTo(x + 264, y + 150);
  ctx.stroke();
}

function drawVines(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = COLORS.mid;
  ctx.fillRect(x + 182, y + 240, 54, 260);
  ctx.fillRect(x + 170, y + 270, 78, 12);
  ctx.save();
  ctx.strokeStyle = COLORS.vine;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const baseX = x + 42 + k * 102;
    const sway = Math.sin(t * 0.8 + x * 0.01 + k);
    ctx.beginPath();
    ctx.moveTo(baseX, y);
    ctx.quadraticCurveTo(baseX + sway * 12, y + 80, baseX + sway * 5, y + 150 + k * 24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMist(ctx: CanvasRenderingContext2D, camY: number, t: number): void {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const y = mod(i * 210 - camY * 0.1 + Math.sin(t * 0.25 + i) * 18, VIEW_H + 160) - 80;
    const fog = ctx.createLinearGradient(0, y, 0, y + 90);
    fog.addColorStop(0, 'rgba(128, 158, 116, 0)');
    fog.addColorStop(0.5, 'rgba(128, 158, 116, 0.045)');
    fog.addColorStop(1, 'rgba(128, 158, 116, 0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, y, VIEW_W, 90);
  }
  ctx.restore();
}

function drawSpores(ctx: CanvasRenderingContext2D, camY: number, t: number, effectsScale = 1): void {
  const count = Math.max(10, Math.round(40 * effectsScale));
  for (let i = 0; i < count; i++) {
    const x = ((i * 137.5) % VIEW_W) + Math.sin(t + i) * 6;
    const y = mod(i * 89 - t * 12 - camY * 0.8, VIEW_H);
    const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(200, 235, 160, ${a})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMossSolids(
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

    ctx.save();
    ctx.globalAlpha *= solidStyle(s.role).alpha;

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
    if (s.role === 'main' && isPlatform && surface !== 'oneWay') {
      ctx.strokeStyle = 'rgba(77, 119, 66, 0.72)';
      ctx.lineWidth = 2;
      for (let k = 28; k < s.w - 20; k += 72) {
        const length = 10 + mossHeight(Math.floor(s.x + k)) * 3;
        ctx.beginPath();
        ctx.moveTo(sx + k, sy + s.h);
        ctx.quadraticCurveTo(sx + k + 4, sy + s.h + length / 2, sx + k - 2, sy + s.h + length);
        ctx.stroke();
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
    ctx.restore();
  }
}

const MOSS_THEME_RENDERER: ThemeRenderer = {
  drawBackground: drawMossBackground,
  drawSolids: drawMossSolids,
};

function rendererFor(stageId: number): ThemeRenderer {
  return stageId === 2 ? CLOCKWORK_THEME_RENDERER : MOSS_THEME_RENDERER;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  t: number,
  blend?: ThemeBlend,
  effectsScale = 1,
): void {
  if (!blend) {
    MOSS_THEME_RENDERER.drawBackground(ctx, camX, camY, t, effectsScale);
    return;
  }
  drawThemeLayer(ctx, 1 - blend.mix, () => {
    rendererFor(blend.lower.id).drawBackground(ctx, camX, camY, t, effectsScale);
  });
  if (blend.mix > 0 || blend.upper.id !== blend.lower.id) {
    drawThemeLayer(ctx, blend.mix, () => {
      rendererFor(blend.upper.id).drawBackground(ctx, camX, camY, t, effectsScale);
    });
  }
}

export function drawSolids(
  ctx: CanvasRenderingContext2D,
  solids: readonly CollisionSolid[],
  camX: number,
  camY: number,
  blurScale = 1,
  blend?: ThemeBlend,
): void {
  if (!blend) {
    MOSS_THEME_RENDERER.drawSolids(ctx, solids, camX, camY, blurScale);
    return;
  }
  drawThemeLayer(ctx, 1 - blend.mix, () => {
    rendererFor(blend.lower.id).drawSolids(ctx, solids, camX, camY, blurScale);
  });
  if (blend.mix > 0 || blend.upper.id !== blend.lower.id) {
    drawThemeLayer(ctx, blend.mix, () => {
      rendererFor(blend.upper.id).drawSolids(ctx, solids, camX, camY, blurScale);
    });
  }
}

function drawThemeLayer(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  draw();
  ctx.restore();
}
