import { overlaps } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';

type MushroomDef = Extract<EntityDef, { type: 'mushroom' }>;

export class MushroomEntity implements Entity {
  compression = 0;
  private time = 0;

  constructor(readonly def: MushroomDef) {}

  bounds() {
    return { x: this.def.x, y: this.def.y, w: this.def.w, h: this.def.h };
  }

  update(t: number, dt: number): void {
    this.time = t;
    this.compression = Math.max(0, this.compression - dt * 4);
  }

  dynamicSolids(): readonly DynamicSolid[] { return []; }
  field(): FieldEffect | null { return null; }

  draw(ctx: CanvasRenderingContext2D): void {
    const bob = Math.sin(this.time * 2 + this.def.x * 0.01) * 1.5;
    const squash = 1 - this.compression * 0.35;
    ctx.save();
    ctx.translate(this.def.x + this.def.w / 2, this.def.y + this.def.h + bob);
    ctx.scale(1 + this.compression * 0.2, squash);
    ctx.fillStyle = '#d6e6a4';
    ctx.beginPath();
    ctx.ellipse(0, -this.def.h * 0.55, this.def.w / 2, this.def.h * 0.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#7fa25c';
    ctx.fillRect(-this.def.w * 0.12, -this.def.h * 0.55, this.def.w * 0.24, this.def.h * 0.55);
    ctx.restore();
  }

  collide(player: Player): EntityContact {
    if (player.vy <= 0 || player.y >= this.def.y || !overlaps(player, this.bounds())) return { kind: 'none' };
    this.compression = 1;
    return { kind: 'launch', velocityY: -this.def.launch };
  }

  reset(): void {
    this.compression = 0;
    this.time = 0;
  }
}
