import { MIN_SOLID_THICKNESS } from '../core/constants';
import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';

type GearDef = Extract<EntityDef, { type: 'gear' }>;

export function gearBoxAt(def: GearDef, t: number) {
  const angle = Math.PI * 2 * (t / def.period + def.phase);
  return {
    x: def.x + Math.sin(angle) * def.radius,
    y: def.y + (1 - Math.cos(angle)) * def.radius,
    w: def.paddleW,
    h: MIN_SOLID_THICKNESS,
    surface: 'normal' as const,
  };
}

export class GearEntity implements Entity {
  private current: ReturnType<typeof gearBoxAt>;
  private previous: ReturnType<typeof gearBoxAt>;

  constructor(readonly def: GearDef) {
    this.current = gearBoxAt(def, 0);
    this.previous = { ...this.current };
  }

  bounds() {
    return {
      x: this.def.x - this.def.radius,
      y: this.def.y,
      w: this.def.paddleW + this.def.radius * 2,
      h: MIN_SOLID_THICKNESS + this.def.radius * 2,
    };
  }

  update(t: number, dt: number): void {
    const currentTime = Math.max(0, t);
    this.previous = gearBoxAt(this.def, Math.max(0, currentTime - dt));
    this.current = gearBoxAt(this.def, currentTime);
  }

  dynamicSolids(): readonly DynamicSolid[] {
    return [{
      box: this.current,
      delta: { x: this.current.x - this.previous.x, y: this.current.y - this.previous.y },
    }];
  }

  field(): FieldEffect | null { return null; }
  draw(ctx: CanvasRenderingContext2D, _t: number, alpha: number): void {
    const x = this.previous.x + (this.current.x - this.previous.x) * alpha;
    const y = this.previous.y + (this.current.y - this.previous.y) * alpha;
    const centerX = this.def.x + this.def.paddleW / 2;
    const centerY = this.def.y + this.def.radius + MIN_SOLID_THICKNESS / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(208, 163, 75, 0.48)';
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.def.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9a7738';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfb553';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#3a3732';
    ctx.fillRect(x, y, this.def.paddleW, MIN_SOLID_THICKNESS);
    ctx.fillStyle = '#d0a34b';
    ctx.fillRect(x, y, this.def.paddleW, 4);
    for (let tooth = 7; tooth < this.def.paddleW - 5; tooth += 18) {
      ctx.fillRect(x + tooth, y - 4, 9, 5);
    }
    ctx.restore();
  }
  collide(_player: Player): EntityContact { return { kind: 'none' }; }

  reset(): void {
    this.current = gearBoxAt(this.def, 0);
    this.previous = { ...this.current };
  }
}
