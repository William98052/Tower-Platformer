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

  it('lands on a floor while moving diagonally, keeping horizontal motion', () => {
    const floor = { x: -50, y: 15, w: 100, h: 10 };
    expect(moveAndCollide(box, 4, 8, [floor])).toEqual({ x: 4, y: 5, hitX: false, hitY: true });
  });

  it('keeps falling while pressed into a wall', () => {
    const wall = { x: 12, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, 5, 6, [wall])).toEqual({ x: 2, y: 6, hitX: true, hitY: false });
  });
});

describe('isTouching', () => {
  it('detects a solid one unit below', () => {
    const floor = { x: -50, y: 10, w: 100, h: 10 };
    expect(isTouching(box, 0, 1, [floor])).toBe(true);
    expect(isTouching(box, 0, -1, [floor])).toBe(false);
  });

  it('after landing, touches the floor below but does not overlap it', () => {
    const floor = { x: -50, y: 15, w: 100, h: 10 };
    const r = moveAndCollide(box, 0, 10, [floor]);
    const landed = { ...box, x: r.x, y: r.y };
    expect(isTouching(landed, 0, 1, [floor])).toBe(true);
    expect(isTouching(landed, 0, 0, [floor])).toBe(false);
  });

  it('after hitting a right wall, touches it at +1 only', () => {
    const wall = { x: 20, y: -50, w: 10, h: 100 };
    const r = moveAndCollide(box, 15, 0, [wall]);
    const stopped = { ...box, x: r.x, y: r.y };
    expect(isTouching(stopped, 1, 0, [wall])).toBe(true);
    expect(isTouching(stopped, -1, 0, [wall])).toBe(false);
  });
});

describe('moveAndCollide corner correction', () => {
  const player = { x: 0, y: 20, w: 10, h: 10 };

  it('nudges around a ceiling corner that overlaps by 4 units', () => {
    const ledge = { x: -100, y: 0, w: 104, h: 10 }; // right edge at x=4
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: 4, y: 5, hitX: false, hitY: false });
  });

  it('nudges left around a corner on the right', () => {
    const ledge = { x: 7, y: 0, w: 100, h: 10 }; // left edge at x=7, overlap 3
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: -3, y: 5, hitX: false, hitY: false });
  });

  it('does not nudge when the overlap is larger than the correction', () => {
    const ledge = { x: -100, y: 0, w: 108, h: 10 }; // overlap 8
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: 0, y: 10, hitX: false, hitY: true });
  });

  it('does not nudge when disabled', () => {
    const ledge = { x: -100, y: 0, w: 104, h: 10 };
    expect(moveAndCollide(player, 0, -15, [ledge]).hitY).toBe(true);
  });

  it('never nudges when moving down', () => {
    const floor = { x: -100, y: 35, w: 104, h: 10 };
    expect(moveAndCollide(player, 0, 10, [floor], 6)).toEqual({ x: 0, y: 25, hitX: false, hitY: true });
  });

  it('nudges when the overlap exactly equals the correction', () => {
    const ledge = { x: -100, y: 0, w: 106, h: 10 }; // overlap 6
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: 6, y: 5, hitX: false, hitY: false });
  });

  it('does not nudge into another solid', () => {
    const ledge = { x: -100, y: 0, w: 104, h: 10 }; // overlap 4 on the left
    const wall = { x: 12, y: -100, w: 10, h: 200 }; // blocks x+4 at the target y
    expect(moveAndCollide(player, 0, -15, [ledge, wall], 6)).toEqual({ x: 0, y: 10, hitX: false, hitY: true });
  });

  it('does not nudge against the direction of horizontal movement', () => {
    const ledge = { x: 7, y: 0, w: 100, h: 10 }; // corner on the right, overlap 3 after moving
    // Moving right by 1: box spans 1..11, overlap 4 with the ledge; a left nudge would oppose dx.
    expect(moveAndCollide(player, 1, -15, [ledge], 6)).toEqual({ x: 1, y: 10, hitX: false, hitY: true });
  });

  it('nudges in the direction of horizontal movement', () => {
    const ledge = { x: -100, y: 0, w: 104, h: 10 }; // corner on the left
    // Moving right by 1: box spans 1..11, overlap 3; nudge right by 3 clears it.
    expect(moveAndCollide(player, 1, -15, [ledge], 6)).toEqual({ x: 4, y: 5, hitX: false, hitY: false });
  });
});
