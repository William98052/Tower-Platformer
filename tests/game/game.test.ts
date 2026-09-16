import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../../src/core/input';
import { Game } from '../../src/game/game';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { input } from '../helpers/input';

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
    expect(normal.run.checkpoint.section).toBe(1);

    const hard = new Game('hard');
    hard.warp(1);
    hard.step(EMPTY_INPUT);
    expect(hard.run.checkpoint.section).toBe(0);
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
    expect(game.currentSection).toBe(6);
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
