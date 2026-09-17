import { VIEW_H, VIEW_W } from '../core/constants';
import type { CollisionSolid } from '../physics/collision';
import type { ThemeRenderer } from './themes';

const COLORS = {
  skyTop: '#0d0c0e',
  skyBottom: '#29231d',
  farIron: '#171719',
  iron: '#2f302f',
  ironShade: '#242525',
  seam: '#4a463e',
  brass: '#d0a34b',
  brassDim: '#80652f',
  amber: '#ed8e35',
  warning: '#e74f2d',
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

function drawBackground(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  t: number,
  effectsScale: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = 'rgba(226, 135, 47, 0.045)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let column = -1; column < 5; column += 1) {
    const x = column * 280 - mod(camX * 0.2, 280);
    const y = -mod(camY * 0.2, 460) - 120;
    drawIronArch(ctx, x, y);
  }
  for (let i = 0; i < 4; i += 1) {
    const x = 110 + i * 245 - mod(camX * 0.42, 245);
    const y = mod(i * 190 - camY * 0.32, VIEW_H + 220) - 110;
    drawClock(ctx, x, y, 58 + (i % 2) * 14, t * (i % 2 ? -0.28 : 0.22));
  }
  drawShafts(ctx, camY, t);
  drawDust(ctx, camY, t, effectsScale);
}

function drawIronArch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.farIron;
  ctx.fillRect(x + 18, y + 90, 34, 430);
  ctx.fillRect(x + 228, y + 90, 34, 430);
  ctx.fillRect(x + 18, y + 82, 244, 24);
  ctx.strokeStyle = 'rgba(208, 163, 75, 0.10)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x + 140, y + 176, 94, Math.PI, 0);
  ctx.stroke();
}

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number): void {
  ctx.save();
  ctx.globalAlpha *= 0.24;
  ctx.strokeStyle = COLORS.brassDim;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (radius - 11), y + Math.sin(a) * (radius - 11));
    ctx.lineTo(x + Math.cos(a) * (radius - 3), y + Math.sin(a) * (radius - 3));
    ctx.stroke();
  }
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = COLORS.amber;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.lineTo(0, -radius * 0.65);
  ctx.moveTo(-5, 0);
  ctx.lineTo(radius * 0.45, 0);
  ctx.stroke();
  ctx.restore();
}

function drawShafts(ctx: CanvasRenderingContext2D, camY: number, t: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(95, 87, 73, 0.35)';
  ctx.lineWidth = 8;
  for (let i = 0; i < 3; i += 1) {
    const x = 190 + i * 310;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW_H);
    ctx.stroke();
    for (let y = mod(i * 150 - camY * 0.5 + t * 16, 230) - 50; y < VIEW_H; y += 230) {
      ctx.fillStyle = COLORS.brassDim;
      ctx.fillRect(x - 16, y, 32, 12);
    }
  }
  ctx.restore();
}

function drawDust(ctx: CanvasRenderingContext2D, camY: number, t: number, effectsScale: number): void {
  const count = Math.max(8, Math.round(34 * effectsScale));
  for (let i = 0; i < count; i += 1) {
    const x = mod(i * 173 + Math.sin(t * 0.4 + i) * 10, VIEW_W);
    const y = mod(i * 97 - t * 8 - camY * 0.35, VIEW_H);
    ctx.fillStyle = `rgba(232, 174, 83, ${0.12 + (i % 4) * 0.035})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawSolids(
  ctx: CanvasRenderingContext2D,
  solids: readonly CollisionSolid[],
  camX: number,
  camY: number,
  glowScale: number,
): void {
  for (const solid of solids) {
    const x = solid.x - camX;
    const y = solid.y - camY;
    if (x > VIEW_W || x + solid.w < 0 || y > VIEW_H || y + solid.h < 0) continue;
    const alpha = solid.role === 'recovery' ? 0.5 : solid.role === 'boundary' ? 0.82 : 1;
    const conveyor = solid.surface === 'conveyorLeft' || solid.surface === 'conveyorRight';
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = COLORS.iron;
    ctx.fillRect(x, y, solid.w, solid.h);
    ctx.fillStyle = COLORS.ironShade;
    ctx.fillRect(x, y + 7, solid.w, Math.max(0, solid.h - 7));
    ctx.fillStyle = COLORS.seam;
    for (let seam = 46; seam < solid.w; seam += 48) ctx.fillRect(x + seam, y + 7, 2, Math.max(0, solid.h - 7));

    ctx.save();
    ctx.shadowColor = conveyor ? COLORS.amber : COLORS.brass;
    ctx.shadowBlur = 7 * glowScale;
    ctx.fillStyle = conveyor ? COLORS.amber : COLORS.brass;
    ctx.fillRect(x, y, solid.w, conveyor ? 5 : 3);
    ctx.restore();

    ctx.fillStyle = COLORS.brassDim;
    for (let rivet = 12; rivet < solid.w - 4; rivet += 28) {
      ctx.beginPath();
      ctx.arc(x + rivet, y + 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (conveyor) drawChevrons(ctx, x, y, solid.w, solid.surface === 'conveyorRight' ? 1 : -1);
    ctx.restore();
  }
}

function drawChevrons(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, direction: 1 | -1): void {
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 3;
  for (let offset = 20; offset < width - 8; offset += 38) {
    const center = x + offset;
    ctx.beginPath();
    ctx.moveTo(center - direction * 8, y + 14);
    ctx.lineTo(center + direction * 2, y + 20);
    ctx.lineTo(center - direction * 8, y + 26);
    ctx.stroke();
  }
}

export const CLOCKWORK_THEME_RENDERER: ThemeRenderer = { drawBackground, drawSolids };
