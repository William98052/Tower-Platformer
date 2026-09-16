import { STAGE_01_MOSS } from './stage01-moss';
import type { TowerDef } from './types';
import { validateStage } from './world';

export const TOWER: TowerDef = { stages: [STAGE_01_MOSS] };

export function validateTower(tower: TowerDef): string[] {
  const errors: string[] = [];
  const stageIds = new Set<number>();

  for (let index = 0; index < tower.stages.length; index += 1) {
    const stage = tower.stages[index];
    if (stageIds.has(stage.id)) errors.push(`duplicate stage id ${stage.id}`);
    stageIds.add(stage.id);

    if (index > 0 && stage.id <= tower.stages[index - 1].id) {
      errors.push('stage ids must be in ascending order');
    }
    if (stage.sections.length !== 7) {
      errors.push(`stage ${stage.id} must contain exactly seven sections`);
    }

    const localSectionIds = new Set<number>();
    for (const section of stage.sections) {
      if (localSectionIds.has(section.id)) {
        errors.push(`stage ${stage.id} has duplicate local section id ${section.id}`);
      }
      localSectionIds.add(section.id);
    }

    errors.push(...validateStage(stage).map((error) => `stage ${stage.id}: ${error}`));
  }

  return errors;
}
