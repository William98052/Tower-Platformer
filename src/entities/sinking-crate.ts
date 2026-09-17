import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';
import { isStandingOnSolid } from './interactions';

type SinkingCrateDef = Extract<EntityDef, { type: 'sinkingCrate' }>;

const SINK_DELAY = 0.35;
const SINK_SPEED = 70;
const RISE_SPEED = 50;

function crateBox(def: SinkingCrateDef, offset: number) {
  return {
    x: def.x,
    y: def.y + offset,
    w: def.w,
    h: def.h,
    surface: 'normal' as const,
  };
}

export class SinkingCrateEntity implements Entity {
  private offset = 0;
  private previousOffset = 0;
  private stoodOnFor = 0;
  private standing = false;

  constructor(readonly def: SinkingCrateDef) {}

  bounds() { return crateBox(this.def, this.offset); }

  update(_t: number, dt: number): void {
    this.previousOffset = this.offset;
    if (this.standing) {
      const previousStandingTime = this.stoodOnFor;
      this.stoodOnFor += dt;
      const sinkingTime = previousStandingTime >= SINK_DELAY - 1e-9
        ? dt
        : Math.max(0, this.stoodOnFor - SINK_DELAY);
      if (sinkingTime > 1e-9) {
        this.offset = Math.min(this.def.sinkDistance, this.offset + SINK_SPEED * sinkingTime);
      }
    } else {
      this.stoodOnFor = 0;
      this.offset = Math.max(0, this.offset - RISE_SPEED * dt);
    }
  }

  dynamicSolids(): readonly DynamicSolid[] {
    const box = crateBox(this.def, this.offset);
    return [{ box, delta: { x: 0, y: this.offset - this.previousOffset } }];
  }

  field(): FieldEffect | null { return null; }

  draw(ctx: CanvasRenderingContext2D, _t: number, alpha: number): void {
    const y = this.def.y + this.previousOffset + (this.offset - this.previousOffset) * alpha;
    ctx.save();
    ctx.fillStyle = '#6d6950';
    ctx.fillRect(this.def.x, y, this.def.w, this.def.h);
    ctx.strokeStyle = '#a7a26f';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.def.x + 1.5, y + 1.5, this.def.w - 3, this.def.h - 3);
    ctx.restore();
  }

  collide(player: Player): EntityContact {
    this.standing = isStandingOnSolid(player, this.bounds());
    return { kind: 'none' };
  }

  reset(): void {
    this.offset = 0;
    this.previousOffset = 0;
    this.stoodOnFor = 0;
    this.standing = false;
  }
}
