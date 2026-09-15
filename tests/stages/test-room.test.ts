import { describe, expect, it } from 'vitest';
import { MIN_SOLID_THICKNESS, PLAYER_SIZE } from '../../src/core/constants';
import { type AABB, overlaps } from '../../src/physics/aabb';
import { createPlayer, type Player, stepPlayer } from '../../src/physics/player';
import { TEST_ROOM } from '../../src/stages/test-room';
import { input } from '../helpers/input';

const solidAt = (x: number, y: number): AABB => {
  const s = TEST_ROOM.solids.find((o) => o.x === x && o.y === y);
  if (!s) throw new Error(`no solid at ${x},${y}`);
  return s;
};

/** Standing on `s`; tolerates the <1 unit hover that the 1-unit ground probe reports as grounded. */
function standsOn(p: Player, s: AABB): boolean {
  return p.onGround && Math.abs(p.y + p.h - s.y) < 1 && p.x < s.x + s.w && p.x + p.w > s.x;
}

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

  it('is fully enclosed, so the player cannot leave the world', () => {
    const { width, height, solids } = TEST_ROOM;
    const covered = (x: number, y: number, w: number, h: number) =>
      solids.some((s) => s.x <= x && s.y <= y && s.x + s.w >= x + w && s.y + s.h >= y + h);
    expect(covered(0, 0, width, 1), 'ceiling').toBe(true);
    expect(covered(0, height - 1, width, 1), 'floor').toBe(true);
    for (let y = 0; y < height; y += 10) {
      expect(covered(0, y, 1, 1), `left edge at y ${y}`).toBe(true);
      expect(covered(width - 1, y, 1, 1), `right edge at y ${y}`).toBe(true);
    }
  });
});

const EXIT = solidAt(560, 860);
const TARGET = solidAt(200, 740);

/**
 * Starts standing on the shaft-exit platform at `startX` and runs left toward the dash-gap target.
 * Jumps at step `jumpAt` (holding jump); optionally dashes at `dashAt` aimed left plus `dashY`.
 */
function crossGap(startX: number, jumpAt: number, dashAt = -1, dashY: -1 | 0 = 0): boolean {
  const p = createPlayer(startX, EXIT.y - PLAYER_SIZE);
  stepPlayer(p, input(), TEST_ROOM.solids);
  for (let t = 0; t < 400; t++) {
    const dash = t === dashAt;
    stepPlayer(
      p,
      input({
        moveX: -1,
        moveY: dash ? dashY : 0,
        jumpPressed: t === jumpAt,
        jump: t >= jumpAt,
        dashPressed: dash,
      }),
      TEST_ROOM.solids,
    );
    if (standsOn(p, TARGET)) return true;
    if (p.y > EXIT.y + 40) return false;
  }
  return false;
}

/** True if some start position and jump timing, running in `dir` with jump held, lands on `to` without dashing. */
function plainJumpReaches(from: AABB, to: AABB, dir: -1 | 1): boolean {
  for (let startX = from.x; startX <= from.x + from.w - PLAYER_SIZE; startX += 4) {
    for (let jumpAt = 0; jumpAt <= 60; jumpAt++) {
      const p = createPlayer(startX, from.y - PLAYER_SIZE);
      stepPlayer(p, input(), TEST_ROOM.solids);
      for (let t = 0; t < 240; t++) {
        stepPlayer(p, input({ moveX: dir, jumpPressed: t === jumpAt, jump: t >= jumpAt }), TEST_ROOM.solids);
        if (standsOn(p, to)) return true;
        if (p.y > from.y + 200) break;
      }
    }
  }
  return false;
}

describe('TEST_ROOM dash gap', () => {
  it('cannot be jumped without a dash from any run-up, including coyote jumps', () => {
    for (let startX = EXIT.x; startX <= EXIT.x + EXIT.w - PLAYER_SIZE; startX += 4) {
      for (let jumpAt = 0; jumpAt <= 100; jumpAt++) {
        expect(crossGap(startX, jumpAt), `start ${startX} jump ${jumpAt}`).toBe(false);
      }
    }
  });

  it('can be crossed with a jump and an air dash', () => {
    expect(crossGap(720, 68, 108, -1)).toBe(true);
  });
});

describe('TEST_ROOM shaft', () => {
  it('is climbable by alternating wall jumps and exits onto the exit platform', () => {
    const p = createPlayer(900, solidAt(844, 1220).y - PLAYER_SIZE);
    stepPlayer(p, input(), TEST_ROOM.solids);
    let toward: -1 | 1 = 1;
    let wallJumps = 0;
    let airborne = false;
    let landed = false;
    for (let t = 0; t < 600 && !landed; t++) {
      const onWall = p.wallDir === toward;
      if (onWall) toward = toward === 1 ? -1 : 1;
      const e = stepPlayer(p, input({ moveX: toward, jump: true, jumpPressed: t === 0 || onWall }), TEST_ROOM.solids);
      if (e.wallJumped) wallJumps++;
      if (!p.onGround) airborne = true;
      landed = airborne && p.onGround;
    }
    expect(standsOn(p, EXIT)).toBe(true);
    expect(wallJumps).toBeGreaterThanOrEqual(2);
  });

  it('the last warm-up step is reachable from the previous one with a plain jump', () => {
    expect(plainJumpReaches(solidAt(340, 1380), solidAt(600, 1240), 1)).toBe(true);
  });

  it('the shaft floor is reachable from the last warm-up step with a plain jump', () => {
    expect(plainJumpReaches(solidAt(600, 1240), solidAt(844, 1220), 1)).toBe(true);
  });

  it('the pillar top joins the exit platform with no gap', () => {
    const pillar = solidAt(760, 876);
    expect(pillar.x + pillar.w).toBe(844);
    expect(EXIT.y + EXIT.h).toBe(pillar.y);
    expect(EXIT.x + EXIT.w).toBe(pillar.x + pillar.w);
  });
});
