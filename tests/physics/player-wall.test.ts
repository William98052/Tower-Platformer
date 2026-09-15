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
});
