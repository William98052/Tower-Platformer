import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import type { SolidDef } from '../../src/stages/types';
import { input } from '../helpers/input';

const BELT_Y = 100;

function belt(surface: 'conveyorLeft' | 'conveyorRight', conveyorSpeed: number): SolidDef {
  return { x: -1000, y: BELT_Y, w: 3000, h: 40, surface, conveyorSpeed };
}

function groundedOn(solid: SolidDef) {
  const player = createPlayer(0, BELT_Y - C.PLAYER_SIZE);
  stepPlayer(player, input(), [solid]);
  expect(player.onGround).toBe(true);
  return player;
}

describe('conveyor surfaces', () => {
  it('adds the configured rightward belt speed to grounded displacement', () => {
    const solid = belt('conveyorRight', 90);
    const player = groundedOn(solid);
    const startX = player.x;

    stepPlayer(player, input(), [solid]);

    expect(player.x - startX).toBeCloseTo(90 * C.STEP, 9);
    expect(player.vx).toBe(0);
  });

  it('preserves running acceleration and speed limits relative to the belt', () => {
    const solid = belt('conveyorRight', 90);
    const player = groundedOn(solid);
    for (let i = 0; i < 60; i++) stepPlayer(player, input({ moveX: -1 }), [solid]);
    const startX = player.x;

    stepPlayer(player, input({ moveX: -1 }), [solid]);

    expect(player.vx).toBe(-C.RUN_SPEED);
    expect(player.x - startX).toBeCloseTo((-C.RUN_SPEED + 90) * C.STEP, 9);
  });

  it('does not apply belt speed while the player is airborne', () => {
    const solid = belt('conveyorRight', 90);
    const player = createPlayer(0, 0);

    stepPlayer(player, input(), [solid]);

    expect(player.x).toBe(0);
  });

  it('uses each solid definition\'s speed and direction', () => {
    const solid = belt('conveyorLeft', 160);
    const player = groundedOn(solid);
    const startX = player.x;

    stepPlayer(player, input(), [solid]);

    expect(player.x - startX).toBeCloseTo(-160 * C.STEP, 9);
  });
});
