import { describe, expect, it } from 'vitest';
import type { DynamicSolid, FieldEffect } from '../../src/entities/entity';
import { carryStandingPlayer, resolveFieldEffects } from '../../src/entities/interactions';
import { createPlayer } from '../../src/physics/player';

function movingSolid(dx: number, dy: number): DynamicSolid {
  return {
    box: { x: 100, y: 200, w: 120, h: 20, surface: 'normal' },
    delta: { x: dx, y: dy },
  };
}

describe('carryStandingPlayer', () => {
  it('carries a standing player by the solid horizontal and vertical displacement', () => {
    const player = createPlayer(130, 172);

    expect(carryStandingPlayer(player, movingSolid(3, -2))).toBe(true);
    expect({ x: player.x, y: player.y }).toEqual({ x: 133, y: 170 });
  });

  it('does not carry a player who is not standing on the solid', () => {
    const player = createPlayer(130, 168);

    expect(carryStandingPlayer(player, movingSolid(3, -2))).toBe(false);
    expect({ x: player.x, y: player.y }).toEqual({ x: 130, y: 168 });
  });

  it('does not move a standing player into a blocking solid', () => {
    const player = createPlayer(130, 172);
    const wall = { x: 159, y: 150, w: 20, h: 50 };

    expect(carryStandingPlayer(player, movingSolid(3, 0), [wall])).toBe(false);
    expect({ x: player.x, y: player.y }).toEqual({ x: 130, y: 172 });
  });
});

describe('resolveFieldEffects', () => {
  it('sums current acceleration and applies the strongest water reductions once', () => {
    const first: FieldEffect = {
      accelerationX: 180,
      accelerationY: -40,
      water: { gravityScale: 0.45, maxFall: 220, dragPerStep: 0.96, strokeSpeed: 420, strokeCooldown: 0.22 },
    };
    const second: FieldEffect = {
      accelerationX: -50,
      accelerationY: 120,
      water: { gravityScale: 0.6, maxFall: 260, dragPerStep: 0.98, strokeSpeed: 380, strokeCooldown: 0.3 },
    };

    expect(resolveFieldEffects([first, second])).toEqual({
      accelerationX: 130,
      accelerationY: 80,
      water: { gravityScale: 0.45, maxFall: 220, dragPerStep: 0.96, strokeSpeed: 420, strokeCooldown: 0.22 },
    });
  });

  it('returns a dry aggregate for current-only fields and null for no fields', () => {
    expect(resolveFieldEffects([{ accelerationX: 20, accelerationY: -30 }])).toEqual({
      accelerationX: 20,
      accelerationY: -30,
    });
    expect(resolveFieldEffects([])).toBeNull();
  });
});
