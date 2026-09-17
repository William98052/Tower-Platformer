import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/physics/player';
import {
  activateCheckpoint,
  createRunState,
  hitHazard,
  recordLanding,
  shouldRespawnForFall,
  stepRunTimers,
  trackHeight,
} from '../../src/modes/rules';

describe('Normal rules', () => {
  it('activates checkpoints and respawns after falling one screen below', () => {
    const run = createRunState('normal', { x: 20, y: 1000 }, 0);
    activateCheckpoint(run, { x: 80, y: 600 }, 2);
    expect(run.checkpoint).toEqual({ x: 80, y: 600, globalSection: 2, stageId: 1, localSection: 2 });
    expect(shouldRespawnForFall(run, 1140)).toBe(false);
    expect(shouldRespawnForFall(run, 1141)).toBe(true);
  });

  it('turns a hazard hit into a respawn and counts a fall', () => {
    const run = createRunState('normal', { x: 20, y: 1000 }, 0);
    const player = createPlayer(100, 100);
    expect(hitHazard(run, player, 50)).toEqual({ respawn: true, hit: true });
    expect(run.falls).toBe(1);
  });
});

describe('Hard rules', () => {
  it('ignores checkpoints', () => {
    const run = createRunState('hard', { x: 20, y: 1000 }, 0);
    activateCheckpoint(run, { x: 80, y: 600 }, 2);
    expect(run.checkpoint).toEqual({ x: 20, y: 1000, globalSection: 0, stageId: 1, localSection: 0 });
  });

  it('applies knockback, stun and invulnerability', () => {
    const run = createRunState('hard', { x: 20, y: 1000 }, 0);
    const player = createPlayer(100, 100);
    expect(hitHazard(run, player, 200)).toEqual({ respawn: false, hit: true });
    expect(player.vx).toBe(-400);
    expect(player.vy).toBe(-300);
    expect(run.stun).toBe(0.4);
    expect(run.invulnerability).toBe(0.6);
    expect(run.falls).toBe(1);
  });

  it('ignores repeat hits during invulnerability', () => {
    const run = createRunState('hard', { x: 20, y: 1000 }, 0);
    const player = createPlayer(100, 100);
    hitHazard(run, player, 200);
    expect(hitHazard(run, player, 0)).toEqual({ respawn: false, hit: false });
    expect(run.falls).toBe(1);
  });
});

describe('shared stats', () => {
  it('orders checkpoints globally and preserves their stage and local identities', () => {
    const run = createRunState('normal', { x: 20, y: 1000 }, 6, 1, 6);
    expect(activateCheckpoint(run, { x: 80, y: 600 }, 10, 2, 3)).toBe(true);
    expect(run.checkpoint).toEqual({ x: 80, y: 600, globalSection: 10, stageId: 2, localSection: 3 });
    expect(activateCheckpoint(run, { x: 90, y: 800 }, 6, 1, 6)).toBe(false);
    expect(run.checkpoint.globalSection).toBe(10);
    expect(activateCheckpoint(run, { x: 80, y: 600 }, 10, 2, 3)).toBe(false);
  });
  it('treats checkpoint identity changes as activation changes', () => {
    const run = createRunState('normal', { x: 20, y: 1000 }, 6, 1, 6);
    expect(activateCheckpoint(run, { x: 20, y: 1000 }, 6, 2, 0)).toBe(true);
    expect(run.checkpoint).toMatchObject({ globalSection: 6, stageId: 2, localSection: 0 });
  });
  it('advances gameplay time and countdown timers', () => {
    const run = createRunState('hard', { x: 0, y: 1000 }, 0);
    run.stun = 0.4;
    run.invulnerability = 0.6;
    stepRunTimers(run, 0.25);
    expect(run.elapsed).toBe(0.25);
    expect(run.stun).toBeCloseTo(0.15);
    expect(run.invulnerability).toBeCloseTo(0.35);
  });

  it('tracks best height and counts a 400-unit fall once on landing', () => {
    const run = createRunState('normal', { x: 0, y: 1000 }, 0);
    trackHeight(run, 500);
    trackHeight(run, 905);
    expect(run.bestY).toBe(500);
    recordLanding(run, 905);
    expect(run.falls).toBe(1);
    recordLanding(run, 905);
    expect(run.falls).toBe(1);
  });
});
