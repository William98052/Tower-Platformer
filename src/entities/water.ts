import { overlaps } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';

type WaterDef = Extract<EntityDef, { type: 'water' }>;

const WATER_EFFECT = {
  gravityScale: 0.45,
  maxFall: 220,
  dragPerStep: 0.96,
  strokeSpeed: 420,
  strokeCooldown: 0.22,
} as const;

export class WaterEntity implements Entity {
  constructor(readonly def: WaterDef) {}

  bounds() {
    return { x: this.def.x, y: this.def.y, w: this.def.w, h: this.def.h };
  }

  update(): void {}
  dynamicSolids(): readonly DynamicSolid[] { return []; }

  field(player: Player): FieldEffect | null {
    if (!overlaps(player, this.bounds())) return null;
    return {
      accelerationX: this.def.currentX,
      accelerationY: this.def.currentY,
      water: WATER_EFFECT,
    };
  }

  draw(): void {}
  collide(): EntityContact { return { kind: 'none' }; }
  reset(): void {}
}
