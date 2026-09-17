import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';

type WaterWheelDef = Extract<EntityDef, { type: 'waterWheel' }>;

const PERIOD = 5;
const PADDLE_COUNT = 4;

function paddleBoxesAt(def: WaterWheelDef, t: number) {
  const baseAngle = Math.PI * 2 * (t / PERIOD + def.phase);
  return Array.from({ length: PADDLE_COUNT }, (_, index) => {
    const angle = baseAngle + index * Math.PI / 2;
    const centerX = def.x + Math.sin(angle) * def.radius;
    const centerY = def.y - Math.cos(angle) * def.radius;
    return {
      x: centerX - def.paddleW / 2,
      y: centerY - def.paddleH / 2,
      w: def.paddleW,
      h: def.paddleH,
      surface: 'normal' as const,
    };
  });
}

export class WaterWheelEntity implements Entity {
  private current: ReturnType<typeof paddleBoxesAt>;
  private previous: ReturnType<typeof paddleBoxesAt>;

  constructor(readonly def: WaterWheelDef) {
    this.current = paddleBoxesAt(def, 0);
    this.previous = this.current.map((box) => ({ ...box }));
  }

  bounds() {
    return {
      x: this.def.x - this.def.radius - this.def.paddleW / 2,
      y: this.def.y - this.def.radius - this.def.paddleH / 2,
      w: this.def.radius * 2 + this.def.paddleW,
      h: this.def.radius * 2 + this.def.paddleH,
    };
  }

  update(t: number, dt: number): void {
    const currentTime = Math.max(0, t);
    this.previous = paddleBoxesAt(this.def, Math.max(0, currentTime - dt));
    this.current = paddleBoxesAt(this.def, currentTime);
  }

  dynamicSolids(): readonly DynamicSolid[] {
    return this.current.map((box, index) => ({
      box,
      delta: {
        x: box.x - this.previous[index].x,
        y: box.y - this.previous[index].y,
      },
    }));
  }

  field(): FieldEffect | null { return null; }

  draw(ctx: CanvasRenderingContext2D, _t: number, alpha: number): void {
    ctx.save();
    ctx.strokeStyle = '#557f78';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(this.def.x, this.def.y, this.def.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#789c8e';
    for (let index = 0; index < PADDLE_COUNT; index += 1) {
      const previous = this.previous[index];
      const current = this.current[index];
      const x = previous.x + (current.x - previous.x) * alpha;
      const y = previous.y + (current.y - previous.y) * alpha;
      ctx.fillRect(x, y, this.def.paddleW, this.def.paddleH);
    }
    ctx.beginPath();
    ctx.arc(this.def.x, this.def.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  collide(_player: Player): EntityContact { return { kind: 'none' }; }

  reset(): void {
    this.current = paddleBoxesAt(this.def, 0);
    this.previous = this.current.map((box) => ({ ...box }));
  }
}
