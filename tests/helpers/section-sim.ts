import { STEP } from '../../src/core/constants';
import type { InputFrame } from '../../src/core/input';
import type { Entity } from '../../src/entities/entity';
import { createEntities } from '../../src/entities/factory';
import { carryStandingPlayer, resolveFieldEffects } from '../../src/entities/interactions';
import { type AABB, overlaps } from '../../src/physics/aabb';
import { pushOutPlayer } from '../../src/physics/collision';
import { createPlayer, stepPlayer, type Player } from '../../src/physics/player';
import type { EntityDef, SectionDef, SolidDef } from '../../src/stages/types';
import { input } from './input';

export const PLAYER_SIZE = 28;

export type WaterDef = Extract<EntityDef, { type: 'water' }>;

/**
 * Production-order simulation of one section (or a stack of sections): entity update, moving-solid
 * carry, field effects, `stepPlayer`, moving-solid push-out, then entity contacts — the same
 * sequence `Game.step` runs. State can be cloned so route searches branch without replaying.
 */
export class SectionSim {
  readonly defs: EntityDef[];
  entities: Entity[];
  time: number;
  frames = 0;
  carriedBy: Entity | null = null;
  /** Every input stepped so far, so a found route can be replayed in the real game. */
  inputs: InputFrame[] = [];

  constructor(
    readonly section: SectionDef,
    public player: Player,
    startTime = 0,
    include: (def: EntityDef) => boolean = () => true,
  ) {
    this.defs = section.entities.filter(include);
    this.entities = createEntities(this.defs);
    this.time = startTime;
    for (const entity of this.entities) entity.update(startTime, 0);
  }

  step(frameInput: InputFrame): boolean {
    const { player } = this;
    this.time += STEP;
    this.frames += 1;
    this.inputs.push(frameInput);
    for (const entity of this.entities) entity.update(this.time, STEP);
    const moving = this.entities.flatMap((entity) => entity.dynamicSolids().map((solid) => ({ entity, solid })));
    const solids = [...this.section.solids, ...moving.map(({ solid }) => solid.box)];
    this.carriedBy = null;
    for (const { entity, solid } of moving) {
      if (!carryStandingPlayer(player, solid, solids)) continue;
      this.carriedBy = entity;
      break;
    }
    const field = resolveFieldEffects(this.entities.map((entity) => entity.field(player)).filter((effect) => effect !== null));
    stepPlayer(player, frameInput, solids, STEP, field);
    for (const { solid } of moving) {
      if (!pushOutPlayer(player, solid.box, solids.filter((blocker) => blocker !== solid.box))) return false;
    }
    for (const entity of this.entities) entity.collide(player);
    return true;
  }

  clone(): SectionSim {
    const copy = Object.create(SectionSim.prototype) as SectionSim;
    Object.assign(copy, this);
    copy.player = { ...this.player };
    copy.inputs = [...this.inputs];
    copy.entities = createEntities(this.defs);
    copy.entities.forEach((entity, index) => Object.assign(entity, this.entities[index]));
    return copy;
  }

  dynamicBoxes(): AABB[] {
    return this.entities.flatMap((entity) => entity.dynamicSolids().map((solid) => solid.box));
  }

  inWater(): boolean {
    return this.defs.some((def) => def.type === 'water' && overlaps(this.player, def));
  }

  /** The static or moving box the player currently stands on, if any. */
  support(): AABB | null {
    if (!this.player.onGround) return null;
    const foot = this.player.y + this.player.h;
    const candidates = [...this.dynamicBoxes(), ...this.section.solids];
    return candidates.find((box) => Math.abs(foot - box.y) <= 1
      && this.player.x + this.player.w > box.x
      && this.player.x < box.x + box.w) ?? null;
  }
}

/** Stacks `upper` directly above `lower`, keeping `lower` coordinates (the upper section lands at negative y). */
export function stackSections(lower: SectionDef, upper: SectionDef): SectionDef {
  const shift = -upper.height;
  return {
    id: lower.id,
    height: lower.height + upper.height,
    checkpoint: lower.checkpoint,
    solids: [...lower.solids, ...upper.solids.map((solid) => ({ ...solid, y: solid.y + shift }))],
    entities: [...lower.entities, ...upper.entities.map((entity) => ({ ...entity, y: entity.y + shift }))],
  };
}

export function shiftBox<T extends AABB>(box: T, dy: number): T {
  return { ...box, y: box.y + dy };
}

export function landedOn(player: Player, target: AABB): boolean {
  return player.onGround
    && Math.abs(player.y + player.h - target.y) <= 1
    && player.x + player.w > target.x
    && player.x < target.x + target.w;
}

export function routePlatforms(section: SectionDef): SolidDef[] {
  return section.solids.filter((solid) => solid.role !== 'boundary');
}

export function waters(section: SectionDef): WaterDef[] {
  return section.entities.filter((entity): entity is WaterDef => entity.type === 'water');
}

/** Water volumes whose rectangle overlaps the band a player occupies while standing on `solid`. */
function waterOverStanding(section: SectionDef, solid: AABB): WaterDef[] {
  const band = { x: solid.x, y: solid.y - PLAYER_SIZE, w: solid.w, h: PLAYER_SIZE };
  return waters(section).filter((field) => overlaps(band, field));
}

/** Dry, water-free interval of the checkpoint runway that contains the spawn column. */
export function dryRunway(section: SectionDef): { solid: SolidDef; x0: number; x1: number } | null {
  const spawnX = section.checkpoint.x;
  const solid = routePlatforms(section).find((candidate) => (
    candidate.role === 'main'
    && candidate.surface === 'normal'
    && candidate.y >= section.checkpoint.y + PLAYER_SIZE
    && spawnX >= candidate.x
    && spawnX + PLAYER_SIZE <= candidate.x + candidate.w
  ));
  if (!solid) return null;
  let x0 = solid.x;
  let x1 = solid.x + solid.w;
  for (const field of waterOverStanding(section, solid)) {
    if (field.x + field.w <= spawnX) x0 = Math.max(x0, field.x + field.w);
    else if (field.x >= spawnX + PLAYER_SIZE) x1 = Math.min(x1, field.x);
    else return { solid, x0: spawnX, x1: spawnX };
  }
  return { solid, x0, x1 };
}

export function standingOn(solid: AABB, x: number): Player {
  const player = createPlayer(x, solid.y - PLAYER_SIZE);
  player.onGround = true;
  return player;
}

export type Policy = (sim: SectionSim, frame: number) => InputFrame;

export interface Candidate {
  label: string;
  maxFrames: number;
  make(): Policy;
}

export interface LegResult {
  ok: boolean;
  sim: SectionSim;
  label: string;
  tried: number;
}

/** Runs candidates from cloned copies of `sim` until one satisfies `success` without an unsafe crush. */
export function searchLeg(
  sim: SectionSim,
  candidates: Iterable<Candidate>,
  success: (sim: SectionSim) => boolean,
  abort: (sim: SectionSim) => boolean = () => false,
): LegResult {
  let tried = 0;
  for (const candidate of candidates) {
    tried += 1;
    const branch = sim.clone();
    const policy = candidate.make();
    for (let frame = 0; frame < candidate.maxFrames; frame += 1) {
      if (!branch.step(policy(branch, frame))) break;
      if (success(branch)) return { ok: true, sim: branch, label: candidate.label, tried };
      if (abort(branch)) break;
    }
  }
  return { ok: false, sim, label: 'none', tried };
}

export interface JumpShape {
  approachX: number;
  wait: number;
  runDirection: -1 | 1;
  runFrames: number;
  hold: number;
  steer: -1 | 0 | 1;
  steerDelay: number;
  dash?: { x: -1 | 0 | 1; y: -1 | 0 | 1; delay: number };
  wallJump?: { dir: -1 | 1; delay: number };
}

/** Walk to `approachX`, optionally wait, run, jump, steer, and optionally air-dash / wall-jump. */
export function jumpPolicy(shape: JumpShape): Policy {
  let phase: 'approach' | 'wait' | 'jump' = 'approach';
  let phaseStart = 0;
  return (sim, frame) => {
    const { player } = sim;
    if (phase === 'approach') {
      const delta = shape.approachX - player.x;
      if (Math.abs(delta) > 2 && frame < 150) return input({ moveX: Math.sign(delta) as -1 | 1 });
      phase = 'wait';
      phaseStart = frame;
    }
    if (phase === 'wait') {
      if (frame - phaseStart < shape.wait) return input();
      phase = 'jump';
      phaseStart = frame;
    }
    const k = frame - phaseStart;
    const jumpAt = shape.runFrames;
    const airborne = k - jumpAt;
    let moveX: -1 | 0 | 1 = k < jumpAt || airborne < shape.steerDelay ? shape.runDirection : shape.steer;
    let moveY: -1 | 0 | 1 = 0;
    let dashPressed = false;
    let jumpPressed = airborne === 0;
    if (shape.wallJump && airborne >= 0 && airborne <= shape.wallJump.delay) {
      moveX = shape.wallJump.dir;
    }
    if (shape.dash && airborne === shape.dash.delay) {
      moveX = shape.dash.x;
      moveY = shape.dash.y;
      dashPressed = true;
    }
    if (shape.wallJump && airborne === shape.wallJump.delay) {
      moveX = shape.wallJump.dir;
      jumpPressed = true;
    }
    if (shape.wallJump && airborne > shape.wallJump.delay) {
      moveX = shape.steer;
    }
    return input({
      moveX,
      moveY,
      jump: airborne >= 0 && airborne < Math.max(shape.hold, (shape.wallJump?.delay ?? 0) + 12),
      jumpPressed,
      dashPressed,
    });
  };
}

function samples(from: number, to: number, count: number): number[] {
  if (to <= from) return [from];
  return Array.from({ length: count }, (_, index) => from + (to - from) * index / (count - 1));
}

export interface JumpSearchOptions {
  dash?: boolean;
  waits?: number[];
  positions?: number;
}

/** Ordinary (and optionally jump + eight-way air-dash) jumps from the current support toward `target`. */
export function* jumpCandidates(sim: SectionSim, target: () => AABB, options: JumpSearchOptions = {}): Generator<Candidate> {
  const support = sim.support();
  const from = support ? support.x : sim.player.x;
  const to = support ? support.x + support.w - PLAYER_SIZE : sim.player.x;
  const goal = target();
  const goalCenter = goal.x + goal.w / 2;
  const toward: -1 | 1 = goalCenter >= sim.player.x + PLAYER_SIZE / 2 ? 1 : -1;
  const positions = samples(from, to, options.positions ?? 9)
    .sort((a, b) => Math.abs(a + PLAYER_SIZE / 2 - goalCenter) - Math.abs(b + PLAYER_SIZE / 2 - goalCenter));
  const edgeFirst = [...positions].sort((a, b) => (toward > 0 ? b - a : a - b));
  // Chained hops first: jump from where the player landed before walking anywhere.
  const ordered = [...new Set([sim.player.x, ...edgeFirst.slice(0, 2), ...positions])];
  const dashes: JumpShape['dash'][] = [undefined];
  if (options.dash) {
    for (const delay of [4, 10, 16, 22, 28, 34, 40]) {
      for (const [x, y] of [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
        dashes.push({ x, y, delay });
      }
    }
  }
  for (const wait of options.waits ?? [0]) {
    for (const dash of dashes) {
      for (const approachX of ordered) {
        for (const runDirection of [toward, -toward as -1 | 1]) {
          for (const runFrames of [0, 10, 22]) {
            for (const hold of [60, 14]) {
              for (const steer of [toward, 0, -toward as -1 | 1] as const) {
                for (const steerDelay of [0, 10, 22]) {
                  const shape: JumpShape = { approachX, wait, runDirection, runFrames, hold, steer, steerDelay, dash };
                  yield {
                    label: JSON.stringify(shape),
                    maxFrames: 150 + wait + 200,
                    make: () => jumpPolicy(shape),
                  };
                }
              }
            }
          }
        }
      }
    }
  }
}

export interface SwimShape {
  riseX: number;
  cadence: number;
  /** Hold strokes until near riseX so a current-opposed swim can pass under a dash wall. */
  dive?: boolean;
}

/**
 * Swim policy: hold toward `riseX` and stroke at `cadence` while the feet are below the target top,
 * then steer onto the target. Walks (without jumping) while dry and below the target.
 */
export function swimPolicy(target: (sim: SectionSim) => AABB, shape: SwimShape): Policy {
  let lastStroke = -1_000;
  return (sim, frame) => {
    const { player } = sim;
    const goal = target(sim);
    const feet = player.y + player.h;
    if (feet <= goal.y - 1) {
      const delta = goal.x + goal.w / 2 - (player.x + PLAYER_SIZE / 2);
      return input({ moveX: Math.abs(delta) < 2 ? 0 : Math.sign(delta) as -1 | 1 });
    }
    const delta = shape.riseX - player.x;
    const moveX = Math.abs(delta) < 3 ? 0 : Math.sign(delta) as -1 | 1;
    const atRise = !shape.dive || Math.abs(delta) < 40;
    const stroke = atRise && sim.inWater() && frame - lastStroke >= shape.cadence;
    if (stroke) lastStroke = frame;
    return input({ moveX, jump: stroke, jumpPressed: stroke });
  };
}

export function* swimCandidates(target: (sim: SectionSim) => AABB, riseXs: number[], maxFrames = 2_400): Generator<Candidate> {
  for (const riseX of riseXs) {
    for (const cadence of [20, 27, 34, 44]) {
      for (const dive of [false, true]) {
        const shape = { riseX, cadence, dive };
        yield { label: `swim ${JSON.stringify(shape)}`, maxFrames, make: () => swimPolicy(target, shape) };
      }
    }
  }
}

/** Every standing position sampled across a platform, for bypass searches. */
export function standingSamples(solid: AABB, count = 7): number[] {
  return samples(solid.x, solid.x + solid.w - PLAYER_SIZE, count);
}

export interface ReachOptions {
  /** Also try jump + one eight-way air dash at several timings. */
  dash: boolean;
  /** Also try jump + dash + wall-jump from a wall beside the start platform. */
  wallJump?: boolean;
  /** Entities kept in the simulation (the mechanic under test is removed). */
  include: (def: EntityDef) => boolean;
  /** Treat any contact with water as not bypassing (the swim was used). */
  abortOnWater?: boolean;
  /** Any contact with these volumes counts as reaching the gated area. */
  goalWater?: readonly WaterDef[];
}

const DASH_DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1], [1, 1], [-1, 1]] as const;
const WALL_DASH_DIRECTIONS = [[0, -1], [1, -1], [-1, -1], [1, 0], [-1, 0]] as const;
const LEFT_WALL = 24;
const RIGHT_WALL = 936;

function wallDirsBeside(from: SolidDef): (-1 | 1)[] {
  const dirs: (-1 | 1)[] = [];
  if (from.x <= LEFT_WALL + 4) dirs.push(-1);
  if (from.x + from.w >= RIGHT_WALL - 4) dirs.push(1);
  return dirs;
}

function* transitionShapes(
  from: SolidDef,
  to: AABB,
  dash: boolean,
  wallJump: boolean,
): Generator<{ startX: number; shape: JumpShape }> {
  const toward: -1 | 1 = to.x + to.w / 2 >= from.x + from.w / 2 ? 1 : -1;
  const startXs = standingSamples(from, dash || wallJump ? 5 : 7);
  const dashes: JumpShape['dash'][] = [undefined];
  if (dash) {
    for (const delay of [4, 12, 20, 28, 36, 44]) {
      for (const [x, y] of DASH_DIRECTIONS) dashes.push({ x, y, delay });
    }
  }
  const wallJumps: JumpShape['wallJump'][] = [undefined];
  if (wallJump) {
    for (const dir of wallDirsBeside(from)) {
      for (const delay of [24, 36, 44, 56]) wallJumps.push({ dir, delay });
    }
  }
  for (const d of dashes) {
    for (const wall of wallJumps) {
      if (wall && d && !WALL_DASH_DIRECTIONS.some(([x, y]) => x === d.x && y === d.y)) continue;
      if (wall && d && d.delay >= wall.delay) continue;
      for (const startX of startXs) {
        for (const runDirection of [toward, -toward as -1 | 1]) {
          for (const runFrames of d || wall ? [0, 16] : [0, 16]) {
            for (const hold of d || wall ? [60] : [60, 14]) {
              for (const steer of [toward, 0, -toward as -1 | 1] as const) {
                for (const steerDelay of d || wall ? [0] : [0, 12]) {
                  yield {
                    startX,
                    shape: {
                      approachX: startX,
                      wait: 0,
                      runDirection,
                      runFrames,
                      hold,
                      steer,
                      steerDelay,
                      dash: d,
                      wallJump: wall,
                    },
                  };
                }
              }
            }
          }
        }
      }
    }
  }
}

function withinReach(from: SolidDef, to: AABB, dash: boolean, wallJump: boolean): boolean {
  const rise = from.y - to.y;
  const gap = Math.max(0, to.x - (from.x + from.w), from.x - (to.x + to.w));
  const maxRise = wallJump ? 460 : dash ? 320 : 175;
  const maxGap = wallJump ? 520 : dash ? 420 : 260;
  return rise <= maxRise && gap <= maxGap && rise >= -700;
}

/**
 * Breadth-first reachability over a section's static platforms using production physics. Returns the
 * platforms reached (plus whether a goal water volume was touched) starting from `starts`.
 */
export function reachablePlatforms(
  section: SectionDef,
  starts: readonly SolidDef[],
  options: ReachOptions,
): { reached: Set<SolidDef>; goalWaterTouched: boolean } {
  const nodes = routePlatforms(section);
  const reached = new Set<SolidDef>(starts);
  const queue = [...starts];
  let goalWaterTouched = false;
  const touchesGoalWater = (player: Player) => (options.goalWater ?? []).some((field) => overlaps(player, field));

  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const to of nodes) {
      if (reached.has(to) || !withinReach(from, to, options.dash, options.wallJump === true)) continue;
      let found = false;
      for (const { startX, shape } of transitionShapes(from, to, options.dash, options.wallJump === true)) {
        const sim = new SectionSim(section, standingOn(from, startX), 0, options.include);
        const policy = jumpPolicy(shape);
        for (let frame = 0; frame < 170; frame += 1) {
          if (!sim.step(policy(sim, frame))) break;
          if (options.abortOnWater && sim.inWater()) break;
          if (touchesGoalWater(sim.player)) {
            goalWaterTouched = true;
            return { reached, goalWaterTouched };
          }
          const landed = nodes.find((node) => node !== from && !reached.has(node) && landedOn(sim.player, node));
          if (landed) {
            reached.add(landed);
            queue.push(landed);
            if (landed === to) found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }
  return { reached, goalWaterTouched };
}
