import type { Afterimages, Particles } from './effects';

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particles, camX: number, camY: number): void {
  for (const p of particles.list) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camX - p.size / 2, p.y - camY - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawAfterimages(
  ctx: CanvasRenderingContext2D,
  afterimages: Afterimages,
  w: number,
  h: number,
  camX: number,
  camY: number,
): void {
  for (const a of afterimages.items) {
    ctx.fillStyle = `rgba(255, 228, 170, ${(a.life / afterimages.lifetime) * 0.4})`;
    ctx.beginPath();
    ctx.roundRect(a.x - camX, a.y - camY, w, h, 4);
    ctx.fill();
  }
}
