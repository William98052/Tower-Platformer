import { describe, expect, it } from 'vitest';
import { overlaps } from '../../src/physics/aabb';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { validateStage } from '../../src/stages/world';

describe('STAGE_01_MOSS', () => {
  it('contains seven valid, ordered sections', () => {
    expect(STAGE_01_MOSS.sections).toHaveLength(7);
    expect(STAGE_01_MOSS.sections.map((section) => section.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(validateStage(STAGE_01_MOSS)).toEqual([]);
  });

  it('gives every section a signature mechanic instead of flat-platform filler', () => {
    for (const section of STAGE_01_MOSS.sections) {
      const specialSurface = section.solids.some((solid) => solid.surface !== 'normal');
      const specialEntity = section.entities.some((entity) => entity.type === 'mushroom');
      expect(specialSurface || specialEntity, `section ${section.id}`).toBe(true);
    }
  });

  it('keeps every checkpoint clear of solids', () => {
    for (const section of STAGE_01_MOSS.sections) {
      const spawn = { ...section.checkpoint, w: 28, h: 28 };
      expect(section.solids.some((solid) => overlaps(spawn, solid)), `section ${section.id}`).toBe(false);
    }
  });

  it('has a continuous 24-unit shell on both sides', () => {
    for (const section of STAGE_01_MOSS.sections) {
      expect(section.solids).toContainEqual({ x: 0, y: 0, w: 24, h: section.height, surface: 'normal' });
      expect(section.solids).toContainEqual({ x: 936, y: 0, w: 24, h: section.height, surface: 'normal' });
    }
  });

  it('uses safe movement envelopes for the introductory stage', () => {
    for (const section of STAGE_01_MOSS.sections) {
      const platforms = section.solids.filter((solid) => solid.h <= 24 && !solid.surface.startsWith('slope'));
      const levels = [...new Set(platforms.map((solid) => solid.y))].sort((a, b) => b - a);
      for (let i = 1; i < levels.length; i++) expect(levels[i - 1] - levels[i], `section ${section.id}`).toBeLessThanOrEqual(180);
      for (const solid of section.solids.filter((item) => item.surface === 'vine')) {
        expect(solid.w).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('introduces jump, wall jump, and dash prompts in route order', () => {
    const prompts = STAGE_01_MOSS.sections.flatMap((section) => section.entities)
      .filter((entity) => entity.type === 'prompt')
      .map((entity) => entity.prompt);
    expect(prompts).toEqual(['jump', 'wallJump', 'dash']);
  });
});
