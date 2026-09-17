import { overlaps } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';
import { MushroomEntity } from './mushroom';

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
  return defs.map((def) => def.type === 'mushroom' ? new MushroomEntity(def) : new PromptEntity(def));
}
