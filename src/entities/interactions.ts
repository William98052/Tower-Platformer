import { overlaps } from '../physics/aabb';
import type { CollisionSolid } from '../physics/collision';
import type { Player } from '../physics/player';
import type { DynamicSolid, FieldEffect, WaterEffect } from './entity';

/** Carries a player resting on a moving solid without allowing the carry to embed them. */
export function carryStandingPlayer(
  player: Player,
  solid: DynamicSolid,
  blockers: readonly CollisionSolid[] = [],
): boolean {
  const previousX = solid.box.x - solid.delta.x;
  const previousY = solid.box.y - solid.delta.y;
  const standing = Math.abs(player.y + player.h - previousY) <= 1
    && player.x + player.w > previousX
    && player.x < previousX + solid.box.w;
  if (!standing) return false;

  const candidate = {
    x: player.x + solid.delta.x,
    y: player.y + solid.delta.y,
    w: player.w,
    h: player.h,
  };
  if (blockers.some((blocker) => blocker !== solid.box && overlaps(candidate, blocker))) return false;
  player.x = candidate.x;
  player.y = candidate.y;
  return true;
}

/** Combines simultaneous fields without compounding water drag or gravity per overlap. */
export function resolveFieldEffects(effects: readonly FieldEffect[]): FieldEffect | null {
  if (effects.length === 0) return null;
  let accelerationX = 0;
  let accelerationY = 0;
  let water: WaterEffect | undefined;

  for (const effect of effects) {
    accelerationX += effect.accelerationX;
    accelerationY += effect.accelerationY;
    if (!effect.water) continue;
    water = water ? strongestWater(water, effect.water) : { ...effect.water };
  }

  return water ? { accelerationX, accelerationY, water } : { accelerationX, accelerationY };
}

function strongestWater(a: WaterEffect, b: WaterEffect): WaterEffect {
  return {
    gravityScale: Math.min(a.gravityScale, b.gravityScale),
    maxFall: Math.min(a.maxFall, b.maxFall),
    dragPerStep: Math.min(a.dragPerStep, b.dragPerStep),
    strokeSpeed: Math.max(a.strokeSpeed, b.strokeSpeed),
    strokeCooldown: Math.min(a.strokeCooldown, b.strokeCooldown),
  };
}
