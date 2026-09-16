import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/game';
import {
  validateRunSaveV2,
  type HardRunSave,
  type HardRunSaveV2,
  type NormalRunSaveV2,
} from '../../src/game/run-snapshot';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { showPrompt } from '../../src/ui/prompts';

describe('Game run snapshots', () => {
  it('snapshots and restores a Normal run at its lit checkpoint', () => {
    const game = new Game('normal');
    const checkpoint = game.world.sections[2].checkpoint;
    game.run.checkpoint = { ...checkpoint, section: 2 };
    game.run.elapsed = 12.5;
    game.run.falls = 3;
    game.run.bestY = checkpoint.y - 200;

    const snapshot = game.snapshot();
    expect(snapshot).toEqual({ kind: 'normal', stageId: 1, section: 2, elapsed: 12.5, falls: 3, bestY: checkpoint.y - 200 });

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
    const base: HardRunSave = {
      kind: 'hard', stageId: 1, section: 0,
      x: 100, y: 4820, vx: 0, vy: 0,
      elapsed: 1, falls: 0, bestY: 4820,
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
