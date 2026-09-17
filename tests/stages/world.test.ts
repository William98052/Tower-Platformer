import { describe, expect, it } from 'vitest';
import { activeSections, buildWorld, stageAtSection, validateStage } from '../../src/stages/world';
import type { EntityDef, StageDef, TowerDef } from '../../src/stages/types';

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
  it('stacks stages bottom to top with global and local section identity', () => {
    const twoSectionStage = (id: number): StageDef => ({
      ...structuredClone(stage),
      id,
      name: `Stage ${id}`,
      sections: structuredClone(stage.sections.slice(0, 2)),
    });
    const tower: TowerDef = { stages: [twoSectionStage(1), twoSectionStage(2)] };

    const world = buildWorld(tower);

    expect(world.sections.map((section) => [section.globalIndex, section.stageId, section.localSection]))
      .toEqual([[0, 1, 0], [1, 1, 1], [2, 2, 0], [3, 2, 1]]);
    expect(world.sections[0].bottom).toBe(world.height);
    expect(world.sections[3].top).toBe(0);
    expect(stageAtSection(world, 2).id).toBe(2);
  });

  it('stacks local sections bottom to top in y-down world space', () => {
    const world = buildWorld({ stages: [stage] });
    expect(world.height).toBe(1800);
    expect(world.sections.map((section) => section.top)).toEqual([1200, 600, 0]);
    expect(world.sections[1].checkpoint).toEqual({ x: 40, y: 1140 });
  });

  it('translates solids and entities into world space', () => {
    const withEntity = structuredClone(stage);
    withEntity.sections[1].entities.push({ type: 'prompt', x: 10, y: 20, w: 30, h: 40, prompt: 'jump' });
    const world = buildWorld({ stages: [withEntity] });
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

  it('rejects invalid Clockwork machinery parameters', () => {
    const broken = structuredClone(stage);
    broken.sections[0].entities.push(
      { type: 'gear', x: 20, y: 20, radius: 0, period: 5, phase: -0.1, paddleW: 60 } as unknown as EntityDef,
      { type: 'piston', x: 20, y: 20, w: 60, h: 20, axis: 'x', travel: 0, phase: 1 },
      { type: 'timedDoor', x: 20, y: 20, w: 8, h: 80, phase: 1.2 },
    );

    expect(validateStage(broken)).toEqual(expect.arrayContaining([
      expect.stringContaining('gear radius'),
      expect.stringContaining('gear period'),
      expect.stringContaining('gear phase'),
      expect.stringContaining('piston travel'),
      expect.stringContaining('piston phase'),
      expect.stringContaining('timed door phase'),
      expect.stringContaining('timed door'),
      expect.stringContaining('12 units'),
    ]));
  });

  it('rejects undersized water and currents above the supported cap', () => {
    const broken = structuredClone(stage);
    broken.sections[0].entities.push(
      { type: 'water', x: 20, y: 20, w: 23, h: 24, currentX: 0, currentY: 0 } as EntityDef,
      { type: 'water', x: 20, y: 20, w: 24, h: 23, currentX: 0, currentY: 0 } as EntityDef,
      { type: 'water', x: 20, y: 20, w: 100, h: 80, currentX: 421, currentY: -421 } as EntityDef,
    );

    expect(validateStage(broken)).toEqual(expect.arrayContaining([
      expect.stringContaining('water must be at least 24'),
      expect.stringContaining('water must be at least 24'),
      expect.stringContaining('water current'),
    ]));
  });

  it('rejects invalid Aqueduct ride parameters', () => {
    const broken = structuredClone(stage);
    broken.sections[0].entities.push(
      { type: 'sinkingCrate', x: 20, y: 20, w: 80, h: 20, sinkDistance: 0 } as EntityDef,
      { type: 'waterWheel', x: 200, y: 200, radius: 0, phase: 0, paddleW: 80, paddleH: 20 } as EntityDef,
      { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: 0, paddleW: 0, paddleH: -1 } as EntityDef,
    );

    expect(validateStage(broken)).toEqual(expect.arrayContaining([
      expect.stringContaining('crate sink distance'),
      expect.stringContaining('water wheel radius'),
      expect.stringContaining('water wheel paddle dimensions'),
    ]));
  });

  it.each([
    ['crate sink distance NaN', { type: 'sinkingCrate', x: 20, y: 20, w: 80, h: 20, sinkDistance: Number.NaN }, 'crate sink distance'],
    ['wheel radius infinity', { type: 'waterWheel', x: 200, y: 200, radius: Number.POSITIVE_INFINITY, phase: 0, paddleW: 80, paddleH: 20 }, 'water wheel radius'],
    ['wheel paddle width NaN', { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: 0, paddleW: Number.NaN, paddleH: 20 }, 'water wheel paddle dimensions'],
    ['wheel paddle height infinity', { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: 0, paddleW: 80, paddleH: Number.POSITIVE_INFINITY }, 'water wheel paddle dimensions'],
    ['wheel phase NaN', { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: Number.NaN, paddleW: 80, paddleH: 20 }, 'water wheel phase'],
    ['wheel phase infinity', { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: Number.POSITIVE_INFINITY, paddleW: 80, paddleH: 20 }, 'water wheel phase'],
    ['wheel phase negative', { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: -0.01, paddleW: 80, paddleH: 20 }, 'water wheel phase'],
    ['wheel phase one', { type: 'waterWheel', x: 200, y: 200, radius: 60, phase: 1, paddleW: 80, paddleH: 20 }, 'water wheel phase'],
  ] as const)('rejects invalid %s', (_case, entity, message) => {
    const broken = structuredClone(stage);
    broken.sections[0].entities.push(entity as unknown as EntityDef);

    expect(validateStage(broken)).toContainEqual(expect.stringContaining(message));
  });

  it.each([
    ['width NaN', { x: 20, y: 20, w: Number.NaN, h: 80, currentX: 0, currentY: 0 }, 'water'],
    ['height infinity', { x: 20, y: 20, w: 80, h: Number.POSITIVE_INFINITY, currentX: 0, currentY: 0 }, 'water'],
    ['current NaN', { x: 20, y: 20, w: 80, h: 80, currentX: Number.NaN, currentY: 0 }, 'water current'],
    ['current infinity', { x: 20, y: 20, w: 80, h: 80, currentX: 0, currentY: Number.POSITIVE_INFINITY }, 'water current'],
  ] as const)('rejects invalid water %s', (_case, water, message) => {
    const broken = structuredClone(stage);
    broken.sections[0].entities.push({ type: 'water', ...water } as EntityDef);

    expect(validateStage(broken)).toContainEqual(expect.stringContaining(message));
  });

  it.each([
    ['gear radius NaN', { type: 'gear', x: 20, y: 20, radius: Number.NaN, period: 4, phase: 0, paddleW: 60 }, 'gear radius'],
    ['gear radius infinity', { type: 'gear', x: 20, y: 20, radius: Number.POSITIVE_INFINITY, period: 4, phase: 0, paddleW: 60 }, 'gear radius'],
    ['gear phase NaN', { type: 'gear', x: 20, y: 20, radius: 40, period: 4, phase: Number.NaN, paddleW: 60 }, 'gear phase'],
    ['piston travel infinity', { type: 'piston', x: 20, y: 20, w: 60, h: 20, axis: 'x', travel: Number.POSITIVE_INFINITY, phase: 0 }, 'piston travel'],
    ['piston phase infinity', { type: 'piston', x: 20, y: 20, w: 60, h: 20, axis: 'x', travel: 80, phase: Number.POSITIVE_INFINITY }, 'piston phase'],
    ['door phase NaN', { type: 'timedDoor', x: 20, y: 20, w: 20, h: 80, phase: Number.NaN }, 'timed door phase'],
    ['door width NaN', { type: 'timedDoor', x: 20, y: 20, w: Number.NaN, h: 80, phase: 0 }, 'timed door'],
    ['door height infinity', { type: 'timedDoor', x: 20, y: 20, w: 20, h: Number.POSITIVE_INFINITY, phase: 0 }, 'timed door'],
  ] as const)('rejects non-finite %s', (_case, entity, message) => {
    const broken = structuredClone(stage);
    broken.sections[0].entities.push(entity as unknown as EntityDef);

    expect(validateStage(broken)).toContainEqual(expect.stringContaining(message));
  });
});

describe('activeSections', () => {
  it('includes visible sections plus one neighbour on each side', () => {
    const world = buildWorld({ stages: [stage] });
    expect(activeSections(world, 630, 540).map((section) => section.localSection)).toEqual([0, 1, 2]);
  });

  it('does not include the far top section at the bottom of the world', () => {
    const world = buildWorld({ stages: [stage] });
    expect(activeSections(world, 1260, 540).map((section) => section.localSection)).toEqual([0, 1]);
  });
});
