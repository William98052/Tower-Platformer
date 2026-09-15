import { describe, expect, it } from 'vitest';
import { overlaps } from '../../src/physics/aabb';
import { isTouching, moveAndCollide } from '../../src/physics/collision';

const box = { x: 0, y: 0, w: 10, h: 10 };

describe('overlaps', () => {
  it('is true for intersecting boxes', () => {
    expect(overlaps(box, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('is false for boxes that only share an edge', () => {
    expect(overlaps(box, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps(box, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });
});

describe('moveAndCollide', () => {
  it('moves freely with no solids', () => {
    expect(moveAndCollide(box, 3, -4, [])).toEqual({ x: 3, y: -4, hitX: false, hitY: false });
  });

  it('lands on a floor when moving down', () => {
    const floor = { x: -50, y: 15, w: 100, h: 10 };
    expect(moveAndCollide(box, 0, 10, [floor])).toEqual({ x: 0, y: 5, hitX: false, hitY: true });
  });

  it('stops at a ceiling when moving up', () => {
    const ceiling = { x: -50, y: -20, w: 100, h: 10 };
    expect(moveAndCollide(box, 0, -15, [ceiling])).toEqual({ x: 0, y: -10, hitX: false, hitY: true });
  });

  it('stops at a wall when moving right', () => {
    const wall = { x: 20, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, 15, 0, [wall])).toEqual({ x: 10, y: 0, hitX: true, hitY: false });
  });

  it('stops at a wall when moving left', () => {
    const wall = { x: -30, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, -25, 0, [wall])).toEqual({ x: -20, y: 0, hitX: true, hitY: false });
  });

  it('slides along a floor it is resting on', () => {
    const floor = { x: -50, y: 10, w: 100, h: 10 };
    expect(moveAndCollide(box, 5, 0, [floor])).toEqual({ x: 5, y: 0, hitX: false, hitY: false });
  });

  it('resolves against the nearest of several solids', () => {
    const near = { x: 12, y: -50, w: 10, h: 100 };
    const far = { x: 18, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, 15, 0, [far, near]).x).toBe(2);
  });
});

describe('isTouching', () => {
  it('detects a solid one unit below', () => {
    const floor = { x: -50, y: 10, w: 100, h: 10 };
    expect(isTouching(box, 0, 1, [floor])).toBe(true);
    expect(isTouching(box, 0, -1, [floor])).toBe(false);
  });
});
