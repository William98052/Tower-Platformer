import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import type { FieldEffect } from '../../src/entities/entity';
import { createPlayer, resolvePlayerEnvironment, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const WATER: FieldEffect = {
  accelerationX: 0,
  accelerationY: 0,
  water: {
    gravityScale: 0.45,
    maxFall: 220,
    dragPerStep: 0.96,
    strokeSpeed: 420,
    strokeCooldown: 0.22,
  },
};

describe('water movement', () => {
  it('resolves dry defaults without changing ordinary player limits', () => {
    expect(resolvePlayerEnvironment(null)).toEqual({
      gravityScale: 1,
      maxFall: C.MAX_FALL,
      dragPerStep: 1,
      strokeSpeed: 0,
      strokeCooldown: 0,
      accelerationX: 0,
      accelerationY: 0,
    });
  });

  it('uses exactly 45% gravity and a 220 downward-speed cap while submerged', () => {
    const dry = createPlayer(0, 0);
    const wet = createPlayer(0, 0);

    stepPlayer(dry, input(), []);
    stepPlayer(wet, input(), [], C.STEP, WATER);

    expect(dry.vy).toBe(C.GRAVITY * C.STEP);
    expect(wet.vy).toBe(C.GRAVITY * 0.45 * C.STEP);

    wet.vy = 219;
    stepPlayer(wet, input(), [], C.STEP, WATER);
    expect(wet.vy).toBe(220);
  });

  it('applies 0.96 drag to prior velocity before swim control and current acceleration', () => {
    const wet = createPlayer(0, 0);
    wet.vx = C.RUN_SPEED;

    stepPlayer(wet, input(), [], C.STEP, { ...WATER, accelerationX: 120 });

    expect(wet.vx).toBeCloseTo(
      C.RUN_SPEED * 0.96 - C.AIR_ACCEL * C.STEP + 120 * C.STEP,
      9,
    );
  });

  it('does not damp same-frame swim control acceleration from rest', () => {
    const wet = createPlayer(0, 0);

    stepPlayer(wet, input({ moveX: 1 }), [], C.STEP, WATER);

    expect(wet.vx).toBe(C.AIR_ACCEL * C.STEP);
    expect(wet.vx).not.toBe(C.AIR_ACCEL * C.STEP * 0.96);
  });

  it('can sustain normal run speed while swimming with held movement', () => {
    const wet = createPlayer(0, 0);

    for (let step = 0; step < 240; step++) {
      stepPlayer(wet, input({ moveX: 1 }), [], C.STEP, WATER);
    }

    expect(wet.vx).toBe(C.RUN_SPEED);
  });

  it.each([
    [100, -420],
    [-500, -500],
  ])('a fresh stroke changes vy %s to %s', (initialVy, expectedVy) => {
    const player = createPlayer(0, 0);
    player.vy = initialVy;

    stepPlayer(player, input({ jump: true, jumpPressed: true }), [], C.STEP, WATER);

    expect(player.vy).toBe(expectedVy);
    expect(player.jumpBuffer).toBe(0);
  });

  it('holding Jump for 60 steps creates only one stroke', () => {
    const player = createPlayer(0, 0);
    stepPlayer(player, input({ jump: true, jumpPressed: true }), [], C.STEP, WATER);

    for (let step = 1; step < 60; step++) {
      stepPlayer(player, input({ jump: true }), [], C.STEP, WATER);
    }

    expect(player.vy).toBeGreaterThan(-420);
    expect(player.strokeCooldown).toBe(0);
  });

  it('requires the 0.22-second cooldown before a released and re-pressed stroke', () => {
    const player = createPlayer(0, 0);
    stepPlayer(player, input({ jump: true, jumpPressed: true }), [], C.STEP, WATER);
    for (let step = 0; step < 10; step++) stepPlayer(player, input(), [], C.STEP, WATER);
    const beforeEarlyPress = player.vy;

    stepPlayer(player, input({ jump: true, jumpPressed: true }), [], C.STEP, WATER);
    expect(player.vy).toBeGreaterThan(beforeEarlyPress);

    const remainingSteps = Math.ceil(0.22 / C.STEP);
    for (let step = 0; step < remainingSteps; step++) stepPlayer(player, input(), [], C.STEP, WATER);
    stepPlayer(player, input({ jump: true, jumpPressed: true }), [], C.STEP, WATER);
    expect(player.vy).toBe(-420);
  });

  it('preserves water-exit momentum while capping it to normal movement limits', () => {
    const player = createPlayer(0, 0);
    player.vx = 2_000;
    player.vy = 2_000;
    stepPlayer(player, input(), [], C.STEP, WATER);
    expect(player.vy).toBe(220);

    stepPlayer(player, input(), []);

    expect(player.vx).toBeGreaterThan(0);
    expect(player.vx).toBeLessThanOrEqual(C.RUN_SPEED);
    expect(player.vy).toBeGreaterThan(220);
    expect(player.vy).toBeLessThanOrEqual(C.MAX_FALL);
  });

  it('does not carry a wet jump press into a dry coyote jump', () => {
    const player = createPlayer(0, 0);
    player.coyote = C.COYOTE_TIME;
    stepPlayer(player, input({ jump: true, jumpPressed: true }), [], C.STEP, WATER);
    const exitVy = player.vy;

    const events = stepPlayer(player, input({ jump: true }), []);

    expect(events.jumped).toBe(false);
    expect(player.vy).toBeGreaterThan(exitVy);
  });

  it('clears a dry jump buffer on water entry instead of firing it after exit', () => {
    const player = createPlayer(0, 0);
    player.jumpBuffer = C.JUMP_BUFFER;
    player.coyote = C.COYOTE_TIME;

    stepPlayer(player, input(), [], C.STEP, WATER);
    expect(player.jumpBuffer).toBe(0);

    const events = stepPlayer(player, input({ jump: true }), []);
    expect(events.jumped).toBe(false);
  });
});
