import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const WALL = { x: 100, y: -2000, w: 40, h: 4000 };
const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };

function againstWall() {
  const p = createPlayer(WALL.x - C.PLAYER_SIZE, 0);
  p.vy = 600;
  return p;
}

describe('wall slide', () => {
  it('caps fall speed while holding toward the wall', () => {
    const p = againstWall();
    for (let i = 0; i < 60; i++) stepPlayer(p, input({ moveX: 1 }), [WALL]);
    expect(p.wallDir).toBe(1);
    expect(p.vy).toBe(C.WALL_SLIDE_MAX);
  });

  it('does not slow the fall when not holding toward the wall', () => {
    const p = againstWall();
    for (let i = 0; i < 60; i++) stepPlayer(p, input(), [WALL]);
    expect(p.vy).toBeGreaterThan(C.WALL_SLIDE_MAX);
  });
});

describe('wall jump', () => {
  function slideThenJump() {
    const p = againstWall();
    for (let i = 0; i < 10; i++) stepPlayer(p, input({ moveX: 1 }), [WALL]);
    const e = stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [WALL]);
    return { p, e };
  }

  it('launches up and away from the wall', () => {
    const { p, e } = slideThenJump();
    expect(e.wallJumped).toBe(true);
    expect(e.jumped).toBe(false);
    expect(p.vx).toBe(-C.WALL_JUMP_X);
    expect(p.vy).toBe(-C.WALL_JUMP_Y);
    expect(p.facing).toBe(-1);
  });

  it('reduces air control briefly afterwards', () => {
    const { p } = slideThenJump();
    stepPlayer(p, input({ moveX: 1, jump: true }), [WALL]);
    const expected = -C.WALL_JUMP_X + C.AIR_ACCEL * C.WALL_JUMP_CONTROL * C.STEP;
    expect(p.vx).toBeCloseTo(expected, 6);
  });

  it('restores full air control after the lock expires', () => {
    const { p } = slideThenJump();
    for (let i = 0; i < 20; i++) stepPlayer(p, input({ jump: true }), [WALL]);
    const before = p.vx;
    stepPlayer(p, input({ moveX: 1, jump: true }), [WALL]);
    expect(p.vx - before).toBeCloseTo(C.AIR_ACCEL * C.STEP, 6);
  });

  it('does a normal jump instead when standing on the ground next to a wall', () => {
    const p = createPlayer(WALL.x - C.PLAYER_SIZE, FLOOR.y - C.PLAYER_SIZE);
    stepPlayer(p, input(), [FLOOR, WALL]);
    const e = stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [FLOOR, WALL]);
    expect(e.jumped).toBe(true);
    expect(e.wallJumped).toBe(false);
  });

  it('does nothing in open air', () => {
    const p = createPlayer(0, 0);
    p.vy = 600;
    stepPlayer(p, input(), []);
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), []);
    expect(e.wallJumped).toBe(false);
  });

  it('cannot wall-jump off the same wall again before landing', () => {
    const p = againstWall();
    for (let i = 0; i < 10; i++) stepPlayer(p, input({ moveX: 1 }), [WALL]);
    expect(stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [WALL]).wallJumped).toBe(true);
    let jumpedAgain = false;
    let touchedAgain = false;
    for (let i = 0; i < 120; i++) {
      const touching = p.wallDir === 1;
      touchedAgain ||= touching;
      const e = stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: touching }), [WALL]);
      jumpedAgain ||= e.wallJumped;
    }
    expect(touchedAgain).toBe(true);
    expect(jumpedAgain).toBe(false);
  });

  it('landing re-enables wall jumps off the same wall', () => {
    const p = createPlayer(0, FLOOR.y - C.PLAYER_SIZE);
    p.lastWallJumpDir = 1;
    stepPlayer(p, input(), [FLOOR]);
    expect(p.lastWallJumpDir).toBe(0);
  });

  it('the wall-jump lock does not slow ground movement', () => {
    const p = createPlayer(0, FLOOR.y - C.PLAYER_SIZE);
    stepPlayer(p, input(), [FLOOR]);
    p.wallJumpLock = C.WALL_JUMP_LOCK;
    stepPlayer(p, input({ moveX: 1 }), [FLOOR]);
    expect(p.vx).toBeCloseTo(C.GROUND_ACCEL * C.STEP, 6);
  });

  it('a coyote jump beats a wall jump', () => {
    const p = againstWall();
    p.vy = 0;
    stepPlayer(p, input({ moveX: 1 }), [WALL]);
    p.coyote = 0.05;
    const e = stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [WALL]);
    expect(e.jumped).toBe(true);
    expect(e.wallJumped).toBe(false);
  });

  it('wall-jumps off a wall on the left', () => {
    const leftWall = { x: -40, y: -2000, w: 40, h: 4000 };
    const p = createPlayer(0, 0);
    p.vy = 600;
    for (let i = 0; i < 10; i++) stepPlayer(p, input({ moveX: -1 }), [leftWall]);
    const e = stepPlayer(p, input({ moveX: -1, jump: true, jumpPressed: true }), [leftWall]);
    expect(e.wallJumped).toBe(true);
    expect(p.vx).toBe(C.WALL_JUMP_X);
    expect(p.facing).toBe(1);
  });

  it('releasing jump cuts a wall jump like a ground jump', () => {
    const { p } = slideThenJump();
    stepPlayer(p, input(), [WALL]);
    expect(p.vy).toBeCloseTo((-C.WALL_JUMP_Y + C.GRAVITY * C.STEP) * C.JUMP_CUT, 6);
  });
});

const PILLAR = { x: 0, y: -2000, w: 24, h: 4000 };
const RIGHT = { x: 116, y: -2000, w: 24, h: 4000 }; // 92-wide shaft: player x in [24, 88]
const SHAFT = [PILLAR, RIGHT];

/** Wall-jumps whenever touching a wall, holding toward the other wall and holding jump for `holdSteps`. */
function climbShaft(holdSteps: number, jumps: number) {
  const p = createPlayer(24, 0);
  p.vy = 100;
  stepPlayer(p, input({ moveX: -1 }), SHAFT);
  const jumpYs: number[] = [];
  let heading: -1 | 1 = 1;
  let since = Infinity;
  for (let s = 0; s < 120 * 5 && jumpYs.length < jumps; s++) {
    const press = p.wallDir !== 0 && since > 2;
    if (press) heading = p.wallDir === -1 ? 1 : -1;
    const e = stepPlayer(p, input({ moveX: heading, jumpPressed: press, jump: press || since < holdSteps }), SHAFT);
    since = e.wallJumped ? 0 : since + 1;
    if (e.wallJumped) jumpYs.push(p.y);
  }
  return jumpYs;
}

describe('wall-jump shaft', () => {
  it('climbs a 92-wide shaft by alternating wall jumps, even with tapped jumps', () => {
    for (const hold of [Infinity, 1]) {
      const ys = climbShaft(hold, 8);
      expect(ys).toHaveLength(8);
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1] - 30);
    }
  });

  it('a neutral wall jump does not reach the opposite wall of the shaft', () => {
    const p = createPlayer(24, 0);
    p.vy = 100;
    stepPlayer(p, input({ moveX: -1 }), SHAFT);
    stepPlayer(p, input({ jump: true, jumpPressed: true }), SHAFT);
    let touched = false;
    for (let i = 0; i < 120; i++) {
      stepPlayer(p, input({ jump: true }), SHAFT);
      if (p.wallDir === 1) touched = true;
    }
    expect(touched).toBe(false);
  });
});
