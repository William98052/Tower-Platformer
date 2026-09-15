import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { aimDirection, createPlayer, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };
const FLOOR_Y = FLOOR.y - C.PLAYER_SIZE;
const DASH = input({ dashPressed: true });

function onFloor() {
  const p = createPlayer(0, FLOOR_Y);
  stepPlayer(p, input(), [FLOOR]);
  return p;
}

describe('aimDirection', () => {
  it('uses facing when no direction is held', () => {
    expect(aimDirection(0, 0, -1)).toEqual({ x: -1, y: 0 });
  });

  it('normalizes diagonals', () => {
    const d = aimDirection(1, -1, 1);
    expect(d.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(d.y).toBeCloseTo(-Math.SQRT1_2, 6);
  });

  it('supports straight down', () => {
    expect(aimDirection(0, 1, 1)).toEqual({ x: 0, y: 1 });
  });
});

describe('air dash', () => {
  it('moves at dash speed with no gravity', () => {
    const p = createPlayer(0, 0);
    const e = stepPlayer(p, input({ dashPressed: true, moveX: 1 }), []);
    expect(e.dashed).toBe(true);
    expect(p.vx).toBe(C.DASH_SPEED);
    expect(p.vy).toBe(0);
    for (let i = 0; i < 10; i++) stepPlayer(p, input(), []);
    expect(p.vx).toBe(C.DASH_SPEED);
    expect(p.vy).toBe(0);
  });

  it('dashes the way the player faces when no direction is held', () => {
    const p = createPlayer(0, 0);
    p.facing = -1;
    stepPlayer(p, DASH, []);
    expect(p.vx).toBe(-C.DASH_SPEED);
  });

  it('dashes diagonally', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, input({ dashPressed: true, moveX: 1, moveY: -1 }), []);
    expect(p.vx).toBeCloseTo(C.DASH_SPEED * Math.SQRT1_2, 6);
    expect(p.vy).toBeCloseTo(-C.DASH_SPEED * Math.SQRT1_2, 6);
  });

  it('ends after DASH_TIME and keeps part of its speed', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, input({ dashPressed: true, moveX: 1 }), []);
    let steps = 1;
    while (p.dashTimer > 0 && steps < 30) {
      stepPlayer(p, input(), []);
      steps++;
    }
    expect(steps).toBeGreaterThanOrEqual(17);
    expect(steps).toBeLessThanOrEqual(19);
    expect(p.vx).toBeCloseTo(C.DASH_SPEED * C.DASH_END_KEEP, 6);
  });

  it('allows only one dash in the air', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, DASH, []);
    for (let i = 0; i < 30; i++) stepPlayer(p, input(), []);
    expect(stepPlayer(p, DASH, []).dashed).toBe(false);
  });

  it('refills when landing', () => {
    const p = createPlayer(0, FLOOR_Y - 100);
    stepPlayer(p, DASH, [FLOOR]);
    expect(p.dashCharges).toBe(0);
    for (let i = 0; i < 120; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.onGround).toBe(true);
    expect(p.dashCharges).toBe(C.AIR_DASH_CHARGES);
  });

  it('refills while wall sliding', () => {
    const wall = { x: 100, y: -2000, w: 40, h: 4000 };
    const p = createPlayer(wall.x - C.PLAYER_SIZE, 0);
    p.dashCharges = 0;
    stepPlayer(p, input({ moveX: 1 }), [wall]);
    stepPlayer(p, input({ moveX: 1 }), [wall]);
    expect(p.dashCharges).toBe(C.AIR_DASH_CHARGES);
  });

  it('a neutral dash while against a wall in the air goes away from the wall', () => {
    const wall = { x: 100, y: -2000, w: 40, h: 4000 };
    const p = createPlayer(wall.x - C.PLAYER_SIZE, 0);
    stepPlayer(p, input({ moveX: 1 }), [wall]);
    stepPlayer(p, DASH, [wall]);
    expect(p.vx).toBe(-C.DASH_SPEED);
  });

  it('releasing jump does not cut an upward dash started mid-jump', () => {
    const p = onFloor();
    stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
    for (let i = 0; i < 4; i++) stepPlayer(p, input({ jump: true }), [FLOOR]);
    stepPlayer(p, input({ jump: true, dashPressed: true, moveY: -1 }), [FLOOR]);
    stepPlayer(p, input(), [FLOOR]);
    expect(p.vy).toBe(-C.DASH_SPEED);
  });
});

describe('ground dash', () => {
  it('does not spend the air charge', () => {
    const p = onFloor();
    expect(stepPlayer(p, DASH, [FLOOR]).dashed).toBe(true);
    expect(p.dashCharges).toBe(C.AIR_DASH_CHARGES);
  });

  it('has a cooldown', () => {
    const p = onFloor();
    stepPlayer(p, DASH, [FLOOR]);
    // 30 steps: the dash itself (18 steps) is over, but the 0.4 s cooldown is not.
    for (let i = 0; i < 30; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.dashTimer).toBe(0);
    expect(stepPlayer(p, DASH, [FLOOR]).dashed).toBe(false);
    for (let i = 0; i < 60; i++) stepPlayer(p, input(), [FLOOR]);
    expect(stepPlayer(p, DASH, [FLOOR]).dashed).toBe(true);
  });

  it('can be cancelled by jumping', () => {
    const p = onFloor();
    stepPlayer(p, input({ dashPressed: true, moveX: 1 }), [FLOOR]);
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
    expect(e.jumped).toBe(true);
    expect(p.dashTimer).toBe(0);
    expect(p.vy).toBe(-C.JUMP_VELOCITY);
  });
});
