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

  it('places every mushroom firmly on a platform', () => {
    for (const section of STAGE_01_MOSS.sections) {
      for (const mushroom of section.entities.filter((entity) => entity.type === 'mushroom')) {
        const support = section.solids.find((solid) => (
          solid.h <= 24
          && mushroom.y + mushroom.h === solid.y
          && mushroom.x >= solid.x
          && mushroom.x + mushroom.w <= solid.x + solid.w
        ));
        expect(support, `section ${section.id} mushroom at ${mushroom.x},${mushroom.y}`).toBeDefined();
      }
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
      for (let i = 1; i < levels.length; i++) {
        const lowerY = levels[i - 1];
        const upperY = levels[i];
        const verticalGap = lowerY - upperY;
        if (verticalGap > 180) {
          const bridgingVines = section.solids.filter((solid) => solid.surface === 'vine' && solid.y <= upperY && solid.y + solid.h >= lowerY - 120);
          expect(bridgingVines.length, `section ${section.id}`).toBeGreaterThanOrEqual(2);
        }
      }
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
      const vines = section.solids.filter((solid) => solid.surface === 'vine');
      expect(route.length, `section ${section.id}`).toBeGreaterThanOrEqual(vines.length > 0 ? 3 : 5);
      for (let i = 1; i < route.length; i++) {
        const lower = route[i - 1];
        const upper = route[i];
        const horizontalGap = Math.max(0, upper.x - (lower.x + lower.w), lower.x - (upper.x + upper.w));
        const verticalGap = lower.y - upper.y;
        if (verticalGap > 145) {
          const bridgingVines = vines.filter((vine) => vine.y <= upper.y && vine.y + vine.h >= lower.y - 120);
          expect(bridgingVines.length, `section ${section.id} shaft link ${i}`).toBeGreaterThanOrEqual(2);
        } else {
          expect(verticalGap, `section ${section.id} vertical link ${i}`).toBeLessThanOrEqual(145);
        }
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

  it('uses one reachable final jump into each checkpoint without a cramped extra ledge', () => {
    for (let i = 0; i < STAGE_01_MOSS.sections.length - 1; i++) {
      const lowerSection = STAGE_01_MOSS.sections[i];
      const upperSection = STAGE_01_MOSS.sections[i + 1];
      const exit = lowerSection.solids
        .filter((solid) => solid.role === 'main' && solid.h <= 24)
        .reduce((highest, solid) => solid.y < highest.y ? solid : highest);
      const checkpointFloor = upperSection.solids.find((solid) => (
        solid.h <= 24
        && upperSection.checkpoint.x >= solid.x
        && upperSection.checkpoint.x + 28 <= solid.x + solid.w
        && upperSection.checkpoint.y + 28 <= solid.y
      ));

      expect(checkpointFloor, `checkpoint ${i + 1}`).toBeDefined();
      const verticalClearance = lowerSection.height + exit.y - (checkpointFloor?.y ?? 0);
      expect(verticalClearance, `checkpoint ${i + 1}`).toBeGreaterThanOrEqual(90);
      expect(verticalClearance, `checkpoint ${i + 1}`).toBeLessThanOrEqual(120);

      const route = lowerSection.solids
        .filter((solid) => solid.role === 'main' && solid.h <= 24)
        .sort((a, b) => b.y - a.y);
      for (let j = 1; j < route.length; j++) {
        expect(route[j - 1].y - route[j].y, `section ${i} route spacing ${j}`).toBeGreaterThanOrEqual(90);
      }
    }
  });

  it('joins vine walls and platforms edge-to-edge without shoving rectangles through each other', () => {
    for (const section of STAGE_01_MOSS.sections) {
      const vines = section.solids.filter((solid) => solid.surface === 'vine');
      const platforms = section.solids.filter((solid) => solid.h <= 24);
      for (const vine of vines) {
        for (const platform of platforms) {
          expect(overlaps(vine, platform), `section ${section.id}: vine ${vine.x},${vine.y} overlaps platform ${platform.x},${platform.y}`).toBe(false);
        }
      }
    }
  });

  it('starts every wall jump from an open checkpoint runway', () => {
    for (const sectionIndex of [1, 5, 6]) {
      const section = STAGE_01_MOSS.sections[sectionIndex];
      const [left, right] = section.solids.filter((solid) => solid.surface === 'vine').sort((a, b) => a.x - b.x);
      const platforms = section.solids.filter((solid) => solid.h <= 24);
      const floor = platforms.find((solid) => section.checkpoint.y + 28 <= solid.y && section.checkpoint.x >= solid.x && section.checkpoint.x + 28 <= solid.x + solid.w);

      expect(floor, `section ${section.id} checkpoint floor`).toBeDefined();
      expect(section.checkpoint.x + 28, `section ${section.id} checkpoint outside shaft`).toBeLessThanOrEqual(left.x);
      expect(floor?.x, `section ${section.id} runway start`).toBeLessThanOrEqual(section.checkpoint.x);
      expect((floor?.x ?? 0) + (floor?.w ?? 0), `section ${section.id} runway end`).toBeGreaterThanOrEqual(right.x + right.w);

      const entranceGap = (floor?.y ?? 0) - (left.y + left.h);
      expect(entranceGap, `section ${section.id} walk-under entrance`).toBeGreaterThanOrEqual(80);
      expect(entranceGap, `section ${section.id} walk-under entrance`).toBeLessThanOrEqual(120);
      expect(right.y + right.h).toBe(left.y + left.h);

      const exit = platforms.find((solid) => solid.y === right.y && solid.x === right.x + right.w);
      expect(exit, `section ${section.id} shaft exit`).toBeDefined();

      if (sectionIndex > 0) {
        const priorExit = STAGE_01_MOSS.sections[sectionIndex - 1].solids
          .filter((solid) => solid.role === 'main' && solid.h <= 24)
          .reduce((highest, solid) => solid.y < highest.y ? solid : highest);
        const overlap = Math.min(priorExit.x + priorExit.w, (floor?.x ?? 0) + (floor?.w ?? 0)) - Math.max(priorExit.x, floor?.x ?? 0);
        expect(overlap, `section ${section.id} incoming landing`).toBeGreaterThanOrEqual(160);
      }
    }
  });

  it('keeps every wall-jump shaft short enough for an introductory stage', () => {
    const vines = STAGE_01_MOSS.sections.flatMap((section) => section.solids)
      .filter((solid) => solid.surface === 'vine');

    expect(vines.length).toBeGreaterThan(0);
    for (const vine of vines) expect(vine.h).toBeLessThanOrEqual(250);
  });

  it('gives the finale a short shaft followed by generous overlapping landings', () => {
    const section = STAGE_01_MOSS.sections[6];
    const platforms = section.solids
      .filter((solid) => solid.role === 'main' && solid.h <= 24)
      .sort((a, b) => b.y - a.y);

    expect(platforms).toHaveLength(4);
    for (let i = 2; i < platforms.length; i++) {
      const lower = platforms[i - 1];
      const upper = platforms[i];
      const overlap = Math.min(lower.x + lower.w, upper.x + upper.w) - Math.max(lower.x, upper.x);
      expect(lower.y - upper.y, `finale step ${i}`).toBeLessThanOrEqual(130);
      expect(overlap, `finale landing ${i}`).toBeGreaterThanOrEqual(100);
    }
  });
});
