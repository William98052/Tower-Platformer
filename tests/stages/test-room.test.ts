import { describe, expect, it } from 'vitest';
import { MIN_SOLID_THICKNESS, PLAYER_SIZE } from '../../src/core/constants';
import { overlaps } from '../../src/physics/aabb';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import { TEST_ROOM } from '../../src/stages/test-room';
import { input } from '../helpers/input';

describe('TEST_ROOM', () => {
  it('keeps every solid inside the world bounds', () => {
    for (const s of TEST_ROOM.solids) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(TEST_ROOM.width);
      expect(s.y + s.h).toBeLessThanOrEqual(TEST_ROOM.height);
    }
  });

  it('never uses solids thinner than the anti-tunnelling minimum', () => {
    for (const s of TEST_ROOM.solids) {
      expect(Math.min(s.w, s.h)).toBeGreaterThanOrEqual(MIN_SOLID_THICKNESS);
    }
  });

  it('has no overlapping solids', () => {
    const { solids } = TEST_ROOM;
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        expect(overlaps(solids[i], solids[j]), `solids ${i} and ${j}`).toBe(false);
      }
    }
  });

  it('spawns the player in free space above ground they land on', () => {
    const p = createPlayer(TEST_ROOM.spawn.x, TEST_ROOM.spawn.y);
    expect(TEST_ROOM.solids.some((s) => overlaps(p, s))).toBe(false);
    for (let i = 0; i < 120; i++) stepPlayer(p, input(), TEST_ROOM.solids);
    expect(p.onGround).toBe(true);
  });
});

/**
 * Starts standing on the shaft-exit platform (top y 860) and runs left toward the
 * dash-gap platform (x 200..320, top y 760). Jumps at step `jumpAt` (holding jump),
 * optionally dashes at step `dashAt` aimed left plus `dashY`. Returns true on landing on it.
 */
function crossGap(jumpAt: number, dashAt: number, dashY: -1 | 0): boolean {
  const p = createPlayer(720, 860 - PLAYER_SIZE);
  stepPlayer(p, input(), TEST_ROOM.solids);
  for (let t = 0; t < 400; t++) {
    stepPlayer(
      p,
      input({
        moveX: -1,
        moveY: t === dashAt ? dashY : 0,
        jumpPressed: t === jumpAt,
        jump: t >= jumpAt,
        dashPressed: t === dashAt,
      }),
      TEST_ROOM.solids,
    );
    if (p.onGround && p.y === 760 - PLAYER_SIZE && p.x < 320) return true;
    if (p.y > 900) return false;
  }
  return false;
}

describe('TEST_ROOM dash gap', () => {
  it('cannot be jumped without a dash', () => {
    for (let jumpAt = 40; jumpAt < 90; jumpAt++) {
      expect(crossGap(jumpAt, -1, 0), `jump at ${jumpAt}`).toBe(false);
    }
  });

  it('can be crossed with a jump and an air dash', () => {
    expect(crossGap(68, 68 + 40, -1)).toBe(true);
  });
});
