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
      expect(section.solids).toContainEqual({ x: 0, y: 0, w: 24, h: section.height, surface: 'normal', role: 'boundary' });
      expect(section.solids).toContainEqual({ x: 936, y: 0, w: 24, h: section.height, surface: 'normal', role: 'boundary' });
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

  it('uses stepped platforms instead of visually awkward slope solids', () => {
    const slopes = STAGE_01_MOSS.sections.flatMap((section) => section.solids)
      .filter((solid) => solid.surface === 'slopeUp' || solid.surface === 'slopeDown');
    expect(slopes).toEqual([]);
  });

  it('defines one continuous main route without unclassified dead-end platforms', () => {
    for (const section of STAGE_01_MOSS.sections) {
      const platforms = section.solids.filter((solid) => solid.h <= 24);
      expect(platforms.every((solid) => solid.role === 'main' || solid.role === 'recovery'), `section ${section.id}`).toBe(true);

      const route = platforms.filter((solid) => solid.role === 'main').sort((a, b) => b.y - a.y);
      expect(route.length, `section ${section.id}`).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < route.length; i++) {
        const lower = route[i - 1];
        const upper = route[i];
        const horizontalGap = Math.max(0, upper.x - (lower.x + lower.w), lower.x - (upper.x + upper.w));
        expect(lower.y - upper.y, `section ${section.id} vertical link ${i}`).toBeLessThanOrEqual(145);
        expect(horizontalGap, `section ${section.id} horizontal link ${i}`).toBeLessThanOrEqual(280);
      }

      expect(platforms.filter((solid) => solid.role === 'recovery').length, `section ${section.id}`).toBeLessThanOrEqual(1);
    }
  });

  it('aligns each section exit with the next section entrance', () => {
    for (let i = 0; i < STAGE_01_MOSS.sections.length - 1; i++) {
      const currentRoute = STAGE_01_MOSS.sections[i].solids.filter((solid) => solid.role === 'main' && solid.h <= 24);
      const nextRoute = STAGE_01_MOSS.sections[i + 1].solids.filter((solid) => solid.role === 'main' && solid.h <= 24);
      const exit = currentRoute.reduce((highest, solid) => solid.y < highest.y ? solid : highest);
      const entrance = nextRoute.reduce((lowest, solid) => solid.y > lowest.y ? solid : lowest);
      expect(Math.min(exit.x + exit.w, entrance.x + entrance.w) - Math.max(exit.x, entrance.x), `handoff ${i + 1}`).toBeGreaterThan(40);
    }
  });
});
