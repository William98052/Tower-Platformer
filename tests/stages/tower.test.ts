import { describe, expect, it } from 'vitest';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { TOWER, validateTower } from '../../src/stages/tower';
import type { StageDef, TowerDef } from '../../src/stages/types';

function stage(id: number): StageDef {
  const result = structuredClone(STAGE_01_MOSS);
  result.id = id;
  result.name = `Stage ${id}`;
  return result;
}

describe('TOWER', () => {
  it('starts with Moss Ruins as the playable stage', () => {
    expect(TOWER.stages).toEqual([STAGE_01_MOSS]);
    expect(validateTower(TOWER)).toEqual([]);
  });
});

describe('validateTower', () => {
  it('rejects duplicate stage ids', () => {
    const tower: TowerDef = { stages: [stage(1), stage(1)] };

    expect(validateTower(tower)).toContainEqual(expect.stringContaining('duplicate stage id'));
  });

  it('rejects unordered stage ids', () => {
    const tower: TowerDef = { stages: [stage(2), stage(1)] };

    expect(validateTower(tower)).toContainEqual(expect.stringContaining('ascending'));
  });

  it('rejects a stage without exactly seven sections', () => {
    const shortStage = stage(1);
    shortStage.sections.pop();

    expect(validateTower({ stages: [shortStage] })).toContainEqual(expect.stringContaining('seven sections'));
  });

  it('rejects duplicate local section ids', () => {
    const duplicateSections = stage(1);
    duplicateSections.sections[1].id = duplicateSections.sections[0].id;

    expect(validateTower({ stages: [duplicateSections] }))
      .toContainEqual(expect.stringContaining('duplicate local section id'));
  });
});
