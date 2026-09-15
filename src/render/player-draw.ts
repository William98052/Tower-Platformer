import type { Player } from '../physics/player';
import type { Squash } from './effects';

export type PlayerLook = Pick<
  Player,
  'x' | 'y' | 'w' | 'h' | 'facing' | 'vx' | 'vy' | 'dashCharges' | 'dashTimer' | 'onGround'
>;

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerLook,
  squash: Squash,
  camX: number,
  camY: number,
  t: number,
): void {
  // Dimmed when airborne with no dash left, so the player can read their charge.
  const tired = !p.onGround && p.dashCharges === 0 && p.dashTimer === 0;
  const w = p.w * squash.sx;
  const h = p.h * squash.sy;
  const cx = p.x + p.w / 2 - camX;
  const bottom = p.y + p.h - camY;
  const left = cx - w / 2;
  const top = bottom - h;

  // Scarf trails behind, pulled by velocity.
  const ax = cx - p.facing * (w / 2 - 3);
  const ay = top + h * 0.55;
  ctx.strokeStyle = '#e2596a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  for (let i = 1; i <= 5; i++) {
    ctx.lineTo(
      ax - p.facing * i * 5 - p.vx * 0.018 * i,
      ay + i * 1.2 - p.vy * 0.012 * i + Math.sin(t * 10 - i * 0.9) * 2,
    );
  }
  ctx.stroke();

  // Body with glow
  ctx.save();
  ctx.shadowColor = tired ? 'rgba(200, 180, 140, 0.35)' : 'rgba(255, 215, 140, 0.85)';
  ctx.shadowBlur = tired ? 8 : 20;
  ctx.fillStyle = tired ? '#b8a57f' : '#f3d9a0';
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 4);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = tired ? '#cbb994' : '#ffeec8';
  ctx.beginPath();
  ctx.roundRect(left, top, w, Math.max(4, h * 0.2), [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = tired ? '#a08e6a' : '#e0bf7f';
  ctx.fillRect(left, bottom - 4, w, 4);

  // Eye looks where you're going and blinks every few seconds.
  const eyeH = t % 3.4 < 0.12 ? 1.5 : 7;
  const ex = cx + p.facing * w * 0.18 - 2.5;
  const ey = top + h * 0.32 + Math.max(-2, Math.min(2, p.vy * 0.004)) + (7 - eyeH) / 2;
  ctx.fillStyle = '#1b1418';
  ctx.fillRect(ex, ey, 5, eyeH);
}
