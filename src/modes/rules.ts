import type { Player } from '../physics/player';
import type { Point } from '../stages/types';
import type { Mode, RunState } from './run-state';

export const NORMAL_FALL_LIMIT = 540;
export const HARD_KNOCKBACK_X = 400;
export const HARD_KNOCKBACK_Y = 300;
export const HARD_STUN = 0.4;
export const HARD_INVULNERABILITY = 0.6;

export function createRunState(mode: Mode, spawn: Point, globalSection: number, stageId = 1, localSection = globalSection): RunState {
  return {
    mode,
    checkpoint: { ...spawn, globalSection, stageId, localSection },
    falls: 0,
    elapsed: 0,
    bestY: spawn.y,
    peakSinceLanding: spawn.y,
    stun: 0,
    invulnerability: 0,
  };
}

export function stepRunTimers(run: RunState, dt: number): void {
  run.elapsed += Math.max(0, dt);
  run.stun = Math.max(0, run.stun - dt);
  run.invulnerability = Math.max(0, run.invulnerability - dt);
}

export function activateCheckpoint(run: RunState, point: Point, globalSection: number, stageId = 1, localSection = globalSection): boolean {
  if (run.mode !== 'normal' || globalSection < run.checkpoint.globalSection) return false;
  const changed = globalSection !== run.checkpoint.globalSection
    || stageId !== run.checkpoint.stageId
    || localSection !== run.checkpoint.localSection
    || point.x !== run.checkpoint.x
    || point.y !== run.checkpoint.y;
  run.checkpoint = { ...point, globalSection, stageId, localSection };
  return changed;
}

export function shouldRespawnForFall(run: RunState, playerY: number): boolean {
  return run.mode === 'normal' && playerY > run.checkpoint.y + NORMAL_FALL_LIMIT;
}

export function hitHazard(
  run: RunState,
  player: Player,
  hazardCenterX: number,
): { respawn: boolean; hit: boolean } {
  if (run.mode === 'hard' && run.invulnerability > 0) return { respawn: false, hit: false };
  run.falls += 1;
  if (run.mode === 'normal') return { respawn: true, hit: true };
  const playerCenter = player.x + player.w / 2;
  player.vx = playerCenter < hazardCenterX ? -HARD_KNOCKBACK_X : HARD_KNOCKBACK_X;
  player.vy = -HARD_KNOCKBACK_Y;
  player.onGround = false;
  run.stun = HARD_STUN;
  run.invulnerability = HARD_INVULNERABILITY;
  return { respawn: false, hit: true };
}

export function trackHeight(run: RunState, playerY: number): void {
  run.bestY = Math.min(run.bestY, playerY);
  run.peakSinceLanding = Math.min(run.peakSinceLanding, playerY);
}

export function recordLanding(run: RunState, playerY: number): boolean {
  const counted = playerY - run.peakSinceLanding >= 400;
  if (counted) run.falls += 1;
  run.peakSinceLanding = playerY;
  return counted;
}
