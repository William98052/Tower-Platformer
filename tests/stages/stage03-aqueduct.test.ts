import { describe, expect, it } from 'vitest';
import { STEP } from '../../src/core/constants';
import { createEntities } from '../../src/entities/factory';
import type { Entity } from '../../src/entities/entity';
import { carryStandingPlayer, resolveFieldEffects } from '../../src/entities/interactions';
import { SinkingCrateEntity } from '../../src/entities/sinking-crate';
import { WaterWheelEntity } from '../../src/entities/water-wheel';
import { overlaps } from '../../src/physics/aabb';
import { pushOutPlayer } from '../../src/physics/collision';
import { createPlayer, stepPlayer, type Player } from '../../src/physics/player';
import { STAGE_02_CLOCKWORK } from '../../src/stages/stage02-clockwork';
import { STAGE_03_AQUEDUCT } from '../../src/stages/stage03-aqueduct';
import type { EntityDef, SectionDef, SolidDef } from '../../src/stages/types';
import { validateStage } from '../../src/stages/world';
import { input } from '../helpers/input';

function signature(section: SectionDef): string[] {
  const result: string[] = [];
  for (const type of ['water', 'sinkingCrate', 'waterWheel'] as const) {
    if (section.entities.some((entity) => entity.type === type)) result.push(type);
  }
  return result;
}

const PLAYER_SIZE = 28;

function routePlatforms(section: SectionDef): SolidDef[] {
  return section.solids.filter((solid) => solid.role !== 'boundary');
}

function overlapWidth(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
}

function runway(section: SectionDef): SolidDef | undefined {
  return routePlatforms(section).find((solid) => (
    solid.role === 'main'
    && solid.surface === 'normal'
    && solid.y >= section.checkpoint.y + PLAYER_SIZE
    && section.checkpoint.x >= solid.x
    && section.checkpoint.x + PLAYER_SIZE <= solid.x + solid.w
  ));
}

function water(section: SectionDef) {
  return section.entities.filter((entity): entity is Extract<EntityDef, { type: 'water' }> => entity.type === 'water');
}

function isWaterExit(field: Extract<EntityDef, { type: 'water' }>, solid: SolidDef): boolean {
  const edgeGap = Math.min(
    Math.abs(solid.x + solid.w - field.x),
    Math.abs(field.x + field.w - solid.x),
  );
  return solid.role === 'main'
    && solid.w >= 160
    && Math.abs(solid.y - field.y) <= 20
    && edgeGap <= PLAYER_SIZE;
}

function landedOn(player: Player, target: { x: number; y: number; w: number; h: number }): boolean {
  return player.onGround
    && Math.abs(player.y + player.h - target.y) <= 1
    && player.x + player.w > target.x
    && player.x < target.x + target.w;
}

interface SectionSimulation {
  entities: Entity[];
  player: Player;
  time: number;
  carriedBy: Entity | null;
  step(frameInput: ReturnType<typeof input>): boolean;
}

function sectionSimulation(
  section: SectionDef,
  player: Player,
  startTime = 0,
  include: (entity: Entity) => boolean = () => true,
): SectionSimulation {
  const entities = createEntities(section.entities).filter(include);
  const simulation: SectionSimulation = {
    entities,
    player,
    time: startTime,
    carriedBy: null,
    step(frameInput) {
      simulation.time += STEP;
      for (const entity of entities) entity.update(simulation.time, STEP);
      const moving = entities.flatMap((entity) => entity.dynamicSolids().map((solid) => ({ entity, solid })));
      const solids = [...section.solids, ...moving.map(({ solid }) => solid.box)];
      simulation.carriedBy = null;
      for (const { entity, solid } of moving) {
        if (!carryStandingPlayer(player, solid, solids)) continue;
        simulation.carriedBy = entity;
        break;
      }
      const field = resolveFieldEffects(entities.map((entity) => entity.field(player)).filter((effect) => effect !== null));
      stepPlayer(player, frameInput, solids, STEP, field);
      for (const { solid } of moving) {
        if (!pushOutPlayer(player, solid.box, solids.filter((blocker) => blocker !== solid.box))) return false;
      }
      for (const entity of entities) entity.collide(player);
      return true;
    },
  };
  return simulation;
}

describe('STAGE_03_AQUEDUCT', () => {
  it('defines the seven-section Sunken Aqueduct mechanic progression', () => {
    expect(STAGE_03_AQUEDUCT).toMatchObject({ id: 3, name: 'Sunken Aqueduct' });
    expect(STAGE_03_AQUEDUCT.sections).toHaveLength(7);
    expect(STAGE_03_AQUEDUCT.sections.map((section) => section.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(validateStage(STAGE_03_AQUEDUCT)).toEqual([]);
    expect(STAGE_03_AQUEDUCT.sections.map(signature)).toEqual([
      ['water'],
      ['water'],
      ['sinkingCrate'],
      ['waterWheel'],
      ['water', 'sinkingCrate'],
      ['water'],
      ['water', 'sinkingCrate', 'waterWheel'],
    ]);
  });

  it('uses the exact currents, crate counts, and five-second wheel progression', () => {
    const [, currents, crates, wheel, vertical, switchback, finale] = STAGE_03_AQUEDUCT.sections;
    const entities = (section: SectionDef, type: EntityDef['type']) => section.entities.filter((entity) => entity.type === type);

    expect(water(currents).map((field) => [field.currentX, field.currentY])).toEqual([[260, 0], [-260, 0]]);
    expect(entities(crates, 'sinkingCrate')).toHaveLength(3);
    expect(entities(wheel, 'waterWheel')).toHaveLength(1);
    expect(entities(vertical, 'sinkingCrate')).toHaveLength(2);
    expect(water(vertical).map((field) => [field.currentX, field.currentY])).toEqual([[0, -420]]);
    expect(water(switchback)).toHaveLength(2);
    expect(entities(finale, 'sinkingCrate')).toHaveLength(2);
    expect(entities(finale, 'waterWheel')).toHaveLength(1);
    expect(water(finale).map((field) => [field.currentX, field.currentY])).toEqual([[420, 0], [0, -420]]);
  });

  it('starts every section on a clear broad flat checkpoint runway', () => {
    for (const section of STAGE_03_AQUEDUCT.sections) {
      const spawn = { ...section.checkpoint, w: PLAYER_SIZE, h: PLAYER_SIZE };
      expect(section.height, `section ${section.id} height`).toBe(700);
      expect(section.solids.some((solid) => overlaps(spawn, solid)), `section ${section.id} clear spawn`).toBe(false);
      expect(runway(section)?.w, `section ${section.id} runway width`).toBeGreaterThanOrEqual(280);
      expect(water(section).some((field) => overlaps(spawn, field)), `section ${section.id} dry checkpoint`).toBe(false);

      const machinery = createEntities(section.entities).flatMap((entity) => entity.dynamicSolids());
      expect(machinery.some((solid) => overlaps(spawn, solid.box)), `section ${section.id} clear machinery`).toBe(false);
    }
  });

  it('keeps every collision platform on the main route or its single useful recovery floor', () => {
    for (const section of STAGE_03_AQUEDUCT.sections) {
      const platforms = routePlatforms(section);
      expect(platforms.every((solid) => solid.role === 'main' || solid.role === 'recovery'), `section ${section.id} classified`).toBe(true);
      expect(platforms.every((solid) => solid.h === 16), `section ${section.id} thickness`).toBe(true);
      expect(platforms.filter((solid) => solid.role === 'recovery').length, `section ${section.id} recovery count`).toBeLessThanOrEqual(1);
    }
  });

  it('gives every water volume a visible exit at least 160 units wide and never points a current into a sealed wall', () => {
    for (const section of STAGE_03_AQUEDUCT.sections) {
      for (const field of water(section)) {
        const exits = routePlatforms(section).filter((solid) => isWaterExit(field, solid));
        expect(exits.length, `section ${section.id} visible water exit`).toBeGreaterThan(0);
        if (field.currentX > 0) expect(field.x + field.w, `section ${section.id} current right clearance`).toBeLessThanOrEqual(920);
        if (field.currentX < 0) expect(field.x, `section ${section.id} current left clearance`).toBeGreaterThanOrEqual(40);
        if (field.currentY < 0) expect(exits.length, `section ${section.id} upward-current exit`).toBeGreaterThan(0);
      }
    }
  });

  it('swims from the far side of every water volume onto its visible exit with production fields and strokes', () => {
    for (const section of STAGE_03_AQUEDUCT.sections) {
      for (const field of water(section)) {
        const exit = routePlatforms(section).find((solid) => isWaterExit(field, solid));
        if (!exit) throw new Error(`section ${section.id} water exit missing`);
        const exitCenter = field.currentY < 0 ? exit.x + 40 : exit.x + exit.w / 2;
        const startsLeft = exitCenter >= field.x + field.w / 2;
        const startX = startsLeft ? field.x + 20 : field.x + field.w - PLAYER_SIZE - 20;
        const player = createPlayer(startX, field.y + field.h - PLAYER_SIZE - 20);
        const simulation = sectionSimulation(section, player);
        let reached = false;
        let safe = true;

        for (let frame = 0; frame < 720; frame += 1) {
          const swimTargetX = field.currentY < 0 && player.y > field.y + PLAYER_SIZE
            ? field.x + 40
            : exitCenter;
          const direction = Math.sign(swimTargetX - (player.x + player.w / 2)) as -1 | 0 | 1;
          const stroke = frame % 28 === 0;
          safe &&= simulation.step(input({ moveX: direction, jump: stroke, jumpPressed: stroke }));
          if (landedOn(player, exit)) {
            reached = true;
            break;
          }
        }

        expect(safe, `section ${section.id} water traversal safe`).toBe(true);
        expect(reached, `section ${section.id} water exit ${JSON.stringify({ x: player.x, y: player.y })}`).toBe(true);
      }
    }
  });

  it('keeps crate transfers close and leaves every sinking crate clear of the only fixed exit', () => {
    for (const section of STAGE_03_AQUEDUCT.sections) {
      const crates = section.entities.filter((entity): entity is Extract<EntityDef, { type: 'sinkingCrate' }> => entity.type === 'sinkingCrate');
      const ordered = [...crates].sort((a, b) => a.x - b.x);
      for (let index = 1; index < ordered.length; index += 1) {
        const gap = ordered[index].x - (ordered[index - 1].x + ordered[index - 1].w);
        expect(gap, `section ${section.id} crate transfer ${index}`).toBeLessThanOrEqual(130);
      }
      const topY = Math.min(...routePlatforms(section).filter((solid) => solid.role === 'main').map((solid) => solid.y));
      const exits = routePlatforms(section).filter((solid) => solid.role === 'main' && solid.y === topY);
      for (const crate of crates) {
        expect(exits.some((exit) => overlaps(crate, exit)), `section ${section.id} crate blocks exit`).toBe(false);
        const sinkEnvelope = { ...crate, h: crate.h + crate.sinkDistance };
        expect(routePlatforms(section).some((solid) => overlaps(sinkEnvelope, solid)), `section ${section.id} crate sink envelope`).toBe(false);
      }
    }
  });

  it('uses a shallow still intro pool and two broad dry landings in the wet/dry switchback', () => {
    const introWater = water(STAGE_03_AQUEDUCT.sections[0]);
    expect(introWater).toEqual([
      expect.objectContaining({ currentX: 0, currentY: 0 }),
    ]);
    const introExit = routePlatforms(STAGE_03_AQUEDUCT.sections[0]).find((solid) => isWaterExit(introWater[0], solid));
    expect(introExit?.w).toBe(240);

    const switchback = STAGE_03_AQUEDUCT.sections[5];
    const dryDashLandings = routePlatforms(switchback).filter((solid) => solid.y === 410 || solid.y === 300 || solid.y === 180);
    expect(dryDashLandings).toHaveLength(3);
    expect(dryDashLandings.every((solid) => solid.w >= 180)).toBe(true);
  });

  it('continuously crosses all three introductory crates and completes the fixed climb', () => {
    const section = STAGE_03_AQUEDUCT.sections[2];
    const route = routePlatforms(section).filter((solid) => solid.role === 'main');
    const start = runway(section)!;
    const player = createPlayer(580, start.y - PLAYER_SIZE);
    player.onGround = true;
    const simulation = sectionSimulation(section, player);
    const crateTargets = simulation.entities
      .filter((entity): entity is SinkingCrateEntity => entity instanceof SinkingCrateEntity)
      .sort((a, b) => b.bounds().x - a.bounds().x)
      .map((entity) => () => entity.dynamicSolids()[0].box);
    const fixedTargets = route.filter((solid) => solid !== start).sort((a, b) => b.y - a.y).map((solid) => () => solid);
    const targets = [...crateTargets, ...fixedTargets];

    let targetIndex = 0;
    let safe = true;
    for (let frame = 0; frame < 1_800 && targetIndex < targets.length; frame += 1) {
      const target = targets[targetIndex]();
      const direction = Math.sign(target.x + target.w / 2 - (player.x + player.w / 2)) as -1 | 0 | 1;
      const jumpPressed = player.onGround;
      safe &&= simulation.step(input({ moveX: direction, jump: true, jumpPressed }));
      if (landedOn(player, targets[targetIndex]())) targetIndex += 1;
    }

    expect(safe).toBe(true);
    expect(targetIndex, JSON.stringify({ targetIndex, x: player.x, y: player.y })).toBe(targets.length);
  });

  it('continuously uses every crate in the vertical climb and finale current without becoming trapped', () => {
    const fixtures = [
      { sectionIndex: 4, startX: 320, startY: 590 },
      { sectionIndex: 6, startX: 320, startY: 590 },
    ];

    for (const fixture of fixtures) {
      const section = STAGE_03_AQUEDUCT.sections[fixture.sectionIndex];
      const player = createPlayer(fixture.startX, fixture.startY);
      const simulation = sectionSimulation(section, player);
      const crates = simulation.entities
        .filter((entity): entity is SinkingCrateEntity => entity instanceof SinkingCrateEntity)
        .sort((a, b) => b.bounds().y - a.bounds().y);
      let crateIndex = 0;
      let phase: 'ascend' | 'land' = 'ascend';
      let safe = true;

      for (let frame = 0; frame < 2_400 && crateIndex < crates.length; frame += 1) {
        const box = crates[crateIndex].dynamicSolids()[0].box;
        const approachX = box.x - PLAYER_SIZE - 12;
        if (phase === 'ascend' && player.y + player.h <= box.y - 8) phase = 'land';
        const targetX = phase === 'ascend' ? approachX : box.x + 8;
        const direction = Math.sign(targetX - player.x) as -1 | 0 | 1;
        const stroke = phase === 'ascend' && frame % 28 === 0;
        safe &&= simulation.step(input({ moveX: direction, jump: stroke, jumpPressed: stroke }));
        if (landedOn(player, crates[crateIndex].dynamicSolids()[0].box)) {
          crateIndex += 1;
          phase = 'ascend';
        }
      }

      expect(safe, `section ${fixture.sectionIndex} crate route safe`).toBe(true);
      expect(crateIndex, `section ${fixture.sectionIndex} crates used ${JSON.stringify({ x: player.x, y: player.y })}`).toBe(crates.length);
    }
  });

  it('overlaps each wheel safe arc with both fixed landings by at least 80 units', () => {
    for (const section of STAGE_03_AQUEDUCT.sections) {
      for (const wheel of section.entities.filter((entity): entity is Extract<EntityDef, { type: 'waterWheel' }> => entity.type === 'waterWheel')) {
        const envelope = { x: wheel.x - wheel.radius - wheel.paddleW / 2, w: wheel.radius * 2 + wheel.paddleW };
        const lower = routePlatforms(section)
          .filter((solid) => solid.role === 'main' && solid.y > wheel.y)
          .sort((a, b) => a.y - b.y)[0];
        const upper = routePlatforms(section)
          .filter((solid) => solid.role === 'main' && solid.y < wheel.y)
          .sort((a, b) => b.y - a.y)[0];
        expect(lower, `section ${section.id} lower wheel bank`).toBeDefined();
        expect(upper, `section ${section.id} upper wheel bank`).toBeDefined();
        expect(overlapWidth(envelope, lower!), `section ${section.id} lower wheel overlap`).toBeGreaterThanOrEqual(80);
        expect(overlapWidth(envelope, upper!), `section ${section.id} upper wheel overlap`).toBeGreaterThanOrEqual(80);
      }
    }
  });

  it('continuously boards, rides, and dismounts both water wheels against full section geometry', () => {
    const fixtures = [
      { sectionIndex: 3, lowerY: 660, upperY: 380, startX: 746 },
      { sectionIndex: 6, lowerY: 510, upperY: 330, startX: 636 },
    ];

    for (const fixture of fixtures) {
      const section = STAGE_03_AQUEDUCT.sections[fixture.sectionIndex];
      const lower = routePlatforms(section).find((solid) => solid.y === fixture.lowerY);
      const upper = routePlatforms(section).find((solid) => solid.y === fixture.upperY);
      if (!lower || !upper) throw new Error(`section ${fixture.sectionIndex} wheel fixture missing`);
      const player = createPlayer(fixture.startX, lower.y - PLAYER_SIZE);
      player.onGround = true;
      const simulation = sectionSimulation(section, player);
      const wheel = simulation.entities.find((entity): entity is WaterWheelEntity => entity instanceof WaterWheelEntity);
      if (!wheel) throw new Error(`section ${fixture.sectionIndex} wheel missing`);
      let boarded = false;
      let carryFrames = 0;
      let dismounting = false;
      let jumpUsed = false;
      let safe = true;
      let landed = false;

      for (let frame = 0; frame < 720; frame += 1) {
        if (boarded && carryFrames > 30 && player.y + player.h <= upper.y + 30) dismounting = true;
        const targetX = dismounting ? upper.x + upper.w / 2 : wheel.def.x;
        const direction = Math.sign(targetX - (player.x + player.w / 2)) as -1 | 0 | 1;
        const jumpPressed = !boarded ? frame === 0 : dismounting && !jumpUsed;
        if (dismounting && !jumpUsed) jumpUsed = true;
        safe &&= simulation.step(input({
          moveX: boarded && !dismounting ? 0 : frame < 60 || dismounting ? direction : 0,
          jump: !boarded ? frame < 42 : dismounting,
          jumpPressed,
        }));
        const onWheel = wheel.dynamicSolids().some((solid) => landedOn(player, solid.box));
        boarded ||= onWheel;
        if (simulation.carriedBy === wheel) carryFrames += 1;
        if (boarded && landedOn(player, upper)) {
          landed = true;
          break;
        }
      }

      expect(safe, `section ${fixture.sectionIndex} wheel safe`).toBe(true);
      expect(boarded, `section ${fixture.sectionIndex} wheel boarded`).toBe(true);
      expect(carryFrames, `section ${fixture.sectionIndex} wheel carry`).toBeGreaterThan(30);
      expect(landed, `section ${fixture.sectionIndex} wheel dismount ${JSON.stringify({ x: player.x, y: player.y })}`).toBe(true);
    }
  });

  it('has no production ordinary-jump bypass around crates or either wheel transfer', () => {
    const fixtures = [
      { sectionIndex: 2, lowerY: 660, upperY: 430, excluded: 'crate' as const },
      { sectionIndex: 3, lowerY: 660, upperY: 380, excluded: 'wheel' as const },
      { sectionIndex: 6, lowerY: 510, upperY: 330, excluded: 'wheel' as const },
    ];

    for (const fixture of fixtures) {
      const section = STAGE_03_AQUEDUCT.sections[fixture.sectionIndex];
      const lower = routePlatforms(section).find((solid) => solid.y === fixture.lowerY);
      const upper = routePlatforms(section).find((solid) => solid.y === fixture.upperY);
      if (!lower || !upper) throw new Error(`section ${fixture.sectionIndex} bypass fixture missing`);
      let bypassed = false;
      const startXs = Array.from({ length: 9 }, (_, index) => lower.x + (lower.w - PLAYER_SIZE) * index / 8);

      attempts: for (const startX of startXs) {
        for (const runDirection of [-1, 1] as const) {
          for (const jumpFrame of [0, 12, 24, 36]) {
            for (const steerDirection of [-1, 0, 1] as const) {
              for (const jumpHold of [1, 30, 60]) {
                const player = createPlayer(startX, lower.y - PLAYER_SIZE);
                player.onGround = true;
                const simulation = sectionSimulation(
                  section,
                  player,
                  0,
                  (entity) => fixture.excluded === 'wheel'
                    ? !(entity instanceof WaterWheelEntity)
                    : entity.dynamicSolids().length === 0,
                );
                for (let frame = 0; frame < 180; frame += 1) {
                  const jumping = frame >= jumpFrame && frame < jumpFrame + jumpHold;
                  simulation.step(input({
                    moveX: frame < jumpFrame + 18 ? runDirection : steerDirection,
                    jump: jumping,
                    jumpPressed: frame === jumpFrame,
                  }));
                  if (landedOn(player, upper)) {
                    bypassed = true;
                    break attempts;
                  }
                }
              }
            }
          }
        }
      }

      expect(bypassed, `section ${fixture.sectionIndex} ${fixture.excluded} bypass`).toBe(false);
    }
  });

  it('hands Clockwork and every Aqueduct section directly to the next broad runway', () => {
    const previousStages = [STAGE_02_CLOCKWORK.sections.at(-1)!, ...STAGE_03_AQUEDUCT.sections.slice(0, -1)];
    for (let index = 0; index < STAGE_03_AQUEDUCT.sections.length; index += 1) {
      const previous = previousStages[index];
      const next = STAGE_03_AQUEDUCT.sections[index];
      const topY = Math.min(...routePlatforms(previous).filter((solid) => solid.role === 'main').map((solid) => solid.y));
      const exits = routePlatforms(previous).filter((solid) => solid.role === 'main' && solid.y === topY);
      const entrance = runway(next);
      expect(entrance, `handoff ${index} runway`).toBeDefined();
      expect(Math.max(...exits.map((exit) => overlapWidth(exit, entrance!))), `handoff ${index} overlap`).toBeGreaterThanOrEqual(120);
      expect(previous.height + topY - entrance!.y, `handoff ${index} rise`).toBeGreaterThanOrEqual(90);
      expect(previous.height + topY - entrance!.y, `handoff ${index} rise`).toBeLessThanOrEqual(120);
    }
  });
});
