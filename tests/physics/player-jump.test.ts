import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };
const FLOOR_Y = FLOOR.y - C.PLAYER_SIZE;

function onFloor(x = 0, solids = [FLOOR]) {
  const p = createPlayer(x, FLOOR_Y);
  stepPlayer(p, input(), solids);
  return p;
}

/** Jumps, holding jump for `holdSteps` steps, and returns the height gained at the apex. */
function jumpHeight(holdSteps: number): number {
  const p = onFloor();
  const startY = p.y;
  let minY = p.y;
  stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
  for (let i = 1; i < 240; i++) {
    stepPlayer(p, input({ jump: i < holdSteps }), [FLOOR]);
    minY = Math.min(minY, p.y);
    if (p.vy >= 0) break;
  }
  return startY - minY;
}

describe('jump', () => {
  it('leaves the ground with upward velocity', () => {
    const p = onFloor();
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
    expect(e.jumped).toBe(true);
    expect(p.vy).toBe(-C.JUMP_VELOCITY);
    expect(p.onGround).toBe(false);
  });

  it('reaches about 155 units when held', () => {
    const h = jumpHeight(1000);
    // ≈159.5 in practice: the jump step sets vy after gravity, so that step rises a full 7.5 units.
    expect(h).toBeGreaterThan(145);
    expect(h).toBeLessThan(162);
  });

  it('is much shorter when released early', () => {
    const h = jumpHeight(3);
    expect(h).toBeGreaterThan(20);
    expect(h).toBeLessThan(60);
  });

  it('cannot jump in mid-air without coyote time', () => {
    const p = createPlayer(0, 0);
    for (let i = 0; i < 30; i++) stepPlayer(p, input(), []);
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), []);
    expect(e.jumped).toBe(false);
    expect(p.vy).toBeGreaterThan(0);
  });

  it('a jump blocked by a flush ceiling fires once and does not repeat while held', () => {
    const ceiling = { x: -1000, y: FLOOR_Y - 40, w: 3000, h: 40 }; // bottom edge touches the head
    const solids = [FLOOR, ceiling];
    const p = onFloor(0, solids);
    expect(stepPlayer(p, input({ jump: true, jumpPressed: true }), solids).jumped).toBe(true);
    for (let i = 0; i < 20; i++) {
      expect(stepPlayer(p, input({ jump: true }), solids).jumped).toBe(false);
      expect(p.jumping).toBe(false);
      expect(p.onGround).toBe(true);
      expect(p.y).toBe(FLOOR_Y);
    }
  });

  it('cannot jump again in the air shortly after jumping', () => {
    for (let wait = 1; wait <= 10; wait++) {
      const p = onFloor();
      stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
      for (let i = 0; i < wait; i++) stepPlayer(p, input({ jump: true }), [FLOOR]);
      const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
      expect(e.jumped).toBe(false);
      expect(p.onGround).toBe(false);
    }
  });

  it('a head bonk ends the jump so a later release cuts nothing', () => {
    const ceiling = { x: -1000, y: FLOOR_Y - 50, w: 3000, h: 40 }; // 10 units above the head
    const solids = [FLOOR, ceiling];
    const p = onFloor(0, solids);
    stepPlayer(p, input({ jump: true, jumpPressed: true }), solids);
    stepPlayer(p, input({ jump: true }), solids);
    expect(p.vy).toBe(0);
    stepPlayer(p, input({ jump: true }), solids);
    expect(p.jumping).toBe(false);
  });
});

describe('coyote time', () => {
  const LEDGE = { x: 0, y: 100, w: 100, h: 40 };

  function runOffLedge(extraSteps: number) {
    const p = onFloor(60, [LEDGE]);
    for (let i = 0; i < 120 && p.onGround; i++) stepPlayer(p, input({ moveX: 1 }), [LEDGE]);
    expect(p.onGround).toBe(false);
    for (let i = 0; i < extraSteps; i++) stepPlayer(p, input({ moveX: 1 }), [LEDGE]);
    return stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [LEDGE]);
  }

  it('allows a jump shortly after running off a ledge', () => {
    expect(runOffLedge(6).jumped).toBe(true);
  });

  it('expires after COYOTE_TIME', () => {
    expect(runOffLedge(18).jumped).toBe(false);
  });
});

describe('jump buffer', () => {
  it('jumps on landing when pressed just before touching down', () => {
    const p = createPlayer(0, FLOOR_Y - 30);
    p.vy = 400;
    let jumped = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]).jumped;
    for (let i = 1; i < 14 && !jumped; i++) {
      jumped = stepPlayer(p, input({ jump: true }), [FLOOR]).jumped;
    }
    expect(jumped).toBe(true);
  });

  it('expires when pressed too early', () => {
    const p = createPlayer(0, FLOOR_Y - 222);
    p.vy = 400;
    let jumped = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]).jumped;
    for (let i = 1; i < 60; i++) {
      jumped ||= stepPlayer(p, input({ jump: true }), [FLOOR]).jumped;
    }
    expect(jumped).toBe(false);
    expect(p.onGround).toBe(true);
  });
});
