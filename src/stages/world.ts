import { MIN_SOLID_THICKNESS, VIEW_W } from '../core/constants';
import type { EntityDef, StageDef, TowerDef, World, WorldSection } from './types';

function translateEntity(entity: EntityDef, top: number): EntityDef {
  return { ...entity, y: entity.y + top };
}

export function buildWorld(tower: TowerDef): World;
/** Compatibility overload until gameplay is migrated to TowerDef. */
export function buildWorld(stage: StageDef): World;
export function buildWorld(input: TowerDef | StageDef): World {
  const tower = 'stages' in input ? input : { stages: [input] };
  const flattened = tower.stages.flatMap((stage) => (
    stage.sections.map((section) => ({ stage, section }))
  ));
  const height = flattened.reduce((sum, { section }) => sum + section.height, 0);
  let accumulated = 0;
  const sections: WorldSection[] = flattened.map(({ stage, section }, globalIndex) => {
    const top = height - accumulated - section.height;
    accumulated += section.height;
    return {
      globalIndex,
      stageId: stage.id,
      stageName: stage.name,
      localSection: section.id,
      theme: stage.theme,
      id: section.id,
      top,
      bottom: top + section.height,
      height: section.height,
      checkpoint: { x: section.checkpoint.x, y: section.checkpoint.y + top },
      solids: section.solids.map((solid) => ({ ...solid, y: solid.y + top })),
      entities: section.entities.map((entity) => translateEntity(entity, top)),
    };
  });
  return {
    width: VIEW_W,
    height,
    tower,
    stage: tower.stages[0],
    sections,
    solids: sections.flatMap((section) => section.solids),
  };
}

export function stageAtSection(world: World, globalIndex: number): StageDef {
  const section = world.sections.find((candidate) => candidate.globalIndex === globalIndex);
  const stage = section && world.tower.stages.find((candidate) => candidate.id === section.stageId);
  if (!stage) throw new RangeError(`no stage at global section ${globalIndex}`);
  return stage;
}

export function validateStage(stage: StageDef): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(stage.id) || stage.id < 1 || stage.id > 10) errors.push('stage id must be an integer from 1 to 10');
  if (stage.sections.length === 0) errors.push('stage must contain sections');
  for (const section of stage.sections) {
    const label = `section ${section.id}`;
    if (!Number.isInteger(section.height) || section.height <= 0) errors.push(`${label} height must be a positive integer`);
    if (section.checkpoint.x < 0 || section.checkpoint.x >= VIEW_W || section.checkpoint.y < 0 || section.checkpoint.y >= section.height) {
      errors.push(`${label} checkpoint must be inside its bounds`);
    }
    for (const solid of section.solids) {
      if (![solid.x, solid.y, solid.w, solid.h].every(Number.isInteger)) errors.push(`${label} solids must use integer coordinates`);
      if (solid.w < MIN_SOLID_THICKNESS || solid.h < MIN_SOLID_THICKNESS) {
        errors.push(`${label} solids must be at least ${MIN_SOLID_THICKNESS} units on each axis`);
      }
    }
    for (const entity of section.entities) {
      if (entity.type === 'mushroom' && (entity.launch < 700 || entity.launch > 1300)) {
        errors.push(`${label} mushroom launch must be between 700 and 1300`);
      }
      if (entity.type === 'gear') {
        if (!Number.isFinite(entity.radius) || entity.radius <= 0) errors.push(`${label} gear radius must be positive and finite`);
        if (entity.period !== 4 && entity.period !== 6) errors.push(`${label} gear period must be 4 or 6 seconds`);
        if (!Number.isFinite(entity.phase) || entity.phase < 0 || entity.phase >= 1) errors.push(`${label} gear phase must be finite and in [0, 1)`);
      }
      if (entity.type === 'piston') {
        if (!Number.isFinite(entity.travel) || entity.travel <= 0) errors.push(`${label} piston travel must be positive and finite`);
        if (!Number.isFinite(entity.phase) || entity.phase < 0 || entity.phase >= 1) errors.push(`${label} piston phase must be finite and in [0, 1)`);
      }
      if (entity.type === 'timedDoor') {
        if (!Number.isFinite(entity.phase) || entity.phase < 0 || entity.phase >= 1) errors.push(`${label} timed door phase must be finite and in [0, 1)`);
        if (!Number.isFinite(entity.w) || !Number.isFinite(entity.h)
          || entity.w < MIN_SOLID_THICKNESS || entity.h < MIN_SOLID_THICKNESS) {
          errors.push(`${label} timed door must be finite and at least ${MIN_SOLID_THICKNESS} units on each axis`);
        }
      }
    }
  }
  return errors;
}

export function activeSections(world: World, cameraY: number, viewHeight: number): WorldSection[] {
  const visible = world.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.bottom > cameraY && section.top < cameraY + viewHeight);
  if (visible.length === 0) return [];
  const low = Math.max(0, Math.min(...visible.map(({ index }) => index)) - 1);
  const high = Math.min(world.sections.length - 1, Math.max(...visible.map(({ index }) => index)) + 1);
  return world.sections.slice(low, high + 1);
}
