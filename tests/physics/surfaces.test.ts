import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { collisionSolidsFor, surfaceFloorY } from '../../src/physics/collision';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import type { SolidDef } from '../../src/stages/types';
import { input } from '../helpers/input';

const oneWay: SolidDef = { x: 0, y: 100, w: 200, h: 16, surface: 'oneWay' };

describe('one-way surfaces', () => {
  it('collides while descending from above', () => {
    const p = createPlayer(40, 70);
    expect(collisionSolidsFor(p, [oneWay], 4)).toContain(oneWay);
  });

  it('does not collide while rising or starting below the top edge', () => {
    const rising = createPlayer(40, 70);
    expect(collisionSolidsFor(rising, [oneWay], -4)).toEqual([]);
    const below = createPlayer(40, 90);
    expect(collisionSolidsFor(below, [oneWay], 4)).toEqual([]);
  });
});

describe('special surfaces', () => {
  it('launches from a bouncy surface on landing', () => {
    const bounce: SolidDef = { x: 0, y: 100, w: 200, h: 16, surface: 'bouncy' };
    const p = createPlayer(40, 70);
    p.vy = 300;
    for (let i = 0; i < 20 && p.vy >= 0; i++) stepPlayer(p, input(), [bounce]);
    expect(p.vy).toBe(-C.BOUNCE_VELOCITY);
    expect(p.onGround).toBe(false);
  });

  it('uses the configured wall-slide cap on a vine wall', () => {
    const vine: SolidDef = { x: 100, y: 0, w: 20, h: 300, surface: 'vine' };
    const p = createPlayer(72, 40);
    p.vy = 500;
    stepPlayer(p, input({ moveX: 1 }), [vine]);
    stepPlayer(p, input({ moveX: 1 }), [vine]);
    expect(p.wallDir).toBe(1);
    expect(p.vy).toBeLessThanOrEqual(C.WALL_SLIDE_MAX);
  });
});

describe('slope sampling', () => {
  const up: SolidDef = { x: 100, y: 100, w: 100, h: 100, surface: 'slopeUp' };
  const down: SolidDef = { x: 100, y: 100, w: 100, h: 100, surface: 'slopeDown' };

  it('samples an ascending floor from bottom-left to top-right', () => {
    expect(surfaceFloorY(up, 100)).toBe(200);
    expect(surfaceFloorY(up, 150)).toBe(150);
    expect(surfaceFloorY(up, 200)).toBe(100);
  });

  it('samples a descending floor from top-left to bottom-right', () => {
    expect(surfaceFloorY(down, 100)).toBe(100);
    expect(surfaceFloorY(down, 150)).toBe(150);
    expect(surfaceFloorY(down, 200)).toBe(200);
  });
});
