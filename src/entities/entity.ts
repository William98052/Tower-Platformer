import type { AABB } from '../physics/aabb';
import type { CollisionSolid } from '../physics/collision';
import type { Player } from '../physics/player';
import type { Point, PromptId } from '../stages/types';

export interface DynamicSolid {
  box: CollisionSolid;
  delta: Point;
}

export interface WaterEffect {
  gravityScale: number;
  maxFall: number;
  dragPerStep: number;
  strokeSpeed: number;
  strokeCooldown: number;
}

export interface FieldEffect {
  water?: WaterEffect;
  accelerationX: number;
  accelerationY: number;
}

export type EntityContact =
  | { kind: 'none' }
  | { kind: 'launch'; velocityY: number }
  | { kind: 'prompt'; id: PromptId }
  | { kind: 'push'; dx: number; dy: number }
  | { kind: 'hazard'; centerX: number };

/** Compatibility alias for existing consumers while contacts grow beyond collision-only results. */
export type CollisionResult = EntityContact;

export interface Entity {
  bounds(): AABB;
  update(t: number, dt: number): void;
  dynamicSolids(): readonly DynamicSolid[];
  field(player: Player): FieldEffect | null;
  draw(ctx: CanvasRenderingContext2D, t: number, alpha: number): void;
  collide(player: Player): EntityContact;
  reset(): void;
}
