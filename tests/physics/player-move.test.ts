import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { approach, createPlayer, stepPlayer, type StepEvents } from '../../src/physics/player';
import { input } from '../helpers/input';

const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };
const FLOOR_Y = FLOOR.y - C.PLAYER_SIZE; // 72

function onFloor(x = 0) {
  const p = createPlayer(x, FLOOR_Y);
  stepPlayer(p, input(), [FLOOR]);
  return p;
}

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 4)).toBe(6);
    expect(approach(1, 0, 4)).toBe(0);
  });
});

describe('stepPlayer: gravity and ground', () => {
  it('falls and comes to rest on the floor', () => {
    const p = createPlayer(0, 0);
    for (let i = 0; i < 120; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.y).toBe(FLOOR_Y);
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
  });

  it('caps fall speed', () => {
    const p = createPlayer(0, 0);
    for (let i = 0; i < 300; i++) stepPlayer(p, input(), []);
    expect(p.vy).toBe(C.MAX_FALL);
  });

  it('reports the impact speed once when landing', () => {
    const p = createPlayer(0, -200);
    const landings: number[] = [];
    for (let i = 0; i < 120; i++) {
      const e: StepEvents = stepPlayer(p, input(), [FLOOR]);
      if (e.landed > 0) landings.push(e.landed);
    }
    expect(landings).toHaveLength(1);
    expect(landings[0]).toBeGreaterThan(1000);
  });

  it('keeps vertical speed at exactly 0 while standing still', () => {
    const p = onFloor();
    for (let i = 0; i < 300; i++) {
      const e = stepPlayer(p, input(), [FLOOR]);
      expect(e.landed).toBe(0);
      expect(p.vy).toBe(0);
      expect(p.y).toBe(FLOOR_Y);
    }
  });

  it('zeroes vertical speed on the step it lands exactly flush with the floor', () => {
    const p = createPlayer(0, FLOOR_Y - 10); // one max-speed step (10 units) above the floor
    p.vy = C.MAX_FALL;
    const e = stepPlayer(p, input(), [FLOOR]);
    expect(e.landed).toBe(C.MAX_FALL);
    expect(p.onGround).toBe(true);
    expect(p.vy).toBe(0);
  });
});

describe('stepPlayer: running', () => {
  it('accelerates to run speed', () => {
    const p = onFloor();
    for (let i = 0; i < 60; i++) stepPlayer(p, input({ moveX: 1 }), [FLOOR]);
    expect(p.vx).toBe(C.RUN_SPEED);
  });

  it('decelerates to a stop when input is released', () => {
    const p = onFloor();
    p.vx = C.RUN_SPEED;
    for (let i = 0; i < 60; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.vx).toBe(0);
  });

  it('turns to face the movement direction', () => {
    const p = onFloor();
    stepPlayer(p, input({ moveX: -1 }), [FLOOR]);
    expect(p.facing).toBe(-1);
  });

  it('stops against a wall', () => {
    const wall = { x: 100, y: -1000, w: 40, h: 1100 };
    const p = onFloor();
    for (let i = 0; i < 120; i++) stepPlayer(p, input({ moveX: 1 }), [FLOOR, wall]);
    expect(p.x).toBe(100 - C.PLAYER_SIZE);
    expect(p.vx).toBe(0);
  });

  it('steers in the air with AIR_ACCEL', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, input({ moveX: 1 }), []);
    expect(p.vx).toBeCloseTo(C.AIR_ACCEL * C.STEP, 9);
  });
});

describe('stepPlayer: wall contact', () => {
  const wall = { x: 100, y: -2000, w: 40, h: 4000 };

  it('reports the wall side while airborne', () => {
    const p = createPlayer(100 - C.PLAYER_SIZE, 0);
    stepPlayer(p, input(), [wall]);
    expect(p.wallDir).toBe(1);
  });

  it('reports no wall while standing on the ground', () => {
    const p = createPlayer(100 - C.PLAYER_SIZE, FLOOR_Y);
    stepPlayer(p, input(), [FLOOR, wall]);
    expect(p.onGround).toBe(true);
    expect(p.wallDir).toBe(0);
  });

  it('reports a wall on the left while airborne', () => {
    const leftWall = { x: -40, y: -2000, w: 40, h: 4000 };
    const p = createPlayer(0, 0);
    stepPlayer(p, input(), [leftWall]);
    expect(p.wallDir).toBe(-1);
  });
});
