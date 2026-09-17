import { describe, expect, it } from 'vitest';
import { STEP } from '../../src/core/constants';
import { EMPTY_INPUT } from '../../src/core/input';
import { createEntities } from '../../src/entities/factory';
import { carryStandingPlayer } from '../../src/entities/interactions';
import { SinkingCrateEntity } from '../../src/entities/sinking-crate';
import { WaterWheelEntity } from '../../src/entities/water-wheel';
import { Game } from '../../src/game/game';
import { createPlayer, type Player } from '../../src/physics/player';
import type { StageDef } from '../../src/stages/types';

const crateDef = {
  type: 'sinkingCrate' as const,
  x: 120,
  y: 200,
  w: 100,
  h: 20,
  sinkDistance: 35,
};

const wheelDef = {
  type: 'waterWheel' as const,
  x: 300,
  y: 240,
  radius: 60,
  phase: 0,
  paddleW: 80,
  paddleH: 16,
};

function keepStanding(crate: SinkingCrateEntity, player: Player, frames: number): void {
  for (let frame = 1; frame <= frames; frame += 1) {
    crate.update(frame * STEP, STEP);
    carryStandingPlayer(player, crate.dynamicSolids()[0]);
    crate.collide(player);
  }
}

describe('SinkingCrateEntity', () => {
  it('waits for 0.35 seconds of continuous standing contact before sinking at 70 units per second', () => {
    const crate = new SinkingCrateEntity(crateDef);
    const player = createPlayer(145, crateDef.y - 28);
    crate.collide(player);

    keepStanding(crate, player, 42);
    expect(crate.dynamicSolids()[0].box.y).toBe(crateDef.y);

    keepStanding(crate, player, 1);
    expect(crate.dynamicSolids()[0].box.y).toBeCloseTo(crateDef.y + 70 * STEP, 9);
  });

  it('clamps at its configured sink distance and rises at 50 units per second after contact ends', () => {
    const crate = new SinkingCrateEntity({ ...crateDef, sinkDistance: 14 });
    const player = createPlayer(145, crateDef.y - 28);
    crate.collide(player);

    keepStanding(crate, player, 90);
    expect(crate.dynamicSolids()[0].box.y).toBe(crateDef.y + 14);

    player.x = 400;
    crate.collide(player);
    crate.update(1, STEP);
    expect(crate.dynamicSolids()[0].box.y).toBeCloseTo(crateDef.y + 14 - 50 * STEP, 9);
  });

  it('requires continuous contact and reset immediately restores its start position and timers', () => {
    const crate = new SinkingCrateEntity(crateDef);
    const player = createPlayer(145, crateDef.y - 28);
    crate.collide(player);
    keepStanding(crate, player, 30);

    player.x = 400;
    crate.collide(player);
    crate.update(0.3, STEP);
    player.x = 145;
    player.y = crate.dynamicSolids()[0].box.y - player.h;
    crate.collide(player);
    keepStanding(crate, player, 20);
    expect(crate.dynamicSolids()[0].box.y).toBe(crateDef.y);

    keepStanding(crate, player, 30);
    expect(crate.dynamicSolids()[0].box.y).toBeGreaterThan(crateDef.y);
    crate.reset();
    expect(crate.dynamicSolids()[0]).toEqual({
      box: { x: 120, y: 200, w: 100, h: 20, surface: 'normal' },
      delta: { x: 0, y: 0 },
    });
  });

  it('integrates standing detection after player motion so the game sinks and carries the crate rider', () => {
    const stage: StageDef = {
      id: 1,
      name: 'Crate test',
      theme: { skyTop: '#000', skyBottom: '#000', platform: '#000', edge: '#fff', accent: '#0ff' },
      sections: [{
        id: 0,
        height: 600,
        checkpoint: { x: 140, y: 172 },
        solids: [{ x: 0, y: 560, w: 960, h: 40, surface: 'normal' }],
        entities: [crateDef],
      }],
    };
    const game = new Game('normal', stage);
    const crate = game.activeEntities(0)[0] as SinkingCrateEntity;

    for (let frame = 0; frame < 44; frame += 1) game.step(EMPTY_INPUT, 0);

    expect(crate.dynamicSolids()[0].box.y).toBeGreaterThan(crateDef.y);
    expect(game.player.y + game.player.h).toBeCloseTo(crate.dynamicSolids()[0].box.y, 6);
  });

  it('resets after its section moves outside the active camera range', () => {
    const sections = [0, 1, 2, 3].map((id) => ({
      id,
      height: 600,
      checkpoint: { x: 140, y: 172 },
      solids: [{ x: 0, y: 560, w: 960, h: 40, surface: 'normal' as const }],
      entities: id === 0 ? [crateDef] : [],
    }));
    const stage: StageDef = {
      id: 1,
      name: 'Crate reset test',
      theme: { skyTop: '#000', skyBottom: '#000', platform: '#000', edge: '#fff', accent: '#0ff' },
      sections,
    };
    const game = new Game('normal', stage);
    const crate = game.activeEntities(1800)[0] as SinkingCrateEntity;

    for (let frame = 0; frame < 50; frame += 1) game.step(EMPTY_INPUT, 1800);
    expect(crate.dynamicSolids()[0].box.y).toBeGreaterThan(2000);

    game.step(EMPTY_INPUT, 0);
    expect(crate.dynamicSolids()[0].box.y).toBe(2000);
  });
});

describe('WaterWheelEntity', () => {
  it.each([
    [0, [[260, 172], [320, 232], [260, 292], [200, 232]]],
    [1.25, [[320, 232], [260, 292], [200, 232], [260, 172]]],
    [2.5, [[260, 292], [200, 232], [260, 172], [320, 232]]],
    [3.75, [[200, 232], [260, 172], [320, 232], [260, 292]]],
  ] as const)('places four paddles at the expected quarter-turn positions at t=%s', (time, positions) => {
    const wheel = new WaterWheelEntity(wheelDef);
    wheel.update(time, STEP);

    expect(wheel.dynamicSolids()).toHaveLength(4);
    expect(wheel.dynamicSolids().map(({ box }) => [Math.round(box.x), Math.round(box.y)]))
      .toEqual(positions);
  });

  it('reports deterministic one-frame deltas and carries a player standing on a paddle', () => {
    const wheel = new WaterWheelEntity(wheelDef);
    const startPaddle = wheel.dynamicSolids()[0];
    const player = createPlayer(startPaddle.box.x + 20, startPaddle.box.y - 28);

    wheel.update(STEP, STEP);
    const moved = wheel.dynamicSolids()[0];
    expect(moved.delta.x).toBeCloseTo(moved.box.x - startPaddle.box.x, 9);
    expect(moved.delta.y).toBeCloseTo(moved.box.y - startPaddle.box.y, 9);
    expect(carryStandingPlayer(player, moved)).toBe(true);
    expect(player.x).toBeCloseTo(startPaddle.box.x + 20 + moved.delta.x, 9);
    expect(player.y).toBeCloseTo(startPaddle.box.y - 28 + moved.delta.y, 9);
  });

  it('does not carry a paddle rider into a blocker', () => {
    const wheel = new WaterWheelEntity(wheelDef);
    const start = wheel.dynamicSolids()[0];
    const player = createPlayer(start.box.x + 20, start.box.y - 28);
    wheel.update(STEP, STEP);
    const paddle = wheel.dynamicSolids()[0];
    const blocker = { x: player.x + paddle.delta.x, y: player.y + paddle.delta.y, w: 28, h: 28 };

    expect(carryStandingPlayer(player, paddle, [blocker])).toBe(false);
    expect({ x: player.x, y: player.y }).toEqual({ x: start.box.x + 20, y: start.box.y - 28 });
  });

  it('reports only one-step motion after activation at a large elapsed time and resets to time zero', () => {
    const t = 101.25;
    const uninterrupted = new WaterWheelEntity(wheelDef);
    uninterrupted.update(t - STEP, STEP);
    uninterrupted.update(t, STEP);
    const activated = new WaterWheelEntity(wheelDef);
    activated.update(t, STEP);
    expect(activated.dynamicSolids().map(({ delta }) => delta))
      .toEqual(uninterrupted.dynamicSolids().map(({ delta }) => delta));

    activated.reset();
    expect(activated.dynamicSolids().map(({ delta }) => delta))
      .toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(activated.dynamicSolids()[0].box).toMatchObject({ x: 260, y: 172 });
  });
});

describe('aqueduct entity factory', () => {
  it('constructs sinking crates and water wheels from their discriminated definitions', () => {
    const entities = createEntities([crateDef, wheelDef]);
    expect(entities[0]).toBeInstanceOf(SinkingCrateEntity);
    expect(entities[1]).toBeInstanceOf(WaterWheelEntity);
  });
});
