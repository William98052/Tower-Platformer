import { describe, expect, it } from 'vitest';
import { createEntities } from '../../src/entities/factory';
import { resolveFieldEffects } from '../../src/entities/interactions';
import { WaterEntity } from '../../src/entities/water';
import { createPlayer } from '../../src/physics/player';

describe('WaterEntity', () => {
  const definition = {
    type: 'water' as const,
    x: 0,
    y: 100,
    w: 500,
    h: 300,
    currentX: 260,
    currentY: -100,
  };

  it('exposes water and current effects only while the player overlaps its volume', () => {
    const field = new WaterEntity(definition);
    const submergedPlayer = createPlayer(40, 120);
    const dryPlayer = createPlayer(40, 50);

    expect(field.field(submergedPlayer)).toEqual({
      accelerationX: 260,
      accelerationY: -100,
      water: {
        gravityScale: 0.45,
        maxFall: 220,
        dragPerStep: 0.96,
        strokeSpeed: 420,
        strokeCooldown: 0.22,
      },
    });
    expect(field.field(dryPlayer)).toBeNull();
  });

  it('is created by the entity factory without becoming a solid or contact hazard', () => {
    const player = createPlayer(40, 120);
    const [water] = createEntities([definition]);

    expect(water).toBeInstanceOf(WaterEntity);
    expect(water.bounds()).toEqual({ x: 0, y: 100, w: 500, h: 300 });
    expect(water.dynamicSolids()).toEqual([]);
    expect(water.collide(player)).toEqual({ kind: 'none' });
  });

  it('sums overlapping currents and clamps each axis to 420', () => {
    const player = createPlayer(40, 120);
    const first = new WaterEntity({ ...definition, currentX: 300, currentY: -300 });
    const second = new WaterEntity({ ...definition, currentX: 250, currentY: -250 });

    const aggregate = resolveFieldEffects([first.field(player)!, second.field(player)!]);

    expect(aggregate).toMatchObject({ accelerationX: 420, accelerationY: -420 });
  });

  it('clamps mixed-sign overlapping currents after summing them', () => {
    const player = createPlayer(40, 120);
    const first = new WaterEntity({ ...definition, currentX: 420, currentY: 420 });
    const second = new WaterEntity({ ...definition, currentX: -180, currentY: -100 });

    expect(resolveFieldEffects([first.field(player)!, second.field(player)!])).toMatchObject({
      accelerationX: 240,
      accelerationY: 320,
    });
  });
});
