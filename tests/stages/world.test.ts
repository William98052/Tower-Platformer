import { describe, expect, it } from 'vitest';
import { activeSections, buildWorld, validateStage } from '../../src/stages/world';
import type { StageDef } from '../../src/stages/types';

const stage: StageDef = {
  id: 1,
  name: 'Test',
  theme: { skyTop: '#000', skyBottom: '#111', platform: '#222', edge: '#fff', accent: '#0f0' },
  sections: [0, 1, 2].map((id) => ({
    id,
    height: 600,
    checkpoint: { x: 40, y: 540 },
    solids: [{ x: 0, y: 580, w: 960, h: 20, surface: 'normal' as const }],
    entities: [],
  })),
};

describe('buildWorld', () => {
  it('stacks local sections bottom to top in y-down world space', () => {
    const world = buildWorld(stage);
    expect(world.height).toBe(1800);
    expect(world.sections.map((section) => section.top)).toEqual([1200, 600, 0]);
    expect(world.sections[1].checkpoint).toEqual({ x: 40, y: 1140 });
  });

  it('translates solids and entities into world space', () => {
    const withEntity = structuredClone(stage);
    withEntity.sections[1].entities.push({ type: 'prompt', x: 10, y: 20, w: 30, h: 40, prompt: 'jump' });
    const world = buildWorld(withEntity);
    expect(world.sections[1].solids[0].y).toBe(1180);
    expect(world.sections[1].entities[0]).toMatchObject({ x: 10, y: 620 });
  });
});

describe('validateStage', () => {
  it('accepts a valid stage', () => {
    expect(validateStage(stage)).toEqual([]);
  });

  it('rejects invalid checkpoints, thin solids, and entity parameters', () => {
    const broken = structuredClone(stage);
    broken.sections[0].checkpoint.y = 700;
    broken.sections[1].solids[0].h = 4;
    broken.sections[2].entities.push({ type: 'mushroom', x: 20, y: 20, w: 60, h: 20, launch: 200 });
    expect(validateStage(broken)).toEqual(expect.arrayContaining([
      expect.stringContaining('checkpoint'),
      expect.stringContaining('12 units'),
      expect.stringContaining('launch'),
    ]));
  });
});

describe('activeSections', () => {
  it('includes visible sections plus one neighbour on each side', () => {
    const world = buildWorld(stage);
    expect(activeSections(world, 630, 540).map((section) => section.id)).toEqual([0, 1, 2]);
  });

  it('does not include the far top section at the bottom of the world', () => {
    const world = buildWorld(stage);
    expect(activeSections(world, 1260, 540).map((section) => section.id)).toEqual([0, 1]);
  });
});
