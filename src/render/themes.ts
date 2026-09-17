import type { CollisionSolid } from '../physics/collision';
import type { StageDef, World } from '../stages/types';

export interface ThemeBlend {
  lower: StageDef;
  upper: StageDef;
  mix: number;
}

export interface ThemeRenderer {
  drawBackground(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    t: number,
    effectsScale: number,
  ): void;
  drawSolids(
    ctx: CanvasRenderingContext2D,
    solids: readonly CollisionSolid[],
    camX: number,
    camY: number,
    glowScale: number,
  ): void;
}

const TRANSITION_HEIGHT = 600;

/** Returns the stage pair visible at a world-space camera sample. */
export function themeBlendAt(world: World, cameraY: number): ThemeBlend {
  const stages = world.tower.stages;
  if (stages.length === 0) throw new RangeError('world has no stages');

  const ranges = stages.map((stage) => {
    const sections = world.sections.filter((section) => section.stageId === stage.id);
    return {
      stage,
      top: Math.min(...sections.map((section) => section.top)),
      bottom: Math.max(...sections.map((section) => section.bottom)),
    };
  });

  let index = ranges.findIndex((range) => cameraY >= range.top && cameraY < range.bottom);
  if (index < 0) index = cameraY < ranges[ranges.length - 1].top ? ranges.length - 1 : 0;
  const current = ranges[index];
  const upper = ranges[index + 1];
  if (upper && cameraY <= current.top + TRANSITION_HEIGHT) {
    return {
      lower: current.stage,
      upper: upper.stage,
      mix: clamp01((current.top + TRANSITION_HEIGHT - cameraY) / TRANSITION_HEIGHT),
    };
  }
  return { lower: current.stage, upper: current.stage, mix: 0 };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
