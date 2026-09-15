import type { AABB } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { PromptId } from '../stages/types';

export type CollisionResult =
  | { kind: 'none' }
  | { kind: 'launch'; velocityY: number }
  | { kind: 'prompt'; id: PromptId };

export interface Entity {
  bounds(): AABB;
  update(t: number, dt: number): void;
  draw(ctx: CanvasRenderingContext2D, t: number, alpha: number): void;
  collide(player: Player): CollisionResult;
  reset(): void;
}
