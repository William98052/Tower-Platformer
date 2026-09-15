import type { Entity } from '../entities/entity';
import type { Checkpoint } from '../modes/run-state';
import type { WorldSection } from '../stages/types';

export function drawEntities(
  ctx: CanvasRenderingContext2D,
  entities: readonly Entity[],
  camX: number,
  camY: number,
  t: number,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(-camX, -camY);
  for (const entity of entities) entity.draw(ctx, t, alpha);
  ctx.restore();
}

export function drawCheckpoints(
  ctx: CanvasRenderingContext2D,
  sections: readonly WorldSection[],
  active: Checkpoint,
  mode: 'normal' | 'hard',
  camX: number,
  camY: number,
  blurScale = 1,
): void {
  if (mode === 'hard') return;
  for (const section of sections) {
    const x = section.checkpoint.x - camX;
    const y = section.checkpoint.y - camY;
    const lit = section.id <= active.section;
    ctx.save();
    ctx.strokeStyle = lit ? '#dff5a6' : '#65735c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 28);
    ctx.lineTo(x, y - 16);
    ctx.stroke();
    if (lit) {
      ctx.shadowColor = '#dff5a6';
      ctx.shadowBlur = 12 * blurScale;
    }
    ctx.fillStyle = lit ? '#a9d477' : '#4b5748';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 14);
    ctx.lineTo(x + 28, y - 6);
    ctx.lineTo(x + 2, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
