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

  update(t: number, _dt: number): void {
    this.previous = this.current;
    this.current = gearBoxAt(this.def, t);
  }

  dynamicSolids(): readonly DynamicSolid[] {
    return [{
      box: this.current,
      delta: { x: this.current.x - this.previous.x, y: this.current.y - this.previous.y },
    }];
  }

  field(): FieldEffect | null { return null; }
  draw(): void {}
  collide(_player: Player): EntityContact { return { kind: 'none' }; }

  reset(): void {
    this.current = gearBoxAt(this.def, 0);
    this.previous = { ...this.current };
  }
}
