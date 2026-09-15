import * as C from '../core/constants';
import type { InputFrame } from '../core/input';
import type { AABB } from './aabb';
import { collisionSolidsFor, type CollisionSolid, isTouching, moveAndCollide, surfaceFloorY } from './collision';

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
  /** Side of the last wall jump; that side can't be wall-jumped again until landing. */
  lastWallJumpDir: -1 | 0 | 1;
  dashCharges: number;
  dashTimer: number;
  dashCooldown: number;
  /** Wall side that already refilled the dash this airtime; resets on landing. */
  lastWallRefillDir: -1 | 0 | 1;
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
    lastWallJumpDir: 0,
    dashCharges: C.AIR_DASH_CHARGES,
    dashTimer: 0,
    dashCooldown: 0,
    lastWallRefillDir: 0,
  };
}

export function approach(value: number, target: number, maxDelta: number): number {
  return value < target ? Math.min(value + maxDelta, target) : Math.max(value - maxDelta, target);
}

/** Unit dash direction from held input; falls back to facing when nothing is held. */
export function aimDirection(moveX: number, moveY: number, facing: -1 | 1): { x: number; y: number } {
  if (moveX === 0 && moveY === 0) return { x: facing, y: 0 };
  const length = Math.hypot(moveX, moveY);
  return { x: moveX / length, y: moveY / length };
}

export function stepPlayer(p: Player, input: InputFrame, solids: readonly CollisionSolid[], dt = C.STEP): StepEvents {
  const events: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };
  tickTimers(p, input, dt);
  if (tryStartDash(p, input, events) || p.dashTimer > 0) {
    updateDash(p, dt);
  } else {
    applyHorizontal(p, input, dt);
    applyGravity(p, input, dt);
  }
  tryJump(p, events);
  applyJumpCut(p, input);
  moveAndResolve(p, solids, dt, events);
  refillDash(p, input);
  return events;
}

function applyHorizontal(p: Player, input: InputFrame, dt: number): void {
  if (input.moveX !== 0) p.facing = input.moveX;
  const target = input.moveX * C.RUN_SPEED;
  const accel = p.onGround ? (input.moveX !== 0 ? C.GROUND_ACCEL : C.GROUND_DECEL) : C.AIR_ACCEL;
  const control = p.wallJumpLock > 0 && !p.onGround ? C.WALL_JUMP_CONTROL : 1;
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
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
}

function tryJump(p: Player, events: StepEvents): void {
  if (p.jumpBuffer <= 0) return;
  if (p.onGround || p.coyote > 0) {
    p.vy = -C.JUMP_VELOCITY;
    p.onGround = false;
    events.jumped = true;
  } else if (p.wallDir !== 0 && p.wallDir !== p.lastWallJumpDir) {
    p.vx = -p.wallDir * C.WALL_JUMP_X;
    p.vy = -C.WALL_JUMP_Y;
    p.facing = p.wallDir === 1 ? -1 : 1;
    p.wallJumpLock = C.WALL_JUMP_LOCK;
    p.lastWallJumpDir = p.wallDir;
    events.wallJumped = true;
  } else {
    return;
  }
  p.jumpBuffer = 0;
  p.coyote = 0;
  p.jumping = true;
  if (p.dashTimer > 0) {
    // Cancelling a dash with a ground jump keeps the same fraction a normal dash end would.
    if (events.jumped) p.vx *= C.DASH_END_KEEP;
    p.dashTimer = 0;
  }
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

function tryStartDash(p: Player, input: InputFrame, events: StepEvents): boolean {
  if (!input.dashPressed || p.dashTimer > 0 || p.dashCharges <= 0) return false;
  if (p.onGround) {
    if (p.dashCooldown > 0) return false;
    p.dashCooldown = C.GROUND_DASH_COOLDOWN;
  }
  p.dashCharges -= 1;
  if (input.moveX !== 0) p.facing = input.moveX;
  // A neutral dash while touching a wall in the air goes away from the wall, not into it.
  const neutralFacing = !p.onGround && p.wallDir !== 0 ? (p.wallDir === 1 ? -1 : 1) : p.facing;
  // On the ground a downward aim would just stall against the floor, so dash horizontally instead.
  const aimY = p.onGround && input.moveY > 0 ? 0 : input.moveY;
  const dir = aimDirection(input.moveX, aimY, neutralFacing);
  p.vx = dir.x * C.DASH_SPEED;
  p.vy = dir.y * C.DASH_SPEED;
  p.dashTimer = C.DASH_TIME;
  p.jumping = false;
  events.dashed = true;
  return true;
}

/** Holds dash velocity (no gravity) until the timer runs out, then bleeds speed. */
function updateDash(p: Player, dt: number): void {
  // Snap tiny float leftovers to 0 so the dash lasts exactly DASH_TIME / STEP steps.
  p.dashTimer = p.dashTimer - dt > 1e-9 ? p.dashTimer - dt : 0;
  if (p.dashTimer === 0) {
    p.vx *= C.DASH_END_KEEP;
    p.vy *= C.DASH_END_KEEP;
  }
}

function refillDash(p: Player, input: InputFrame): void {
  if (p.dashTimer > 0) return;
  if (p.onGround) {
    p.dashCharges = C.AIR_DASH_CHARGES;
    p.lastWallRefillDir = 0;
    return;
  }
  // One refill per wall side per airtime, so dashing up a single wall can't climb forever.
  const sliding = p.wallDir !== 0 && input.moveX === p.wallDir;
  if (sliding && p.wallDir !== p.lastWallRefillDir && p.dashCharges < C.AIR_DASH_CHARGES) {
    p.dashCharges = C.AIR_DASH_CHARGES;
    p.lastWallRefillDir = p.wallDir;
  }
}

function moveAndResolve(p: Player, solids: readonly CollisionSolid[], dt: number, events: StepEvents): void {
  const impact = p.vy;
  const previousBottom = p.y + p.h;
  const dx = p.vx * dt;
  const dy = p.vy * dt;
  const blocking = collisionSolidsFor(p, solids, dy);
  const result = moveAndCollide(p, dx, dy, blocking, C.CORNER_CORRECTION);
  p.x = result.x;
  p.y = result.y;
  if (result.hitX) p.vx = 0;
  if (result.hitY) p.vy = 0;

  let landedOnSlope = false;
  if (dy >= 0) {
    const centerX = p.x + p.w / 2;
    for (const solid of solids) {
      if (solid.surface !== 'slopeUp' && solid.surface !== 'slopeDown') continue;
      const floorY = surfaceFloorY(solid as import('../stages/types').SolidDef, centerX);
      if (floorY === null) continue;
      const nextBottom = p.y + p.h;
      if (previousBottom <= floorY + 1 && nextBottom >= floorY) {
        p.y = floorY - p.h;
        p.vy = 0;
        landedOnSlope = true;
      }
    }
  }

  const wasOnGround = p.onGround;
  p.onGround = landedOnSlope || isTouching(p, 0, 1, collisionSolidsFor(p, solids, 1));
  // A fall can end exactly flush (no overlap, so no hit); don't carry fall speed while grounded.
  if (p.onGround && p.vy > 0) p.vy = 0;
  if (p.onGround) p.lastWallJumpDir = 0;
  p.wallDir = p.onGround ? 0 : isTouching(p, -1, 0, solids) ? -1 : isTouching(p, 1, 0, solids) ? 1 : 0;
  if (p.onGround && !wasOnGround) events.landed = Math.max(impact, 0);

  if (p.onGround && isOnSurface(p, solids, 'bouncy')) {
    p.vy = -C.BOUNCE_VELOCITY;
    p.onGround = false;
    p.jumping = false;
  }
}

function isOnSurface(p: Player, solids: readonly CollisionSolid[], surface: CollisionSolid['surface']): boolean {
  const foot = p.y + p.h;
  return solids.some((solid) => solid.surface === surface
    && p.x + p.w > solid.x
    && p.x < solid.x + solid.w
    && Math.abs(foot - solid.y) <= 1);
}
