import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { EMPTY_INPUT } from '../../src/core/input';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from '../../src/entities/entity';
import { WaterEntity } from '../../src/entities/water';
import { Game } from '../../src/game/game';
import type { Player } from '../../src/physics/player';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import type { StageDef } from '../../src/stages/types';
import { input } from '../helpers/input';
import { threeStageTower } from '../helpers/tower';

describe('Game integration', () => {
  it('spawns at the first section checkpoint', () => {
    const game = new Game('normal');
    expect({ x: game.player.x, y: game.player.y }).toEqual(game.world.sections[0].checkpoint);
    expect(game.currentSection).toBe(0);
  });

  it('activates section checkpoints in Normal and ignores them in Hard', () => {
    const normal = new Game('normal');
    normal.warp(1);
    normal.step(EMPTY_INPUT);
    expect(normal.run.checkpoint.globalSection).toBe(1);

    const hard = new Game('hard');
    hard.warp(1);
    hard.step(EMPTY_INPUT);
    expect(hard.run.checkpoint.globalSection).toBe(0);
  });

  it('respawns a Normal player after falling more than one screen below the flag', () => {
    const game = new Game('normal');
    game.player.y = game.run.checkpoint.y + 541;
    game.step(EMPTY_INPUT);
    expect({ x: game.player.x, y: game.player.y }).toEqual({ x: game.run.checkpoint.x, y: game.run.checkpoint.y });
  });

  it('uses Hard knockback for hazards instead of respawning', () => {
    const game = new Game('hard');
    game.player.x = 100;
    const before = game.player.y;
    expect(game.hitHazard(300)).toBe(false);
    expect(game.player.y).toBe(before);
    expect(game.player.vx).toBe(-400);
    expect(game.run.stun).toBe(0.4);
  });

  it('activates only camera sections plus one neighbour', () => {
    const game = new Game('normal');
    const bottom = game.world.sections[0];
    expect(game.activeSectionIds(bottom.top).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('applies mushroom launch collisions', () => {
    const game = new Game('normal');
    const mushroom = game.world.sections[0].entities.find((entity) => entity.type === 'mushroom');
    if (!mushroom || mushroom.type !== 'mushroom') throw new Error('test stage mushroom missing');
    game.player.x = mushroom.x + 10;
    game.player.y = mushroom.y - 24;
    game.player.vy = 200;
    game.step(EMPTY_INPUT, game.world.sections[0].top);
    expect(game.player.vy).toBe(-mushroom.launch);
  });

  it('shows and completes the jump prompt from real player events', () => {
    const game = new Game('normal');
    const trigger = game.world.sections[0].entities.find((entity) => entity.type === 'prompt');
    if (!trigger || trigger.type !== 'prompt') throw new Error('test stage prompt missing');
    game.player.x = trigger.x + 10;
    game.player.y = game.world.sections[0].solids[2].y - game.player.h;
    game.player.onGround = true;
    const result = game.step(input({ jump: true, jumpPressed: true }), game.world.sections[0].top);
    expect(game.prompts.completed.has('jump')).toBe(true);
    expect(result.promptCompleted).toBe('jump');
  });

  it('warps between sections, toggles mode, and supports noclip movement', () => {
    const game = new Game('normal');
    game.warp(99);
    expect(game.currentSection).toBe(game.world.sections.length - 1);
    game.toggleMode();
    expect(game.run.mode).toBe('hard');
    expect(game.currentSection).toBe(0);
    game.toggleNoclip();
    const x = game.player.x;
    game.step(input({ moveX: 1 }));
    expect(game.player.x).toBeGreaterThan(x);
  });

  it('uses the supplied StageDef for deterministic tests and later stages', () => {
    const game = new Game('normal', STAGE_01_MOSS);
    expect(game.world.stage).toBe(STAGE_01_MOSS);
  });
});

describe('cross-stage gameplay', () => {
  it('warps by global section and enters the target stage banner', () => {
    const game = new Game('normal', threeStageTower);
    game.warp(7);
    expect(game.currentStage.id).toBe(2);
    expect(game.world.sections[game.currentSection].localSection).toBe(0);
    expect(game.banner.label()).toEqual({ stage: 2, name: 'Clockwork Hall' });
    expect(game.banner).toMatchObject({ stageNumber: 2, stageName: 'Clockwork Hall', elapsed: 0 });
  });

  it('enters a banner only when crossing stages, including downward movement', () => {
    const game = new Game('hard', threeStageTower);
    game.noclip = true;
    game.warp(6);
    game.banner.update(1);
    game.player.y = game.world.sections[7].checkpoint.y;
    game.step(EMPTY_INPUT);
    expect(game.banner).toMatchObject({ stageNumber: 2, elapsed: 0 });
    game.step(EMPTY_INPUT);
    expect(game.banner.elapsed).toBeGreaterThan(0);
    const elapsed = game.banner.elapsed;
    game.warp(8);
    expect(game.banner.elapsed).toBe(elapsed);
    game.player.y = game.world.sections[6].checkpoint.y;
    game.step(EMPTY_INPUT);
    expect(game.currentStage.id).toBe(1);
    expect(game.banner).toMatchObject({ stageNumber: 1, elapsed: 0 });
  });

  it('activates and respawns at a global checkpoint even when local ids repeat', () => {
    const game = new Game('normal', threeStageTower);
    game.warp(6);
    game.step(EMPTY_INPUT);
    game.warp(10);
    expect(game.step(EMPTY_INPUT).checkpointActivated).toBe(true);
    expect(game.run.checkpoint).toMatchObject({ globalSection: 10, stageId: 2, localSection: 3 });
    game.warp(14);
    game.respawn();
    expect(game.currentSection).toBe(10);
    expect(game.currentStage.id).toBe(2);
    expect(game.banner.stageNumber).toBe(2);
    game.toggleMode();
    expect(game.currentSection).toBe(0);
    expect(game.banner.stageNumber).toBe(1);
  });

  it('activates only global neighbours without duplicating matching local ids', () => {
    const game = new Game('hard', threeStageTower);
    const cameraY = game.world.sections[7].top;
    expect(game.activeSectionIds(cameraY)).toEqual([6, 7, 8]);
    expect(game.activeEntities(cameraY)).toHaveLength(3);
  });
});

const interactionStage: StageDef = {
  id: 99,
  name: 'Interaction Test',
  theme: STAGE_01_MOSS.theme,
  sections: [{ id: 0, height: 600, checkpoint: { x: 300, y: 500 }, solids: [], entities: [] }],
};

function installEntity(game: Game, entity: Entity): void {
  installEntities(game, [entity]);
}

function installEntities(game: Game, entities: Entity[]): void {
  (game as unknown as { entitiesBySection: Entity[][] }).entitiesBySection[0] = entities;
}

function testEntity(options: {
  bounds?: () => { x: number; y: number; w: number; h: number };
  update?: (t: number, dt: number) => void;
  dynamicSolids?: () => readonly DynamicSolid[];
  field?: (player: Player) => FieldEffect | null;
  collide?: (player: Player) => EntityContact;
}): Entity {
  return {
    bounds: options.bounds ?? (() => ({ x: 0, y: 0, w: 0, h: 0 })),
    update: options.update ?? (() => {}),
    dynamicSolids: options.dynamicSolids ?? (() => []),
    field: options.field ?? (() => null),
    collide: options.collide ?? (() => ({ kind: 'none' })),
    draw: () => {},
    reset: () => {},
  };
}

describe('Game entity interaction pipeline', () => {
  it('updates a dynamic solid before carrying and stepping a standing player', () => {
    const game = new Game('hard', interactionStage);
    let delta = { x: 0, y: 0 };
    installEntity(game, testEntity({
      update: () => { delta = { x: 3, y: 0 }; },
      dynamicSolids: () => [{ box: { x: 103, y: 200, w: 120, h: 20 }, delta }],
    }));
    Object.assign(game.player, { x: 130, y: 172, onGround: true });

    game.step(EMPTY_INPUT, 0);

    expect(game.player.x).toBe(133);
    expect(game.player.y).toBe(172);
  });

  it('samples water after platform carry so crossing into water is immediate', () => {
    const game = new Game('hard', interactionStage);
    const platform = testEntity({
      dynamicSolids: () => [{ box: { x: 100, y: 200, w: 120, h: 20 }, delta: { x: 20, y: 0 } }],
    });
    const water = new WaterEntity({
      type: 'water', x: 110, y: 140, w: 200, h: 100, currentX: 0, currentY: 0,
    });
    installEntities(game, [platform, water]);
    Object.assign(game.player, { x: 80, y: 172, onGround: true });

    game.step(EMPTY_INPUT, 0);

    expect(game.player.x).toBe(100);
    expect(game.player.wasSubmerged).toBe(true);
  });

  it('samples water after platform carry so exiting caps velocity immediately', () => {
    const game = new Game('hard', interactionStage);
    const platform = testEntity({
      dynamicSolids: () => [{ box: { x: 100, y: 200, w: 120, h: 20 }, delta: { x: 20, y: 0 } }],
    });
    const water = new WaterEntity({
      type: 'water', x: 0, y: 140, w: 110, h: 100, currentX: 0, currentY: 0,
    });
    installEntities(game, [platform, water]);
    Object.assign(game.player, {
      x: 90, y: 172, vx: 1_000, vy: 0, onGround: true, wasSubmerged: true,
    });

    game.step(EMPTY_INPUT, 0);

    expect(game.player.wasSubmerged).toBe(false);
    expect(game.player.vx).toBe(C.RUN_SPEED - C.GROUND_DECEL * C.STEP);
  });

  it('includes active dynamic boxes in real player collision resolution', () => {
    const game = new Game('hard', interactionStage);
    installEntity(game, testEntity({
      bounds: () => ({ x: 160, y: 100, w: 20, h: 200 }),
      dynamicSolids: () => [{ box: { x: 160, y: 100, w: 20, h: 200 }, delta: { x: 0, y: 0 } }],
    }));
    Object.assign(game.player, { x: 130, y: 120, vx: 600, vy: 0, onGround: false });

    game.step(input({ moveX: 1 }), 0);

    expect(game.player.x).toBe(132);
  });

  it('routes an impossible push-out through Normal hazard respawn handling', () => {
    const stage: StageDef = {
      ...interactionStage,
      sections: [{
        ...interactionStage.sections[0],
        solids: [
          { x: 70, y: 90, w: 36, h: 60, surface: 'normal' },
          { x: 134, y: 90, w: 36, h: 60, surface: 'normal' },
          { x: 90, y: 70, w: 60, h: 36, surface: 'normal' },
          { x: 90, y: 134, w: 60, h: 36, surface: 'normal' },
        ],
      }],
    };
    const game = new Game('normal', stage);
    const obstacle = { x: 100, y: 100, w: 40, h: 40 };
    installEntity(game, testEntity({
      bounds: () => obstacle,
      collide: () => ({ kind: 'push', dx: 4, dy: 0 }),
    }));
    Object.assign(game.player, { x: 106, y: 106, onGround: false });

    const result = game.step(EMPTY_INPUT, 0);

    expect(result.respawned).toBe(true);
    expect(game.run.falls).toBe(1);
    expect({ x: game.player.x, y: game.player.y }).toEqual(stage.sections[0].checkpoint);
  });

  it('resolves dynamic-solid penetration before entity contacts', () => {
    const game = new Game('hard', interactionStage);
    const obstacle = { x: 100, y: 100, w: 40, h: 40 };
    let contactedAt: { x: number; y: number } | null = null;
    installEntity(game, testEntity({
      bounds: () => obstacle,
      dynamicSolids: () => [{ box: obstacle, delta: { x: 0, y: 0 } }],
      collide: (player) => {
        contactedAt = { x: player.x, y: player.y };
        return { kind: 'none' };
      },
    }));
    Object.assign(game.player, { x: 106, y: 106, dashTimer: 1, vx: 0, vy: 0, onGround: false });

    game.step(EMPTY_INPUT, 0);

    expect(contactedAt).toEqual({ x: 72, y: 106 });
  });
});
