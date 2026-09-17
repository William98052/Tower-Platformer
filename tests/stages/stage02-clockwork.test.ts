import { describe, expect, it } from 'vitest';
import { STEP } from '../../src/core/constants';
import type { InputFrame } from '../../src/core/input';
import type { Entity } from '../../src/entities/entity';
import { createEntities } from '../../src/entities/factory';
import { GearEntity, gearBoxAt } from '../../src/entities/gear';
import { carryStandingPlayer } from '../../src/entities/interactions';
import { PistonEntity } from '../../src/entities/piston';
import { TimedDoorEntity } from '../../src/entities/timed-door';
import { overlaps } from '../../src/physics/aabb';
import { createPlayer, stepPlayer, type Player } from '../../src/physics/player';
import { pushOutPlayer } from '../../src/physics/collision';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { STAGE_02_CLOCKWORK } from '../../src/stages/stage02-clockwork';
import type { EntityDef, SectionDef, SolidDef } from '../../src/stages/types';
import { validateStage } from '../../src/stages/world';
import { input } from '../helpers/input';

const PLAYER_SIZE = 28;
const SHELL_LEFT = 24;
const SHELL_RIGHT = 936;

function routePlatforms(section: SectionDef): SolidDef[] {
  return section.solids.filter((solid) => solid.role !== 'boundary');
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

function landedOn(player: Player, target: SolidDef): boolean {
  return player.onGround
    && Math.abs(player.y + player.h - target.y) <= 1
    && player.x + player.w > target.x
    && player.x < target.x + target.w;
}

function approachX(start: SolidDef, target: SolidDef, direction: -1 | 1): number {
  return direction < 0
    ? Math.max(start.x, Math.min(start.x + start.w - PLAYER_SIZE, target.x + target.w + 36))
    : Math.min(start.x + start.w - PLAYER_SIZE, Math.max(start.x, target.x - PLAYER_SIZE - 36));
}

interface SectionSimulation {
  entities: Entity[];
  player: Player;
  time: number;
  step(frameInput: InputFrame): { carriedBy: Entity | null; safe: boolean };
}

function sectionSimulation(section: SectionDef, player: Player, startTime: number, include: (entity: Entity) => boolean = () => true): SectionSimulation {
  const entities = createEntities(section.entities).filter(include);
  const simulation: SectionSimulation = {
    entities,
    player,
    time: startTime,
    step(frameInput) {
      simulation.time += STEP;
      for (const entity of entities) entity.update(simulation.time, STEP);
      const moving = entities.flatMap((entity) => entity.dynamicSolids().map((solid) => ({ entity, solid })));
      const solids = [...section.solids, ...moving.map(({ solid }) => solid.box)];

      let carriedBy: Entity | null = null;
      for (const { entity, solid } of moving) {
        if (!carryStandingPlayer(player, solid, solids)) continue;
        carriedBy = entity;
        break;
      }
      stepPlayer(player, frameInput, solids);

      for (const { solid } of moving) {
        if (!pushOutPlayer(player, solid.box, solids.filter((blocker) => blocker !== solid.box))) {
          return { carriedBy, safe: false };
        }
      }
      for (const entity of entities) {
        const contact = entity.collide(player);
        if (contact.kind !== 'push') continue;
        const shoved = { x: player.x + contact.dx, y: player.y + contact.dy, w: player.w, h: player.h };
        if (!solids.some((solid) => overlaps(shoved, solid))) {
          player.x = shoved.x;
          player.y = shoved.y;
        }
        if (!pushOutPlayer(player, entity.bounds(), solids)) return { carriedBy, safe: false };
      }
      return { carriedBy, safe: true };
    },
  };
  return simulation;
}

interface GearTransfer {
  section: number;
  gear: number;
  lowerY: number;
  upperY: number;
  board: -1 | 1;
  dismount: -1 | 1;
  boardFrames?: number;
  boardLead?: number;
  dismountDuration?: number;
  prepareDismount?: boolean;
  prepareLead?: number;
}

function simulateGearTransfer(transfer: GearTransfer): { boarded: boolean; carryFrames: number; landed: boolean; safe: boolean; final: { x: number; y: number; onGround: boolean } } {
  const section = STAGE_02_CLOCKWORK.sections[transfer.section];
  const def = section.entities.filter((entity) => entity.type === 'gear')[transfer.gear];
  const lower = routePlatforms(section).find((solid) => solid.role === 'main' && solid.y === transfer.lowerY);
  const upper = routePlatforms(section).find((solid) => solid.role === 'main' && solid.y === transfer.upperY);
  if (!def || !lower || !upper) throw new Error(`gear transfer fixture ${transfer.section}:${transfer.gear} missing`);

  const lowBase = ((0.5 - def.phase + 1) % 1) * def.period;
  const lowTime = lowBase === 0 ? def.period : lowBase;
  const highTime = lowTime + def.period / 2;
  const startTime = lowTime - (transfer.boardLead ?? 0.45);
  const boardingApproach = gearBoxAt(def, startTime) as SolidDef;
  const player = createPlayer(approachX(lower, boardingApproach, transfer.board), lower.y - PLAYER_SIZE);
  player.onGround = true;
  const simulation = sectionSimulation(section, player, startTime);
  const gear = simulation.entities.filter((entity): entity is GearEntity => entity instanceof GearEntity)[transfer.gear];

  let boarded = false;
  let carryFrames = 0;
  let dismountAt: number | null = null;
  let safe = true;
  const endTime = highTime + 1.25;
  for (let frame = 0; simulation.time < endTime; frame += 1) {
    if (boarded && dismountAt === null && simulation.time >= highTime - 0.5) dismountAt = simulation.time;
    const dismountElapsed = dismountAt === null ? -1 : simulation.time - dismountAt;
    const dismounting = dismountElapsed >= 0 && dismountElapsed < (transfer.dismountDuration ?? 1);
    const positioning = transfer.prepareDismount && boarded && dismountAt === null
      && simulation.time >= highTime - (transfer.prepareLead ?? 0.8);
    const frameInput = !boarded
      ? input({ moveX: frame < (transfer.boardFrames ?? 42) ? transfer.board : 0, jump: frame < 42, jumpPressed: frame === 0 })
      : dismounting
        ? input({ moveX: transfer.dismount, jump: dismountElapsed < 0.25, jumpPressed: dismountElapsed < STEP })
        : positioning
          ? input({ moveX: transfer.dismount })
          : input();
    const result = simulation.step(frameInput);
    safe &&= result.safe;
    if (result.carriedBy === gear) carryFrames += 1;
    const box = gear.dynamicSolids()[0].box as SolidDef;
    if (!boarded && landedOn(player, box)) boarded = true;
    if (boarded && landedOn(player, upper)) {
      return { boarded, carryFrames, landed: true, safe, final: { x: player.x, y: player.y, onGround: player.onGround } };
    }
  }
  return { boarded, carryFrames, landed: false, safe, final: { x: player.x, y: player.y, onGround: player.onGround } };
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

      const spawnMachinery = createEntities(section.entities).flatMap((entity) => entity.dynamicSolids());
      expect(spawnMachinery.some((solid) => overlaps(spawn, solid.box)), `section ${section.id} spawn-phase machinery`).toBe(false);
    }
  });

  it('keeps every collision platform on one classified route or its single useful recovery path', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      const platforms = routePlatforms(section);
      expect(platforms.every((solid) => solid.role === 'main' || solid.role === 'recovery'), `section ${section.id} classified`).toBe(true);
      expect(platforms.every((solid) => solid.h === 16), `section ${section.id} platform thickness`).toBe(true);

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
          const connector = section.entities.find((entity) => (
            ((entity.type === 'timedDoor'
              && level >= entity.y - entity.h
              && level <= entity.y + entity.h)
              || (entity.type === 'piston'
                && (entity.w === gapWidth || (entity.axis === 'x' && entity.w + entity.travel === gapWidth))))
            && entity.x === gapStart
          ));
          expect(connector, `section ${section.id} route gap at ${level}`).toBeDefined();
        }
      }
    }
  });

  it('continuously boards, carries, and dismounts every required gear against full section geometry', () => {
    const transfers = [
      { section: 2, gear: 0, lowerY: 660, upperY: 360, board: -1 as const, dismount: -1 as const },
      { section: 2, gear: 1, lowerY: 360, upperY: 70, board: 1 as const, dismount: 1 as const, boardFrames: 24 },
      { section: 5, gear: 0, lowerY: 535, upperY: 377, board: -1 as const, dismount: -1 as const },
      { section: 5, gear: 1, lowerY: 377, upperY: 219, board: 1 as const, dismount: 1 as const },
      { section: 6, gear: 0, lowerY: 535, upperY: 330, board: -1 as const, dismount: 1 as const, boardFrames: 60, boardLead: 0.15, dismountDuration: 0.45, prepareDismount: true, prepareLead: 0.525 },
    ];

    for (const transfer of transfers) {
      const result = simulateGearTransfer(transfer);
      expect(result.safe, `section ${transfer.section} gear ${transfer.gear} safe`).toBe(true);
      expect(result.boarded, `section ${transfer.section} gear ${transfer.gear} boarded ${JSON.stringify(result.final)}`).toBe(true);
      expect(result.carryFrames, `section ${transfer.section} gear ${transfer.gear} carry`).toBeGreaterThan(60);
      expect(result.landed, `section ${transfer.section} gear ${transfer.gear} dismount ${JSON.stringify(result.final)}`).toBe(true);
    }
  });

  it('cannot dry-jump the first Machine Climb gear gate with production movement', () => {
    const climb = STAGE_02_CLOCKWORK.sections[5];
    const conveyorFloor = routePlatforms(climb).find((solid) => solid.y === 535);
    const firstLanding = routePlatforms(climb).find((solid) => solid.y === 377);
    if (!conveyorFloor || !firstLanding) throw new Error('machine-climb dry-jump fixture missing');

    const player = createPlayer(conveyorFloor.x, conveyorFloor.y - PLAYER_SIZE);
    player.onGround = true;
    const simulation = sectionSimulation(climb, player, 0, (entity) => !(entity instanceof GearEntity));
    let landed = false;
    for (let frame = 0; frame < 180; frame += 1) {
      simulation.step(input({
        moveX: frame < 90 ? -1 : 0,
        jump: frame < 48,
        jumpPressed: frame === 0,
      }));
      landed ||= landedOn(player, firstLanding);
    }
    expect(landed).toBe(false);
  });

  it('continuously boards and rides the Machine Climb piston to its exit', () => {
    const climb = STAGE_02_CLOCKWORK.sections[5];
    const lower = routePlatforms(climb).find((solid) => solid.y === 219);
    const exit = routePlatforms(climb).find((solid) => solid.y === 60 && solid.x === 640);
    if (!lower || !exit) throw new Error('machine-climb piston fixture missing');

    const player = createPlayer(510, lower.y - PLAYER_SIZE);
    player.onGround = true;
    const simulation = sectionSimulation(climb, player, 1.3);
    const lift = simulation.entities.find((entity): entity is PistonEntity => entity instanceof PistonEntity);
    if (!lift) throw new Error('machine-climb piston missing');

    let boarded = false;
    let carryFrames = 0;
    let landed = false;
    let safe = true;
    for (let frame = 0; frame < 220; frame += 1) {
      const onLift = lift.dynamicSolids().some((solid) => landedOn(player, solid.box as SolidDef));
      boarded ||= onLift;
      const readyToExit = boarded && simulation.time >= 1.84;
      const result = simulation.step(!boarded
        ? input({ moveX: 1, jump: frame < 30, jumpPressed: frame === 0 })
        : readyToExit
          ? input({ moveX: 1, jump: simulation.time < 2.09, jumpPressed: simulation.time < 1.84 + STEP })
          : input());
      safe &&= result.safe;
      if (result.carriedBy === lift) carryFrames += 1;
      if (landedOn(player, exit)) {
        landed = true;
        break;
      }
    }
    expect(safe).toBe(true);
    expect(boarded).toBe(true);
    expect(carryFrames).toBeGreaterThan(20);
    expect(landed, JSON.stringify({ x: player.x, y: player.y, onGround: player.onGround })).toBe(true);
  });

  it('continuously rides the Finale bridge piston and passes its piston-door gate', () => {
    const finale = STAGE_02_CLOCKWORK.sections[6];
    const left = routePlatforms(finale).find((solid) => solid.y === 330 && solid.x === 200);
    const far = routePlatforms(finale).find((solid) => solid.y === 330 && solid.x === 776);
    if (!left || !far) throw new Error('finale piston fixture missing');

    const player = createPlayer(250, left.y - PLAYER_SIZE);
    player.onGround = true;
    const simulation = sectionSimulation(finale, player, 0.8);
    const pistons = simulation.entities.filter((entity): entity is PistonEntity => entity instanceof PistonEntity);
    const bridge = pistons.find((entity) => entity.def.axis === 'x');
    if (!bridge) throw new Error('finale bridge piston missing');

    let boarded = false;
    let carryFrames = 0;
    let crossed = false;
    let safe = true;
    for (let frame = 0; frame < 420; frame += 1) {
      const onBridge = bridge.dynamicSolids().some((solid) => landedOn(player, solid.box as SolidDef));
      boarded ||= onBridge;
      const crossing = simulation.time >= 1.72;
      const result = simulation.step(input({ moveX: crossing || !boarded ? 1 : 0 }));
      safe &&= result.safe;
      if (result.carriedBy === bridge) carryFrames += 1;
      if (landedOn(player, far)) {
        crossed = true;
        break;
      }
    }
    expect(safe).toBe(true);
    expect(boarded).toBe(true);
    expect(carryFrames).toBeGreaterThan(8);
    expect(crossed, JSON.stringify({ x: player.x, y: player.y, onGround: player.onGround })).toBe(true);
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

  it('keeps every sampled timed-door transition inside its shaft and clear of all landings', () => {
    for (const section of STAGE_02_CLOCKWORK.sections) {
      const platforms = routePlatforms(section);
      for (const door of section.entities.filter((entity) => entity.type === 'timedDoor')) {
        const entity = new TimedDoorEntity(door);
        for (let frame = 0; frame <= 3 / STEP; frame += 1) {
          entity.update(frame * STEP, STEP);
          for (const moving of entity.dynamicSolids()) {
            expect(platforms.some((solid) => overlaps(moving.box, solid)), `section ${section.id} door sweep frame ${frame}`).toBe(false);
          }
        }

        const floorY = door.y + door.h;
        const leftWait = platforms.find((solid) => solid.role === 'main' && solid.y === floorY && solid.x + solid.w === door.x);
        const rightWait = platforms.find((solid) => solid.role === 'main' && solid.y === floorY && solid.x === door.x + door.w);
        expect(leftWait?.w, `section ${section.id} left door wait`).toBeGreaterThanOrEqual(160);
        expect(rightWait?.w, `section ${section.id} right door wait`).toBeGreaterThanOrEqual(160);
      }
    }
  });

  it('structurally gates the timed-door corridor, piston climb, and finale machinery sequence', () => {
    const gates = STAGE_02_CLOCKWORK.sections[4];
    const gateDoors = gates.entities.filter((entity) => entity.type === 'timedDoor').sort((a, b) => b.x - a.x);
    const gateFloors = routePlatforms(gates).filter((solid) => solid.y === 660).sort((a, b) => a.x - b.x);
    const gateCeiling = routePlatforms(gates).filter((solid) => solid.y === 560).sort((a, b) => a.x - b.x);
    expect(gateDoors).toHaveLength(3);
    expect(new Set(gateDoors.map((door) => door.y + door.h))).toEqual(new Set([660]));
    expect(gates.checkpoint.x).toBeGreaterThan(gateDoors[0].x + gateDoors[0].w);
    expect(gateFloors).toHaveLength(4);
    expect(gateCeiling).toHaveLength(4);
    const rightCeiling = gateCeiling.at(-1);
    expect((rightCeiling?.x ?? 0) + (rightCeiling?.w ?? 0)).toBe(SHELL_RIGHT);
    expect(gateCeiling[0].x - SHELL_LEFT).toBeGreaterThanOrEqual(PLAYER_SIZE);
    for (const door of gateDoors) {
      expect(gateFloors.some((floor) => floor.x + floor.w === door.x)).toBe(true);
      expect(gateFloors.some((floor) => floor.x === door.x + door.w)).toBe(true);
      expect(gateCeiling.some((floor) => floor.x + floor.w === door.x)).toBe(true);
      expect(gateCeiling.some((floor) => floor.x === door.x + door.w)).toBe(true);
      expect(door.y - (560 + 16)).toBeLessThan(PLAYER_SIZE);
    }

    const climb = STAGE_02_CLOCKWORK.sections[5];
    const climbLevels = [...new Set(routePlatforms(climb).filter((solid) => solid.role === 'main').map((solid) => solid.y))]
      .sort((a, b) => b - a);
    expect(climbLevels).toEqual([660, 535, 377, 219, 60]);
    expect(climbLevels.slice(1).map((level, index) => climbLevels[index] - level)).toEqual([125, 158, 158, 159]);
    const lift = climb.entities.find((entity) => entity.type === 'piston');
    expect(lift).toMatchObject({ type: 'piston', axis: 'y', y: 76, travel: 119 });
    if (!lift || lift.type !== 'piston') throw new Error('machine-climb piston missing');
    const topRow = routePlatforms(climb).filter((solid) => solid.y === 60).sort((a, b) => a.x - b.x);
    expect(topRow.map((solid) => [solid.x, solid.x + solid.w])).toEqual([[300, lift.x], [lift.x + lift.w, 920]]);

    const finale = STAGE_02_CLOCKWORK.sections[6];
    const finalePlatforms = routePlatforms(finale).filter((solid) => solid.role === 'main');
    const [horizontal, vertical] = finale.entities.filter((entity) => entity.type === 'piston');
    expect(horizontal).toMatchObject({ type: 'piston', axis: 'x', x: 300, w: 80, travel: 201 });
    expect(vertical).toMatchObject({ type: 'piston', axis: 'y', x: 630, y: 221, h: 81, travel: 28 });
    if (horizontal?.type !== 'piston' || vertical?.type !== 'piston') throw new Error('finale pistons missing');
    const bridgeLeft = finalePlatforms.find((solid) => solid.y === 330 && solid.x + solid.w === horizontal.x);
    const bridgeRight = finalePlatforms.find((solid) => solid.y === 330 && solid.x === horizontal.x + horizontal.travel + horizontal.w);
    expect(airGap(bridgeLeft as SolidDef, bridgeRight as SolidDef)).toBeGreaterThan(280);
    const finalDoor = finale.entities.find((entity) => entity.type === 'timedDoor');
    expect(finalDoor).toMatchObject({ type: 'timedDoor', x: 752, y: 246, h: 84 });
    expect(finalePlatforms.some((solid) => solid.y === 205 && solid.x + solid.w === finalDoor?.x)).toBe(true);
    expect(finalePlatforms.some((solid) => solid.y === 205 && solid.x === (finalDoor?.x ?? 0) + (finalDoor?.w ?? 0))).toBe(true);
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
      expect(highestY, `section ${section.id} exit height`).toBe(section.id === 5 ? 60 : 70);

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
