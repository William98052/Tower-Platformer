import * as C from '../core/constants';
import type { InputFrame } from '../core/input';
import type { AABB } from './aabb';
import { isTouching, moveAndCollide } from './collision';

export interface Player extends AABB {
  vx: number;
  vy: number;
  onGround: boolean;
  /** -1 wall on the left, 1 wall on the right, 0 none (always 0 on the ground). */
  wallDir: -1 | 0 | 1;
  facing: -1 | 1;
  coyote: number;
  jumpBuffer: number;
  /** True while rising from a jump that can still be cut short. */
  jumping: boolean;
  wallJumpLock: number;
  dashCharges: number;
  dashTimer: number;
  dashCooldown: number;
}

/** What happened during one step, for effects and sound. */
export interface StepEvents {
  jumped: boolean;
  wallJumped: boolean;
  dashed: boolean;
  /** Downward speed at the moment of landing, or 0 if the player did not land this step. */
  landed: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    w: C.PLAYER_SIZE,
    h: C.PLAYER_SIZE,
    vx: 0,
    vy: 0,
    onGround: false,
    wallDir: 0,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    jumping: false,
    wallJumpLock: 0,
    dashCharges: C.AIR_DASH_CHARGES,
    dashTimer: 0,
    dashCooldown: 0,
  };
}

export function approach(value: number, target: number, maxDelta: number): number {
  return value < target ? Math.min(value + maxDelta, target) : Math.max(value - maxDelta, target);
}

export function stepPlayer(p: Player, input: InputFrame, solids: readonly AABB[], dt = C.STEP): StepEvents {
  const events: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };
  tickTimers(p, input, dt);
  applyHorizontal(p, input, dt);
  applyGravity(p, input, dt);
  tryJump(p, events);
  applyJumpCut(p, input);
  moveAndResolve(p, solids, dt, events);
  return events;
}

function applyHorizontal(p: Player, input: InputFrame, dt: number): void {
  if (input.moveX !== 0) p.facing = input.moveX;
  const target = input.moveX * C.RUN_SPEED;
  const accel = p.onGround ? (input.moveX !== 0 ? C.GROUND_ACCEL : C.GROUND_DECEL) : C.AIR_ACCEL;
  const control = p.wallJumpLock > 0 ? C.WALL_JUMP_CONTROL : 1;
  p.vx = approach(p.vx, target, accel * control * dt);
}

function applyGravity(p: Player, input: InputFrame, dt: number): void {
  p.vy = Math.min(p.vy + C.GRAVITY * dt, C.MAX_FALL);
  const sliding = !p.onGround && p.wallDir !== 0 && input.moveX === p.wallDir;
  if (sliding && p.vy > C.WALL_SLIDE_MAX) p.vy = C.WALL_SLIDE_MAX;
}

function tickTimers(p: Player, input: InputFrame, dt: number): void {
  p.coyote = p.onGround ? C.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? C.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
  p.wallJumpLock = Math.max(0, p.wallJumpLock - dt);
}

function tryJump(p: Player, events: StepEvents): void {
  if (p.jumpBuffer <= 0) return;
  if (p.onGround || p.coyote > 0) {
    p.vy = -C.JUMP_VELOCITY;
    p.onGround = false;
    events.jumped = true;
  } else if (p.wallDir !== 0) {
    p.vx = -p.wallDir * C.WALL_JUMP_X;
    p.vy = -C.WALL_JUMP_Y;
    p.facing = p.wallDir === 1 ? -1 : 1;
    p.wallJumpLock = C.WALL_JUMP_LOCK;
    events.wallJumped = true;
  } else {
    return;
  }
  p.jumpBuffer = 0;
  p.coyote = 0;
  p.jumping = true;
}

/** Releasing jump while still rising cuts the jump short. */
function applyJumpCut(p: Player, input: InputFrame): void {
  if (!p.jumping) return;
  if (p.vy >= 0) {
    p.jumping = false;
  } else if (!input.jump) {
    p.vy *= C.JUMP_CUT;
    p.jumping = false;
  }
}

function moveAndResolve(p: Player, solids: readonly AABB[], dt: number, events: StepEvents): void {
  const impact = p.vy;
  const result = moveAndCollide(p, p.vx * dt, p.vy * dt, solids, C.CORNER_CORRECTION);
  p.x = result.x;
  p.y = result.y;
  if (result.hitX) p.vx = 0;
  if (result.hitY) p.vy = 0;

  const wasOnGround = p.onGround;
  p.onGround = isTouching(p, 0, 1, solids);
  // A fall can end exactly flush (no overlap, so no hit); don't carry fall speed while grounded.
  if (p.onGround && p.vy > 0) p.vy = 0;
  p.wallDir = p.onGround ? 0 : isTouching(p, -1, 0, solids) ? -1 : isTouching(p, 1, 0, solids) ? 1 : 0;
  if (p.onGround && !wasOnGround) events.landed = Math.max(impact, 0);
}
