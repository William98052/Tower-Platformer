import { describe, expect, it } from 'vitest';
import { overlaps } from '../../src/physics/aabb';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { STAGE_02_CLOCKWORK } from '../../src/stages/stage02-clockwork';
import type { EntityDef, SectionDef, SolidDef } from '../../src/stages/types';
import { validateStage } from '../../src/stages/world';

const PLAYER_SIZE = 28;
const SHELL_LEFT = 24;
const SHELL_RIGHT = 936;

function routePlatforms(section: SectionDef): SolidDef[] {
  return section.solids.filter((solid) => solid.h <= 24);
}

function airGap(a: SolidDef, b: SolidDef): number {
  return Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
}

function signature(section: SectionDef): string[] {
  const result: string[] = [];
  if (section.solids.some((solid) => solid.surface === 'conveyorLeft' || solid.surface === 'conveyorRight')) {
    result.push('conveyor');
  }
  for (const type of ['gear', 'piston', 'timedDoor'] as const) {
    if (section.entities.some((entity) => entity.type === type)) result.push(type);
  }
  return result;
}

function moverEnvelope(entity: Extract<EntityDef, { type: 'gear' | 'piston' }>): SolidDef {
  if (entity.type === 'gear') {
    return {
      x: entity.x - entity.radius,
      y: entity.y,
      w: entity.paddleW + entity.radius * 2,
      h: 16 + entity.radius * 2,
      surface: 'normal',
    };
  }
  return {
    x: entity.x,
    y: entity.y,
    w: entity.w + (entity.axis === 'x' ? entity.travel : 0),
    h: entity.h + (entity.axis === 'y' ? entity.travel : 0),
    surface: 'normal',
  };
}

function movingSupportBridges(lower: SolidDef, upper: SolidDef, entity: EntityDef): boolean {
  if (entity.type !== 'gear' && entity.type !== 'piston') return false;
  const envelope = moverEnvelope(entity);
  const highestTop = envelope.y;
  const lowestTop = envelope.y + envelope.h - (entity.type === 'gear' ? 16 : entity.h);
  return lower.y - lowestTop >= 0
    && lower.y - lowestTop <= 140
    && highestTop - upper.y >= 0
    && highestTop - upper.y <= 140
    && airGap(lower, envelope) <= 140
    && airGap(envelope, upper) <= 140;
}

describe('STAGE_02_CLOCKWORK', () => {
  it('defines the seven-section Clockwork Hall mechanic progression', () => {
    expect(STAGE_02_CLOCKWORK).toMatchObject({ id: 2, name: 'Clockwork Hall' });
    expect(STAGE_02_CLOCKWORK.sections).toHaveLength(7);
    expect(STAGE_02_CLOCKWORK.sections.map((section) => section.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(validateStage(STAGE_02_CLOCKWORK)).toEqual([]);
    expect(STAGE_02_CLOCKWORK.sections.map(signature)).toEqual([
      ['conveyor'],
      ['conveyor'],
      ['gear'],
      ['piston'],
      ['timedDoor'],
      ['conveyor', 'gear', 'piston'],
      ['conveyor', 'gear', 'piston', 'timedDoor'],
    ]);
  });

  it('uses the exact machinery counts, speeds, periods, and axes from the approved route', () => {
    const [intro, switchback, gallery, passage, gates, climb, finale] = STAGE_02_CLOCKWORK.sections;
    const conveyors = (section: SectionDef) => section.solids.filter((solid) => solid.surface.startsWith('conveyor'));
    const entities = (section: SectionDef, type: EntityDef['type']) => section.entities.filter((entity) => entity.type === type);

    expect(conveyors(intro).map((solid) => solid.conveyorSpeed)).toEqual([90, 90]);
    expect(conveyors(switchback).map((solid) => [solid.surface, solid.conveyorSpeed])).toEqual([
      ['conveyorRight', 90],
      ['conveyorLeft', 160],
      ['conveyorRight', 90],
    ]);
    expect(entities(gallery, 'gear')).toHaveLength(2);
    expect(entities(gallery, 'gear').map((entity) => entity.type === 'gear' && entity.period)).toEqual([6, 6]);
    expect(entities(passage, 'piston').map((entity) => entity.type === 'piston' && entity.axis)).toEqual(['x', 'y']);
    expect(entities(gates, 'timedDoor').map((entity) => entity.type === 'timedDoor' && entity.phase)).toEqual([0, 1 / 3, 2 / 3]);
    expect(entities(climb, 'gear').map((entity) => entity.type === 'gear' && entity.period)).toEqual([4, 4]);
    expect(entities(climb, 'piston')).toHaveLength(1);
    expect(conveyors(finale).map((solid) => solid.conveyorSpeed)).toEqual([160]);
    expect(entities(finale, 'gear')).toHaveLength(1);
    expect(entities(finale, 'piston')).toHaveLength(2);
    expect(entities(finale, 'timedDoor')).toHaveLength(1);
  });

  it('starts every section at a clear checkpoint on a broad flat runway', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      const spawn = { ...section.checkpoint, w: PLAYER_SIZE, h: PLAYER_SIZE };
      expect(section.height, `section ${section.id} height`).toBe(700);
      expect(section.solids.some((solid) => overlaps(spawn, solid)), `section ${section.id} clear spawn`).toBe(false);

      const runway = routePlatforms(section).find((solid) => (
        solid.role === 'main'
        && solid.y >= section.checkpoint.y + PLAYER_SIZE
        && section.checkpoint.x >= solid.x
        && section.checkpoint.x + PLAYER_SIZE <= solid.x + solid.w
      ));
      expect(runway, `section ${section.id} checkpoint runway`).toBeDefined();
      expect(runway?.w, `section ${section.id} runway width`).toBeGreaterThanOrEqual(280);
      expect(runway?.surface, `section ${section.id} runway surface`).toBe('normal');
    }
  });

  it('keeps every collision platform on one classified route or its single useful recovery path', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      const platforms = routePlatforms(section);
      expect(platforms.every((solid) => solid.role === 'main' || solid.role === 'recovery'), `section ${section.id} classified`).toBe(true);

      const recovery = platforms.filter((solid) => solid.role === 'recovery');
      expect(recovery.length, `section ${section.id} recovery count`).toBeLessThanOrEqual(1);
      for (const floor of recovery) {
        const returnLanding = platforms.find((solid) => (
          solid.role === 'main'
          && floor.y - solid.y >= 1
          && floor.y - solid.y <= 140
          && airGap(floor, solid) <= 280
        ));
        expect(returnLanding, `section ${section.id} recovery rejoins route`).toBeDefined();
      }

      const byLevel = new Map<number, SolidDef[]>();
      for (const solid of platforms.filter((candidate) => candidate.role === 'main')) {
        byLevel.set(solid.y, [...(byLevel.get(solid.y) ?? []), solid]);
      }
      const levels = [...byLevel.keys()].sort((a, b) => b - a);
      expect(levels.length, `section ${section.id} route levels`).toBeGreaterThanOrEqual(3);
      for (let index = 1; index < levels.length; index += 1) {
        const lower = byLevel.get(levels[index - 1]) ?? [];
        const upper = byLevel.get(levels[index]) ?? [];
        const ordinaryLink = lower.some((from) => upper.some((to) => (
          from.y - to.y >= 90
          && from.y - to.y <= 140
          && airGap(from, to) <= 280
        )));
        const machineryLink = lower.some((from) => upper.some((to) => (
          section.entities.some((entity) => movingSupportBridges(from, to, entity))
        )));
        expect(ordinaryLink || machineryLink, `section ${section.id} route link ${index}`).toBe(true);
      }
    }
  });

  it('contains no disconnected same-height ledges around timed doors', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      const main = routePlatforms(section).filter((solid) => solid.role === 'main');
      for (const level of new Set(main.map((solid) => solid.y))) {
        const row = main.filter((solid) => solid.y === level).sort((a, b) => a.x - b.x);
        for (let index = 1; index < row.length; index += 1) {
          const left = row[index - 1];
          const right = row[index];
          const gapStart = left.x + left.w;
          const gapWidth = right.x - gapStart;
          const door = section.entities.find((entity) => (
            entity.type === 'timedDoor'
            && entity.x === gapStart
            && entity.w === gapWidth
            && entity.y + entity.h === level
          ));
          expect(door, `section ${section.id} route gap at ${level}`).toBeDefined();
        }
      }
    }
  });

  it('keeps every moving path inside the section and the 24–936 tower shell', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      for (const entity of section.entities) {
        if (entity.type === 'gear' || entity.type === 'piston') {
          const envelope = moverEnvelope(entity);
          expect(envelope.x, `section ${section.id} ${entity.type} left`).toBeGreaterThanOrEqual(SHELL_LEFT);
          expect(envelope.x + envelope.w, `section ${section.id} ${entity.type} right`).toBeLessThanOrEqual(SHELL_RIGHT);
          expect(envelope.y, `section ${section.id} ${entity.type} top`).toBeGreaterThanOrEqual(0);
          expect(envelope.y + envelope.h, `section ${section.id} ${entity.type} bottom`).toBeLessThanOrEqual(section.height);
        }
        if (entity.type === 'timedDoor') {
          expect(entity.x, `section ${section.id} door left`).toBeGreaterThanOrEqual(SHELL_LEFT);
          expect(entity.x + entity.w, `section ${section.id} door right`).toBeLessThanOrEqual(SHELL_RIGHT);
          expect(entity.y - entity.h, `section ${section.id} door open top`).toBeGreaterThanOrEqual(0);
          expect(entity.y + entity.h, `section ${section.id} door closed bottom`).toBeLessThanOrEqual(section.height);
        }
      }
    }
  });

  it('places each timed door between generous waiting floors without intersecting either floor when closed', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      const platforms = routePlatforms(section);
      for (const door of section.entities.filter((entity) => entity.type === 'timedDoor')) {
        const closed = { x: door.x, y: door.y, w: door.w, h: door.h };
        expect(platforms.some((solid) => overlaps(closed, solid)), `section ${section.id} closed door clearance`).toBe(false);

        const floorY = door.y + door.h;
        const leftWait = platforms.find((solid) => solid.role === 'main' && solid.y === floorY && solid.x + solid.w === door.x);
        const rightWait = platforms.find((solid) => solid.role === 'main' && solid.y === floorY && solid.x === door.x + door.w);
        expect(leftWait?.w, `section ${section.id} left door wait`).toBeGreaterThanOrEqual(160);
        expect(rightWait?.w, `section ${section.id} right door wait`).toBeGreaterThanOrEqual(160);
      }
    }
  });

  it('hands every section directly to the next broad runway and leaves a broad final exit', () => {
    const mossExit = routePlatforms(STAGE_01_MOSS.sections[6])
      .filter((solid) => solid.role === 'main')
      .reduce((highest, solid) => solid.y < highest.y ? solid : highest);
    const clockworkEntrance = routePlatforms(STAGE_02_CLOCKWORK.sections[0])
      .find((solid) => STAGE_02_CLOCKWORK.sections[0].checkpoint.x >= solid.x
        && STAGE_02_CLOCKWORK.sections[0].checkpoint.x + PLAYER_SIZE <= solid.x + solid.w);
    expect(airGap(mossExit, clockworkEntrance as SolidDef), 'stage handoff').toBe(0);

    for (let index = 0; index < STAGE_02_CLOCKWORK.sections.length; index += 1) {
      const section = STAGE_02_CLOCKWORK.sections[index];
      const route = routePlatforms(section).filter((solid) => solid.role === 'main');
      const highestY = Math.min(...route.map((solid) => solid.y));
      const exits = route.filter((solid) => solid.y === highestY);
      expect(highestY, `section ${section.id} exit height`).toBe(70);

      if (index === STAGE_02_CLOCKWORK.sections.length - 1) {
        expect(exits.some((solid) => solid.w >= 280), 'final stage handoff').toBe(true);
        continue;
      }

      const next = STAGE_02_CLOCKWORK.sections[index + 1];
      const runway = routePlatforms(next).find((solid) => (
        solid.role === 'main'
        && next.checkpoint.x >= solid.x
        && next.checkpoint.x + PLAYER_SIZE <= solid.x + solid.w
      ));
      const overlap = Math.max(...exits.map((exit) => (
        Math.min(exit.x + exit.w, (runway?.x ?? 0) + (runway?.w ?? 0)) - Math.max(exit.x, runway?.x ?? 0)
      )));
      expect(overlap, `handoff ${index + 1}`).toBeGreaterThanOrEqual(120);
      expect(section.height + highestY - (runway?.y ?? 0), `handoff ${index + 1} vertical`).toBeGreaterThanOrEqual(90);
      expect(section.height + highestY - (runway?.y ?? 0), `handoff ${index + 1} vertical`).toBeLessThanOrEqual(120);
    }
  });
});
