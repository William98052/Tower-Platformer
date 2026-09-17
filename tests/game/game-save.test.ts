import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/game';
import {
  validateRunSaveV2,
  type HardRunSaveV2,
  type NormalRunSaveV2,
} from '../../src/game/run-snapshot';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { showPrompt } from '../../src/ui/prompts';
import { EMPTY_INPUT } from '../../src/core/input';
import { threeStageTower } from '../helpers/tower';

describe('Game run snapshots', () => {
  it('snapshots and restores a Normal run at its lit checkpoint', () => {
    const game = new Game('normal');
    const checkpoint = game.world.sections[2].checkpoint;
    game.run.checkpoint = { ...checkpoint, globalSection: 2, stageId: 1, localSection: 2 };
    game.run.elapsed = 12.5;
    game.run.falls = 3;
    game.run.bestY = checkpoint.y - 200;

    const snapshot = game.snapshot();
    expect(snapshot).toEqual({
      kind: 'normal', stageId: 1, localSection: 2,
      elapsed: 12.5, falls: 3, bestHeight: game.world.height - checkpoint.y + 200,
    });

    const restored = Game.restore(STAGE_01_MOSS, snapshot, []);
    expect(restored).not.toBeNull();
    expect(restored?.currentSection).toBe(2);
    expect(restored?.player).toMatchObject({ x: checkpoint.x, y: checkpoint.y });
    expect(restored?.run).toMatchObject({ elapsed: 12.5, falls: 3, bestY: checkpoint.y - 200 });
  });

  it('snapshots and restores an exact valid Hard position and velocity', () => {
    const game = new Game('hard');
    game.player.x = 100;
    game.player.y = game.world.sections[0].checkpoint.y;
    game.player.vx = 50;
    game.player.vy = -20;
    game.run.elapsed = 42.5;
    game.run.falls = 2;

    const snapshot = game.snapshot();
    expect(snapshot).toMatchObject({ kind: 'hard', stageId: 1, x: 100, vx: 50, vy: -20, elapsed: 42.5, falls: 2 });

    const restored = Game.restore(STAGE_01_MOSS, snapshot, []);
    expect(restored?.player).toMatchObject({ x: 100, y: game.player.y, vx: 50, vy: -20 });
    expect(restored?.run).toMatchObject({ mode: 'hard', elapsed: 42.5, falls: 2 });
  });

  it('rejects Hard restores outside the world, inside a solid, or for another stage', () => {
    const base: HardRunSaveV2 = {
      kind: 'hard', stageId: 1, localSection: 0,
      x: 100, stageY: 80, vx: 0, vy: 0,
      elapsed: 1, falls: 0, bestHeight: 80,
    };
    expect(Game.restore(STAGE_01_MOSS, { ...base, x: -1 }, [])).toBeNull();
    expect(Game.restore(STAGE_01_MOSS, { ...base, x: 0 }, [])).toBeNull();
    expect(Game.restore(STAGE_01_MOSS, { ...base, stageId: 2 }, [])).toBeNull();
  });

  it('restores completed prompts in stable route order', () => {
    const game = new Game('normal', STAGE_01_MOSS, ['dash', 'jump']);
    expect(game.completedPrompts()).toEqual(['jump', 'dash']);
    expect(showPrompt(game.prompts, 'jump')).toBe(false);
    expect(showPrompt(game.prompts, 'wallJump')).toBe(true);
  });
});

describe('version 2 run snapshot validation', () => {
  it('accepts a complete stage-relative Hard snapshot and rejects a non-finite stage position', () => {
    const hard: HardRunSaveV2 = {
      kind: 'hard', stageId: 2, localSection: 4,
      x: 440, stageY: 2100, vx: 80, vy: -30,
      elapsed: 90, falls: 3, bestHeight: 6300,
    };

    expect(validateRunSaveV2(hard, 'hard')).toEqual(hard);
    expect(validateRunSaveV2({ ...hard, stageY: Number.NaN }, 'hard')).toBeNull();
  });

  it('accepts only complete, finite Normal snapshots with a valid location', () => {
    const normal: NormalRunSaveV2 = {
      kind: 'normal', stageId: 1, localSection: 3,
      elapsed: 42.5, falls: 2, bestHeight: 3300,
    };

    expect(validateRunSaveV2(normal, 'normal')).toEqual(normal);
    expect(validateRunSaveV2({ ...normal, localSection: -1 }, 'normal')).toBeNull();
    expect(validateRunSaveV2({ ...normal, bestHeight: -1 }, 'normal')).toBeNull();
  });
});

describe('cross-stage saves', () => {
  it.each(['normal', 'hard'] as const)('restores %s location, elapsed phase, and floor-relative best height', (mode) => {
    const game = new Game(mode, threeStageTower);
    game.warp(10);
    game.step(EMPTY_INPUT);
    game.player.y = 6500;
    game.player.vx = 50;
    game.player.vy = -20;
    game.run.elapsed = 42.5;
    game.run.falls = 3;
    game.run.bestY = 6300;
    // Normal must save its checkpoint stage even if the player moves elsewhere.
    if (mode === 'normal') game.warp(14);
    const snapshot = game.snapshot();
    expect(snapshot).toMatchObject({ kind: mode, stageId: 2, localSection: 3, elapsed: 42.5, falls: 3, bestHeight: 6300 });
    if (snapshot.kind === 'hard') expect(snapshot).toMatchObject({ stageY: 1900, x: 100, vx: 50, vy: -20 });

    const restored = Game.restore(threeStageTower, snapshot, ['jump']);
    expect(restored?.currentSection).toBe(10);
    expect(restored?.currentStage.id).toBe(2);
    expect(restored?.banner.stageNumber).toBe(2);
    expect(restored?.player.y).toBe(6500);
    expect(restored?.time).toBe(42.5);
    expect(restored?.run).toMatchObject({ elapsed: 42.5, falls: 3, bestY: 6300 });
    if (mode === 'normal') expect(restored?.run.checkpoint).toMatchObject({ globalSection: 10, stageId: 2, localSection: 3 });
    expect(restored?.snapshot()).toEqual(snapshot);
    restored!.step(EMPTY_INPUT);
    expect(restored!.time).toBe(restored!.run.elapsed);
  });

  it('keeps Hard stage-relative position and height when stages are added above a save', () => {
    const shortTower = { stages: threeStageTower.stages.slice(0, 2) };
    const snapshot: HardRunSaveV2 = {
      kind: 'hard', stageId: 2, localSection: 3, x: 100, stageY: 1900,
      vx: 50, vy: -20, elapsed: 42.5, falls: 3, bestHeight: 6300,
    };
    expect(Game.restore(shortTower, snapshot, [])?.player.y).toBe(2300);
    expect(Game.restore(threeStageTower, snapshot, [])?.player.y).toBe(6500);
    expect(Game.restore(threeStageTower, snapshot, [])?.snapshot()).toEqual(snapshot);
    expect(Game.restore(threeStageTower, { ...snapshot, localSection: 2 }, [])).toBeNull();
    expect(Game.restore(threeStageTower, { ...snapshot, stageId: 4 }, [])).toBeNull();
  });
});
