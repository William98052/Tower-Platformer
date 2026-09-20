import { describe, expect, it } from 'vitest';
import { STEP } from '../../src/core/constants';
import { createEntities } from '../../src/entities/factory';
import { SinkingCrateEntity } from '../../src/entities/sinking-crate';
import { WaterWheelEntity } from '../../src/entities/water-wheel';
import { type AABB, overlaps } from '../../src/physics/aabb';
import { Game } from '../../src/game/game';
import { createPlayer } from '../../src/physics/player';
import { STAGE_02_CLOCKWORK } from '../../src/stages/stage02-clockwork';
import { STAGE_03_AQUEDUCT } from '../../src/stages/stage03-aqueduct';
import type { EntityDef, SectionDef, SolidDef } from '../../src/stages/types';
import { validateStage } from '../../src/stages/world';
import { input } from '../helpers/input';
import {
  type Candidate,
  PLAYER_SIZE,
  type Policy,
  SectionSim,
  type WaterDef,
  dryRunway,
  jumpCandidates,
  landedOn,
  reachablePlatforms,
  routePlatforms,
  searchLeg,
  shiftBox,
  stackSections,
  standingOn,
  swimCandidates,
  swimPolicy,
  waters,
} from '../helpers/section-sim';

type CrateDef = Extract<EntityDef, { type: 'sinkingCrate' }>;
type WheelDef = Extract<EntityDef, { type: 'waterWheel' }>;

const SECTIONS = STAGE_03_AQUEDUCT.sections;
const WHEEL_PERIOD = 5;

function signature(section: SectionDef): string[] {
  const result: string[] = [];
  for (const type of ['water', 'sinkingCrate', 'waterWheel'] as const) {
    if (section.entities.some((entity) => entity.type === type)) result.push(type);
  }
  return result;
}

function crates(section: SectionDef): CrateDef[] {
  return section.entities.filter((entity): entity is CrateDef => entity.type === 'sinkingCrate');
}

function wheels(section: SectionDef): WheelDef[] {
  return section.entities.filter((entity): entity is WheelDef => entity.type === 'waterWheel');
}

function exits(section: SectionDef): SolidDef[] {
  const main = routePlatforms(section).filter((solid) => solid.role === 'main');
  const topY = Math.min(...main.map((solid) => solid.y));
  return main.filter((solid) => solid.y === topY);
}

function overlapWidth(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
}

function horizontalGap(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
}

/** A surface-level bank beside (or reaching over) the water, or the dry floor the pool rests on. */
function isWaterExit(field: WaterDef, solid: SolidDef): boolean {
  if (solid.role !== 'main' || solid.w < 160) return false;
  const beside = solid.x <= field.x + field.w + PLAYER_SIZE && solid.x + solid.w >= field.x - PLAYER_SIZE;
  if (Math.abs(solid.y - field.y) <= 20 && beside) return true;
  const dryFloor = solid.w - overlapWidth(solid, field);
  return solid.y === field.y + field.h && beside && dryFloor >= 160;
}

function wheelPaddlesAt(def: WheelDef, t: number): AABB[] {
  const base = Math.PI * 2 * (t / WHEEL_PERIOD + def.phase);
  return Array.from({ length: 4 }, (_, index) => {
    const angle = base + index * Math.PI / 2;
    return {
      x: def.x + Math.sin(angle) * def.radius - def.paddleW / 2,
      y: def.y - Math.cos(angle) * def.radius - def.paddleH / 2,
      w: def.paddleW,
      h: def.paddleH,
    };
  });
}

function sampleTimes(period: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => period * index / count);
}

type Target = (sim: SectionSim) => AABB;

type Leg =
  | { kind: 'jump'; to: Target; fixed?: SolidDef; dash?: boolean }
  | { kind: 'swim'; to: Target; fixed?: SolidDef; riseXs: number[] }
  | { kind: 'board' }
  | { kind: 'ride'; to: Target; fixed: SolidDef }
  | { kind: 'rideSwim'; to: Target; fixed: SolidDef; riseXs: number[] };

function fixedAt(section: SectionDef, x: number, y: number): SolidDef {
  const solid = routePlatforms(section).find((candidate) => candidate.x === x && candidate.y === y);
  if (!solid) throw new Error(`section ${section.id} has no platform at ${x},${y}`);
  return solid;
}

function crateTarget(section: SectionDef, index: number): Target {
  const def = crates(section)[index];
  return (sim) => {
    const entity = sim.entities.find((candidate): candidate is SinkingCrateEntity => (
      candidate instanceof SinkingCrateEntity && candidate.def.x === def.x && candidate.def.y === def.y
    ));
    if (!entity) throw new Error(`section ${section.id} crate ${index} missing`);
    return entity.dynamicSolids()[0].box;
  };
}

function wheelEntity(sim: SectionSim, def: WheelDef): WaterWheelEntity {
  const entity = sim.entities.find((candidate): candidate is WaterWheelEntity => (
    candidate instanceof WaterWheelEntity && candidate.def.x === def.x && candidate.def.y === def.y
  ));
  if (!entity) throw new Error('wheel missing');
  return entity;
}

function jump(section: SectionDef, x: number, y: number, dash = false): Leg {
  const solid = fixedAt(section, x, y);
  return { kind: 'jump', to: () => solid, fixed: solid, dash };
}

function swim(section: SectionDef, x: number, y: number, riseXs: number[]): Leg {
  const solid = fixedAt(section, x, y);
  return { kind: 'swim', to: () => solid, fixed: solid, riseXs };
}

function nextRunway(index: number): Leg | null {
  const next = SECTIONS[index + 1];
  if (!next) return null;
  const runway = shiftBox(dryRunway(next)!.solid, -next.height);
  return { kind: 'jump', to: () => runway };
}

/** The intended bottom-to-top route of every section, ending on the next section's runway. */
const ROUTES: Leg[][] = SECTIONS.map((section, index) => {
  const legs: Leg[] = (() => {
    switch (index) {
      case 0: return [
        swim(section, 400, 300, [380, 420, 360]),
        jump(section, 640, 160),
        jump(section, 360, 90),
        jump(section, 24, 70),
      ];
      case 1: return [
        swim(section, 500, 330, [470, 480, 460, 490]),
        jump(section, 360, 250, true),
        jump(section, 440, 200),
        swim(section, 720, 70, [700, 690, 680, 710]),
      ];
      case 2: return [
        { kind: 'jump', to: crateTarget(section, 0) },
        { kind: 'jump', to: crateTarget(section, 1) },
        { kind: 'jump', to: crateTarget(section, 2) },
        jump(section, 200, 260),
        jump(section, 480, 165),
        jump(section, 720, 70),
      ];
      case 3: {
        const bank = fixedAt(section, 24, 345);
        return [
          { kind: 'board' },
          { kind: 'ride', to: () => bank, fixed: bank },
          jump(section, 440, 210),
          jump(section, 700, 70),
        ];
      }
      case 4: return [
        swim(section, 24, 370, [260, 300, 380]),
        { kind: 'jump', to: crateTarget(section, 0) },
        { kind: 'jump', to: crateTarget(section, 1) },
        jump(section, 570, 70),
      ];
      case 5: return [
        swim(section, 40, 300, [240, 250, 260, 80]),
        jump(section, 80, 90, true),
        swim(section, 720, 70, [300, 320, 700, 740]),
      ];
      default: {
        const exit = fixedAt(section, 560, 70);
        return [
          { kind: 'swim', to: crateTarget(section, 0), riseXs: [320, 340, 300] },
          { kind: 'jump', to: crateTarget(section, 1) },
          jump(section, 40, 490),
          { kind: 'board' },
          { kind: 'rideSwim', to: () => exit, fixed: exit, riseXs: [580, 620, 540] },
        ];
      }
    }
  })();
  const handoff = nextRunway(index);
  return handoff ? [...legs, handoff] : legs;
});

function* boardCandidates(sim: SectionSim, def: WheelDef): Generator<Candidate> {
  const support = sim.support();
  const low = support ? support.x : sim.player.x;
  const high = support ? support.x + support.w - PLAYER_SIZE : sim.player.x;
  const xs = [0, 40, -40, 80].map((offset) => Math.max(low, Math.min(high, def.x - PLAYER_SIZE / 2 + offset)));
  for (let wait = 0; wait <= WHEEL_PERIOD * 120; wait += 4) {
    for (const approachX of xs) {
      for (const moveX of [0, -1, 1] as const) {
        yield {
          label: `board ${JSON.stringify({ approachX, wait, moveX })}`,
          maxFrames: 150 + wait + 120,
          make: (): Policy => {
            let phase: 'approach' | 'wait' | 'jump' = 'approach';
            let start = 0;
            return (branch, frame) => {
              if (phase === 'approach') {
                const delta = approachX - branch.player.x;
                if (Math.abs(delta) > 2 && frame < 150) return input({ moveX: Math.sign(delta) as -1 | 1 });
                phase = 'wait';
                start = frame;
              }
              if (phase === 'wait') {
                if (frame - start < wait) return input();
                phase = 'jump';
                start = frame;
              }
              const k = frame - start;
              return input({ moveX, jump: k < 60, jumpPressed: k === 0 });
            };
          },
        };
      }
    }
  }
}

function* rideCandidates(def: WheelDef, bank: SolidDef): Generator<Candidate> {
  for (const lead of [0, 10, 20, 35, 50, -10]) {
    for (const hop of [false, true]) {
      yield {
        label: `ride ${JSON.stringify({ lead, hop })}`,
        maxFrames: WHEEL_PERIOD * 120 * 2,
        make: (): Policy => {
          let dismountAt = -1;
          return (branch, frame) => {
            const { player } = branch;
            const paddle = wheelEntity(branch, def).dynamicSolids().find((solid) => landedOn(player, solid.box))?.box;
            const bankCenter = bank.x + bank.w / 2;
            const towardBank = Math.sign(bankCenter - (player.x + PLAYER_SIZE / 2)) as -1 | 1;
            if (dismountAt < 0 && paddle && paddle.y <= bank.y + lead) dismountAt = frame;
            if (dismountAt >= 0) {
              return input({ moveX: towardBank, jump: hop && frame - dismountAt < 20, jumpPressed: hop && frame === dismountAt });
            }
            const underBank = player.x < bank.x + bank.w + 2 && player.x + PLAYER_SIZE > bank.x - 2;
            return input({ moveX: underBank ? -towardBank as -1 | 1 : 0 });
          };
        },
      };
    }
  }
}

function* rideSwimCandidates(exit: AABB, riseXs: number[]): Generator<Candidate> {
  for (const riseX of riseXs) {
    for (const cadence of [27, 34]) {
      yield {
        label: `ride+swim ${JSON.stringify({ riseX, cadence })}`,
        maxFrames: WHEEL_PERIOD * 120 * 2,
        make: (): Policy => {
          const swimming = swimPolicy(() => exit, { riseX, cadence });
          let entered = false;
          return (branch, frame) => {
            entered ||= branch.inWater();
            return entered ? swimming(branch, frame) : input();
          };
        },
      };
    }
  }
}

interface RouteResult { completed: number; total: number; trace: string[]; final: { x: number; y: number }; inputs: SectionSim['inputs'] }

const routeCache = new Map<number, RouteResult>();

function route(index: number): RouteResult {
  if (!routeCache.has(index)) routeCache.set(index, runRoute(index));
  return routeCache.get(index)!;
}

function runRoute(index: number): RouteResult {
  const section = SECTIONS[index];
  const next = SECTIONS[index + 1];
  const world = next ? stackSections(section, next) : section;
  let sim = new SectionSim(world, createPlayer(section.checkpoint.x, section.checkpoint.y));
  for (let frame = 0; frame < 120 && !sim.player.onGround; frame += 1) sim.step(input());
  const trace: string[] = [];
  const legs = ROUTES[index];
  const wheelDef = wheels(section)[0];
  for (const [legIndex, leg] of legs.entries()) {
    let result;
    if (leg.kind === 'jump') {
      result = searchLeg(sim, jumpCandidates(sim, () => leg.to(sim), { dash: leg.dash }), (branch) => landedOn(branch.player, leg.to(branch)));
    } else if (leg.kind === 'swim') {
      result = searchLeg(sim, swimCandidates(leg.to, leg.riseXs), (branch) => landedOn(branch.player, leg.to(branch)));
    } else if (leg.kind === 'board') {
      result = searchLeg(sim, boardCandidates(sim, wheelDef), (branch) => (
        wheelEntity(branch, wheelDef).dynamicSolids().some((solid) => landedOn(branch.player, solid.box))
      ));
    } else if (leg.kind === 'ride') {
      result = searchLeg(sim, rideCandidates(wheelDef, leg.fixed), (branch) => landedOn(branch.player, leg.fixed));
    } else {
      result = searchLeg(sim, rideSwimCandidates(leg.fixed, leg.riseXs), (branch) => landedOn(branch.player, leg.fixed));
    }
    trace.push(`${legIndex} ${leg.kind} ${result.ok ? result.label : 'FAILED'} (${result.tried} tried)`);
    if (!result.ok) return { completed: legIndex, total: legs.length, trace, final: { x: sim.player.x, y: sim.player.y }, inputs: sim.inputs };
    sim = result.sim;
  }
  return { completed: legs.length, total: legs.length, trace, final: { x: sim.player.x, y: sim.player.y }, inputs: sim.inputs };
}

describe('STAGE_03_AQUEDUCT', () => {
  it('defines the seven-section Sunken Aqueduct mechanic progression', () => {
    expect(STAGE_03_AQUEDUCT).toMatchObject({ id: 3, name: 'Sunken Aqueduct' });
    expect(SECTIONS).toHaveLength(7);
    expect(SECTIONS.map((section) => section.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(validateStage(STAGE_03_AQUEDUCT)).toEqual([]);
    expect(SECTIONS.map(signature)).toEqual([
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
    const [intro, currents, crateBasin, wheel, vertical, switchback, finale] = SECTIONS;
    expect(waters(intro).map((field) => [field.currentX, field.currentY])).toEqual([[0, 0]]);
    expect(waters(currents).map((field) => [field.currentX, field.currentY])).toEqual([[260, 0], [-260, 0]]);
    const canalSwims = ROUTES[1].filter((leg): leg is Extract<Leg, { kind: 'swim' }> => leg.kind === 'swim');
    expect(canalSwims).toHaveLength(2);
    const firstBank = canalSwims[0].fixed!;
    const secondExit = canalSwims[1].fixed!;
    const secondEnter = ROUTES[1].slice(0, ROUTES[1].indexOf(canalSwims[1]))
      .filter((leg): leg is Leg & { fixed: SolidDef } => 'fixed' in leg && leg.fixed !== undefined)
      .at(-1)!.fixed;
    expect(firstBank.x, '+260 canal is a rightward assisting swim').toBeGreaterThan(dryRunway(currents)!.solid.x);
    expect(secondExit.x, '−260 canal is a rightward opposing swim').toBeGreaterThan(secondEnter.x);
    expect(crates(crateBasin)).toHaveLength(3);
    expect(wheels(wheel)).toHaveLength(1);
    expect(crates(vertical)).toHaveLength(2);
    expect(waters(vertical).map((field) => [field.currentX, field.currentY])).toEqual([[0, -420]]);
    expect(waters(switchback)).toHaveLength(2);
    expect(crates(finale)).toHaveLength(2);
    expect(wheels(finale)).toHaveLength(1);
    expect(waters(finale).map((field) => [field.currentX, field.currentY])).toEqual([[420, 0], [0, -420]]);
  });

  it('does not hang a platform over a checkpoint spawn within ordinary jump height', () => {
    const jumpClearance = 200;
    for (const section of SECTIONS) {
      const runway = dryRunway(section);
      expect(runway, `section ${section.id} runway`).not.toBeNull();
      const spawnX = section.checkpoint.x;
      for (const solid of routePlatforms(section)) {
        if (solid.y >= runway!.solid.y) continue;
        const hangsOverSpawn = solid.x < spawnX + PLAYER_SIZE && solid.x + solid.w > spawnX;
        if (!hangsOverSpawn) continue;
        expect(runway!.solid.y - solid.y, `section ${section.id} overhang at ${solid.x},${solid.y}`).toBeGreaterThan(jumpClearance);
      }
    }
  });

  it('starts every section on a broad, dry, water-clear checkpoint runway', () => {
    for (const section of SECTIONS) {
      const spawn = { ...section.checkpoint, w: PLAYER_SIZE, h: PLAYER_SIZE };
      const runway = dryRunway(section);
      expect(section.height, `section ${section.id} height`).toBe(700);
      expect(runway, `section ${section.id} runway`).not.toBeNull();
      expect(runway!.x1 - runway!.x0, `section ${section.id} dry runway width`).toBeGreaterThanOrEqual(280);
      expect(section.solids.some((solid) => overlaps(spawn, solid)), `section ${section.id} clear spawn`).toBe(false);

      const standing = { x: section.checkpoint.x, y: runway!.solid.y - PLAYER_SIZE, w: PLAYER_SIZE, h: PLAYER_SIZE };
      const band = { x: 0, y: standing.y, w: 960, h: PLAYER_SIZE };
      for (const field of waters(section).filter((candidate) => overlaps(band, candidate))) {
        expect(horizontalGap(standing, field), `section ${section.id} spawn clearance from water`).toBeGreaterThanOrEqual(80);
      }
      for (const field of waters(section)) {
        expect(overlaps({ ...standing, y: section.checkpoint.y, h: standing.y + PLAYER_SIZE - section.checkpoint.y }, field),
          `section ${section.id} dry checkpoint`).toBe(false);
      }
    }
  });

  it('keeps every collision platform on the main route or its single useful recovery floor', () => {
    for (const section of SECTIONS) {
      const platforms = routePlatforms(section);
      expect(platforms.every((solid) => solid.role === 'main' || solid.role === 'recovery'), `section ${section.id} classified`).toBe(true);
      expect(platforms.every((solid) => solid.h === 16), `section ${section.id} thickness`).toBe(true);
      expect(platforms.filter((solid) => solid.role === 'recovery').length, `section ${section.id} recovery count`).toBeLessThanOrEqual(1);
    }
  });

  it('gives every water volume a visible exit at least 160 units wide and never points a current into a sealed wall', () => {
    for (const section of SECTIONS) {
      for (const field of waters(section)) {
        const exitsForField = routePlatforms(section).filter((solid) => isWaterExit(field, solid));
        expect(exitsForField.length, `section ${section.id} visible water exit`).toBeGreaterThan(0);
        if (field.currentX > 0) expect(field.x + field.w, `section ${section.id} current right clearance`).toBeLessThanOrEqual(920);
        if (field.currentX < 0) expect(field.x, `section ${section.id} current left clearance`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('swims from the far bottom of every water volume onto one of its visible exits', { timeout: 60_000 }, () => {
    for (const section of SECTIONS) {
      for (const [fieldIndex, field] of waters(section).entries()) {
        const exitsForField = routePlatforms(section).filter((solid) => isWaterExit(field, solid));
        const center = exitsForField.reduce((sum, exit) => sum + exit.x + exit.w / 2, 0) / exitsForField.length;
        const startX = center >= field.x + field.w / 2 ? field.x + 4 : field.x + field.w - PLAYER_SIZE - 4;
        const start = new SectionSim(section, createPlayer(startX, field.y + field.h - PLAYER_SIZE - 1));
        for (let frame = 0; frame < 240 && !start.player.onGround; frame += 1) start.step(input());
        let reached = false;
        for (const exit of exitsForField) {
          const floorExit = exit.y === field.y + field.h;
          const leftDry = { ...exit, w: Math.max(0, field.x - exit.x) };
          const rightDry = { ...exit, x: field.x + field.w, w: Math.max(0, exit.x + exit.w - field.x - field.w) };
          const target = floorExit ? (leftDry.w > rightDry.w ? leftDry : rightDry) : exit;
          const riseXs = floorExit
            ? [target.x + target.w / 2]
            : [exit.x - PLAYER_SIZE - 6, exit.x + 24, exit.x + 60, exit.x + exit.w + 6, exit.x + exit.w - 60];
          const result = searchLeg(start, swimCandidates(() => target, riseXs), (sim) => landedOn(sim.player, target) && !sim.inWater());
          if (result.ok) {
            reached = true;
            break;
          }
        }
        expect(reached, `section ${section.id} water ${fieldIndex} far-side swim`).toBe(true);
      }
    }
  });

  it('lets an idle player in any water volume settle safely inside the same section', () => {
    for (const section of SECTIONS) {
      for (const [fieldIndex, field] of waters(section).entries()) {
        const xs = [field.x + 2, field.x + field.w / 2 - PLAYER_SIZE / 2, field.x + field.w - PLAYER_SIZE - 2];
        const ys = [field.y + 2, field.y + Math.max(2, field.h - PLAYER_SIZE - 2)];
        for (const x of xs) {
          for (const y of ys) {
            const start = { x, y, w: PLAYER_SIZE, h: PLAYER_SIZE };
            if (section.solids.some((solid) => overlaps(start, solid))) continue;
            const sim = new SectionSim(section, createPlayer(x, y));
            let lowestFeet = y + PLAYER_SIZE;
            let safe = true;
            for (let frame = 0; frame < 8 * 120; frame += 1) {
              safe &&= sim.step(input());
              lowestFeet = Math.max(lowestFeet, sim.player.y + PLAYER_SIZE);
            }
            const label = `section ${section.id} water ${fieldIndex} idle from ${JSON.stringify({ x, y })} -> ${JSON.stringify({ x: sim.player.x, y: sim.player.y })}`;
            expect(safe, `${label} safe`).toBe(true);
            expect(lowestFeet, `${label} stays inside the section`).toBeLessThanOrEqual(section.height);
            expect(sim.player.onGround, `${label} settles`).toBe(true);
          }
        }
      }
    }
  });

  it('hands Clockwork and every Aqueduct section to the next runway with one ordinary production-physics jump', { timeout: 30_000 }, () => {
    const chain = [STAGE_02_CLOCKWORK.sections.at(-1)!, ...SECTIONS];
    for (let index = 0; index < chain.length - 1; index += 1) {
      const lower = chain[index];
      const upper = chain[index + 1];
      const stacked = stackSections(lower, upper);
      const runway = dryRunway(upper);
      expect(runway, `handoff ${index} runway`).not.toBeNull();
      const target = shiftBox(runway!.solid, -upper.height);
      let reached = false;
      for (const exit of exits(lower)) {
        const start = new SectionSim(stacked, standingOn(exit, exit.x + exit.w / 2 - PLAYER_SIZE / 2));
        const settle = start.clone();
        settle.step(input());
        const result = searchLeg(settle, jumpCandidates(settle, () => target), (sim) => landedOn(sim.player, target));
        if (result.ok) {
          reached = true;
          break;
        }
      }
      expect(reached, `handoff ${index}: ${index === 0 ? 'Clockwork' : `Aqueduct ${index - 1}`} exit -> Aqueduct ${index} runway`).toBe(true);
      expect(lower.height + Math.min(...exits(lower).map((exit) => exit.y)) - runway!.solid.y, `handoff ${index} rise`).toBeLessThanOrEqual(120);
    }
    expect(exits(SECTIONS[6]).some((exit) => exit.w >= 280), 'final Aqueduct exit is broad').toBe(true);
  });

  it('keeps every crate and wheel gate closed to jump, eight-way air dash, and wall-jump chains', { timeout: 240_000 }, () => {
    for (const section of SECTIONS) {
      const gates: { label: string; exclude: EntityDef['type']; startBelow: number; targetAbove: number; goalWater: WaterDef[] }[] = [];
      const crateDefs = crates(section);
      if (crateDefs.length > 0) {
        gates.push({
          label: 'crates',
          exclude: 'sinkingCrate',
          startBelow: Math.max(...crateDefs.map((crate) => crate.y + crate.h)),
          targetAbove: Math.min(...crateDefs.map((crate) => crate.y)),
          goalWater: [],
        });
      }
      for (const wheel of wheels(section)) {
        gates.push({
          label: 'wheel',
          exclude: 'waterWheel',
          startBelow: wheel.y,
          targetAbove: wheel.y,
          goalWater: waters(section).filter((field) => field.y + field.h < wheel.y),
        });
      }
      for (const gate of gates) {
        const starts = routePlatforms(section).filter((solid) => solid.y >= gate.startBelow);
        const targets = routePlatforms(section).filter((solid) => solid.y < gate.targetAbove);
        const { reached, goalWaterTouched } = reachablePlatforms(section, starts, {
          dash: true,
          wallJump: true,
          include: (def) => def.type !== gate.exclude,
          goalWater: gate.goalWater,
        });
        const bypassed = targets.filter((solid) => reached.has(solid));
        expect(bypassed.map((solid) => [solid.x, solid.y]), `section ${section.id} ${gate.label} bypass`).toEqual([]);
        expect(goalWaterTouched, `section ${section.id} ${gate.label} bypass into upper water`).toBe(false);
      }
    }
  });

  it('keeps every wheel paddle comfortably above a player standing on its boarding bank for the whole cycle', () => {
    for (const section of SECTIONS) {
      for (const wheel of wheels(section)) {
        const banks = routePlatforms(section).filter((solid) => solid.y > wheel.y + wheel.radius);
        for (const t of sampleTimes(WHEEL_PERIOD, 200)) {
          for (const paddle of wheelPaddlesAt(wheel, t)) {
            for (const bank of banks) {
              if (overlapWidth(paddle, bank) === 0) continue;
              const headroom = bank.y - PLAYER_SIZE - (paddle.y + paddle.h);
              expect(headroom, `section ${section.id} paddle headroom over bank ${bank.x},${bank.y} at t=${t.toFixed(2)}`).toBeGreaterThanOrEqual(40);
            }
          }
        }
      }
    }
  });

  it('keeps crate transfers close and leaves every sinking crate clear of fixed platforms', () => {
    for (const section of SECTIONS) {
      const ordered = [...crates(section)].sort((a, b) => a.x - b.x);
      for (let index = 1; index < ordered.length; index += 1) {
        const gap = ordered[index].x - (ordered[index - 1].x + ordered[index - 1].w);
        expect(gap, `section ${section.id} crate transfer ${index}`).toBeLessThanOrEqual(130);
      }
      for (const crate of crates(section)) {
        const sinkEnvelope = { ...crate, h: crate.h + crate.sinkDistance };
        expect(section.solids.some((solid) => overlaps(sinkEnvelope, solid)), `section ${section.id} crate sink envelope`).toBe(false);
      }
    }
  });

  it('keeps machinery clear of every checkpoint spawn over a full cycle', () => {
    for (const section of SECTIONS) {
      const spawn = { ...section.checkpoint, w: PLAYER_SIZE, h: PLAYER_SIZE };
      for (const t of sampleTimes(WHEEL_PERIOD, 100)) {
        const machinery = createEntities(section.entities).flatMap((entity) => {
          entity.update(t, STEP);
          return entity.dynamicSolids();
        });
        expect(machinery.some((solid) => overlaps(spawn, solid.box)), `section ${section.id} clear machinery at ${t}`).toBe(false);
      }
    }
  });
  it.each(SECTIONS.map((section, index) => [index, section.id]))(
    'continuously climbs section %i from its checkpoint to the next runway in production physics',
    { timeout: 120_000 },
    (index) => {
      const result = route(index);
      expect(result.completed, `section ${index} route\n${result.trace.join('\n')}\nstopped at ${JSON.stringify(result.final)}`).toBe(result.total);
    },
  );

  it.each(SECTIONS.map((section, index) => [index, section.id]))(
    'replays the section %i route through the real Game in Normal mode without a respawn',
    { timeout: 120_000 },
    (index) => {
      const result = route(index);
      expect(result.completed, `section ${index} route`).toBe(result.total);
      const game = new Game('normal');
      const base = game.world.sections.findIndex((candidate) => candidate.stageId === 3);
      game.warp(base + index);
      for (const [frame, frameInput] of result.inputs.entries()) {
        expect(game.step(frameInput).respawned, `section ${index} respawn at frame ${frame}`).toBe(false);
      }
      const next = game.world.sections[base + index + 1];
      const landing = next
        ? { ...dryRunway(SECTIONS[index + 1])!.solid, y: next.top + dryRunway(SECTIONS[index + 1])!.solid.y }
        : { ...exits(SECTIONS[index])[0], y: game.world.sections[base + index].top + exits(SECTIONS[index])[0].y };
      expect(landedOn(game.player, landing), `section ${index} real-game landing ${JSON.stringify({ x: game.player.x, y: game.player.y })}`).toBe(true);
    },
  );

  it('requires every water volume on its route: no dry jump, dash, or wall-jump skips a swim', { timeout: 180_000 }, () => {
    for (const [index, section] of SECTIONS.entries()) {
      const legs = ROUTES[index];
      const runway = dryRunway(section)!.solid;
      const fixedBefore: SolidDef[] = [runway];
      for (const leg of legs) {
        const fixed = 'fixed' in leg ? leg.fixed : undefined;
        if (leg.kind === 'swim' || leg.kind === 'rideSwim') {
          const after = legs.slice(legs.indexOf(leg))
            .map((later) => ('fixed' in later ? later.fixed : undefined))
            .filter((solid): solid is SolidDef => solid !== undefined);
          const { reached } = reachablePlatforms(section, fixedBefore, {
            dash: true,
            wallJump: true,
            abortOnWater: true,
            include: (def) => def.type === 'water',
          });
          const skipped = after.filter((solid) => reached.has(solid));
          expect(skipped.map((solid) => [solid.x, solid.y]), `section ${index} swim skipped`).toEqual([]);
        }
        if (fixed) fixedBefore.push(fixed);
      }
    }
  });

  it('makes every upward jet climb faster than the same still water for a stroking swimmer', () => {
    for (const section of SECTIONS) {
      for (const field of waters(section).filter((candidate) => candidate.currentY < 0)) {
        const climbFrames = (currentY: number) => {
          const variant = { ...section, entities: section.entities.map((entity) => (entity === field ? { ...field, currentY } : entity)) };
          const sim = new SectionSim(variant, createPlayer(field.x + field.w - PLAYER_SIZE - 8, field.y + field.h - PLAYER_SIZE - 2));
          for (let frame = 0; frame < 1_200; frame += 1) {
            const stroke = frame % 45 === 0;
            sim.step(input({ jump: stroke, jumpPressed: stroke }));
            if (sim.player.y + PLAYER_SIZE <= field.y) return frame;
          }
          return Number.POSITIVE_INFINITY;
        };
        const jet = climbFrames(field.currentY);
        const still = climbFrames(0);
        expect(jet, `section ${section.id} jet climb`).toBeLessThan(Number.POSITIVE_INFINITY);
        expect(jet, `section ${section.id} jet ${jet} vs still ${still}`).toBeLessThanOrEqual(still * 0.8);
      }
    }
  });

  it('overlaps each wheel safe arc with its boarding bank and upper landing by at least 80 units', () => {
    for (const section of SECTIONS) {
      for (const wheel of wheels(section)) {
        const envelope = { x: wheel.x - wheel.radius - wheel.paddleW / 2, w: wheel.radius * 2 + wheel.paddleW };
        const lower = routePlatforms(section)
          .filter((solid) => solid.y > wheel.y + wheel.radius)
          .sort((a, b) => overlapWidth(envelope, b) - overlapWidth(envelope, a) || a.y - b.y)[0];
        const jet = waters(section).find((field) => field.y + field.h < wheel.y);
        const upper = jet ?? routePlatforms(section).filter((solid) => solid.y < wheel.y).sort((a, b) => b.y - a.y)[0];
        expect(overlapWidth(envelope, lower), `section ${section.id} lower wheel overlap`).toBeGreaterThanOrEqual(80);
        expect(overlapWidth(envelope, upper), `section ${section.id} upper wheel overlap`).toBeGreaterThanOrEqual(80);
      }
    }
  });

  it('uses a still intro pool with a 240-wide bank and a switchback whose broad dry landings need the dash', { timeout: 30_000 }, () => {
    const [introField] = waters(SECTIONS[0]);
    const introBanks = routePlatforms(SECTIONS[0]).filter((solid) => solid.y === introField.y && isWaterExit(introField, solid));
    expect(introBanks.map((solid) => solid.w)).toEqual([240]);

    const switchback = SECTIONS[5];
    const [firstPool, secondPool] = waters(switchback);
    const firstLanding = fixedAt(switchback, 40, 300);
    const secondLanding = fixedAt(switchback, 80, 90);
    expect(firstLanding.w).toBeGreaterThanOrEqual(180);
    expect(secondLanding.w).toBeGreaterThanOrEqual(180);
    expect(isWaterExit(firstPool, firstLanding)).toBe(true);
    expect(isWaterExit(secondPool, fixedAt(switchback, 720, 70))).toBe(true);

    const ordinary = reachablePlatforms(switchback, [firstLanding], { dash: false, include: () => true });
    expect(ordinary.reached.has(secondLanding), 'ordinary jump reaches the dash landing').toBe(false);
    const dashed = reachablePlatforms(switchback, [firstLanding], { dash: true, include: () => true });
    expect(dashed.reached.has(secondLanding), 'jump + dash reaches the dash landing').toBe(true);
  });
});
