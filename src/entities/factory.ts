import { overlaps } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';
import { GearEntity } from './gear';
import { MushroomEntity } from './mushroom';
import { PistonEntity } from './piston';
import { TimedDoorEntity } from './timed-door';
import { WaterEntity } from './water';

class PromptEntity implements Entity {
  constructor(private readonly def: Extract<EntityDef, { type: 'prompt' }>) {}

  bounds() {
    return { x: this.def.x, y: this.def.y, w: this.def.w, h: this.def.h };
  }

  update(): void {}
  dynamicSolids(): readonly DynamicSolid[] { return []; }
  field(): FieldEffect | null { return null; }
  draw(): void {}

  collide(player: Player): EntityContact {
    return overlaps(player, this.bounds()) ? { kind: 'prompt', id: this.def.prompt } : { kind: 'none' };
  }

  reset(): void {}
}

export function createEntities(defs: readonly EntityDef[]): Entity[] {
  return defs.map((def) => {
    switch (def.type) {
      case 'mushroom': return new MushroomEntity(def);
      case 'prompt': return new PromptEntity(def);
      case 'gear': return new GearEntity(def);
      case 'piston': return new PistonEntity(def);
      case 'timedDoor': return new TimedDoorEntity(def);
      case 'water': return new WaterEntity(def);
    }
  });
}
