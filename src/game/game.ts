import { STEP, VIEW_H } from '../core/constants';
import { EMPTY_INPUT, type InputFrame } from '../core/input';
import { createEntities } from '../entities/factory';
import type { Entity } from '../entities/entity';
import { activateCheckpoint, createRunState, hitHazard, recordLanding, shouldRespawnForFall, stepRunTimers, trackHeight } from '../modes/rules';
import type { Mode, RunState } from '../modes/run-state';
import { createPlayer, type Player, type StepEvents, stepPlayer } from '../physics/player';
import { overlaps } from '../physics/aabb';
import { STAGE_01_MOSS } from '../stages/stage01-moss';
import type { PromptId, StageDef, World, WorldSection } from '../stages/types';
import { activeSections, buildWorld } from '../stages/world';
import { StageBanner } from '../ui/banner';
import { completePromptsFromEvents, createPromptState, showPrompt, type PromptState } from '../ui/prompts';
import type { RunSave } from './run-snapshot';
import { validateRunSave } from './run-snapshot';

export interface GameStepResult extends StepEvents {
  respawned: boolean;
  checkpointActivated: boolean;
}

const NO_EVENTS: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };

export class Game {
  readonly world: World;
  readonly player: Player;
  run: RunState;
  readonly prompts: PromptState;
  readonly banner = new StageBanner();
  noclip = false;
  currentSection = 0;
  time = 0;
  private readonly entitiesBySection: Entity[][];

  constructor(mode: Mode = 'normal', stage: StageDef = STAGE_01_MOSS, completedPrompts: Iterable<PromptId> = []) {
    this.world = buildWorld(stage);
    const spawn = this.world.sections[0].checkpoint;
    this.player = createPlayer(spawn.x, spawn.y);
    this.run = createRunState(mode, spawn, 0);
    this.prompts = createPromptState(completedPrompts);
    this.entitiesBySection = this.world.sections.map((section) => createEntities(section.entities));
    this.banner.enter(stage.id, stage.name);
  }

  step(input: InputFrame, cameraY = this.defaultCameraY()): GameStepResult {
    stepRunTimers(this.run, STEP);
    this.banner.update(STEP);
    this.time += STEP;

    let events = NO_EVENTS;
    if (this.noclip) {
      this.player.x = clamp(this.player.x + input.moveX * 600 * STEP, 24, this.world.width - 24 - this.player.w);
      this.player.y = clamp(this.player.y + input.moveY * 600 * STEP, 0, this.world.height - this.player.h);
      this.player.vx = input.moveX * 600;
      this.player.vy = input.moveY * 600;
      this.player.onGround = false;
    } else {
      const sections = this.activeSections(cameraY);
      const solids = sections.flatMap((section) => section.solids);
      events = stepPlayer(this.player, this.run.stun > 0 ? EMPTY_INPUT : input, solids);
    }

    this.currentSection = this.sectionAt(this.player.y + this.player.h / 2);
    trackHeight(this.run, this.player.y);
    if (events.landed > 0) recordLanding(this.run, this.player.y);

    let checkpointActivated = false;
    const section = this.world.sections[this.currentSection];
    if (touchesCheckpoint(this.player, section)) {
      checkpointActivated = activateCheckpoint(this.run, section.checkpoint, section.id);
    }

    for (const index of this.activeSectionIndexes(cameraY)) {
      for (const entity of this.entitiesBySection[index]) {
        entity.update(this.time, STEP);
        const result = entity.collide(this.player);
        if (result.kind === 'launch') {
          this.player.vy = result.velocityY;
          this.player.onGround = false;
        } else if (result.kind === 'prompt') {
          showPrompt(this.prompts, result.id);
        }
      }
    }
    completePromptsFromEvents(this.prompts, events);

    if (shouldRespawnForFall(this.run, this.player.y)) {
      this.respawn();
      return { ...events, respawned: true, checkpointActivated };
    }
    return { ...events, respawned: false, checkpointActivated };
  }

  hitHazard(hazardCenterX: number): boolean {
    const result = hitHazard(this.run, this.player, hazardCenterX);
    if (result.respawn) this.respawn();
    return result.respawn;
  }

  respawn(): void {
    Object.assign(this.player, createPlayer(this.run.checkpoint.x, this.run.checkpoint.y));
    this.currentSection = this.run.checkpoint.section;
    for (const entity of this.entitiesBySection[this.currentSection] ?? []) entity.reset();
  }

  warp(section: number): void {
    const index = clamp(Math.trunc(section), 0, this.world.sections.length - 1);
    const target = this.world.sections[index];
    Object.assign(this.player, createPlayer(target.checkpoint.x, target.checkpoint.y));
    this.currentSection = index;
    this.banner.enter(this.world.stage.id, this.world.stage.name);
  }

  toggleMode(): void {
    const next: Mode = this.run.mode === 'normal' ? 'hard' : 'normal';
    const spawn = this.world.sections[0].checkpoint;
    this.run = createRunState(next, spawn, 0);
    Object.assign(this.player, createPlayer(spawn.x, spawn.y));
    this.currentSection = 0;
    for (const entities of this.entitiesBySection) for (const entity of entities) entity.reset();
  }

  toggleNoclip(): void {
    this.noclip = !this.noclip;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  snapshot(): RunSave {
    const common = {
      stageId: this.world.stage.id,
      elapsed: this.run.elapsed,
      falls: this.run.falls,
      bestY: this.run.bestY,
    };
    if (this.run.mode === 'normal') {
      return { kind: 'normal', ...common, section: this.run.checkpoint.section };
    }
    return {
      kind: 'hard',
      ...common,
      section: this.currentSection,
      x: this.player.x,
      y: this.player.y,
      vx: this.player.vx,
      vy: this.player.vy,
    };
  }

  completedPrompts(): PromptId[] {
    const order: readonly PromptId[] = ['jump', 'wallJump', 'dash'];
    return order.filter((id) => this.prompts.completed.has(id));
  }

  static restore(stage: StageDef, snapshot: RunSave, completedPrompts: Iterable<PromptId>): Game | null {
    const checked = validateRunSave(snapshot, snapshot.kind);
    if (!checked || checked.stageId !== stage.id) return null;

    const game = new Game(checked.kind, stage, completedPrompts);
    if (checked.section >= game.world.sections.length) return null;

    if (checked.kind === 'normal') {
      const target = game.world.sections[checked.section];
      game.run = createRunState('normal', target.checkpoint, checked.section);
      game.run.elapsed = checked.elapsed;
      game.run.falls = checked.falls;
      game.run.bestY = checked.bestY;
      game.run.peakSinceLanding = checked.bestY;
      Object.assign(game.player, createPlayer(target.checkpoint.x, target.checkpoint.y));
      game.currentSection = checked.section;
      return game;
    }

    const candidate = { x: checked.x, y: checked.y, w: game.player.w, h: game.player.h };
    if (candidate.x < 0 || candidate.y < 0
      || candidate.x + candidate.w > game.world.width
      || candidate.y + candidate.h > game.world.height
      || game.world.solids.some((solid) => overlaps(candidate, solid))) {
      return null;
    }

    Object.assign(game.player, candidate, { vx: checked.vx, vy: checked.vy, onGround: false });
    const derivedSection = game.sectionAt(game.player.y + game.player.h / 2);
    if (derivedSection !== checked.section) return null;
    game.currentSection = derivedSection;
    game.run.elapsed = checked.elapsed;
    game.run.falls = checked.falls;
    game.run.bestY = checked.bestY;
    game.run.peakSinceLanding = checked.bestY;
    return game;
  }

  activeSectionIds(cameraY: number): number[] {
    return this.activeSections(cameraY).map((section) => section.id);
  }

  activeEntities(cameraY: number): Entity[] {
    return this.activeSectionIndexes(cameraY).flatMap((index) => this.entitiesBySection[index]);
  }

  private activeSections(cameraY: number): WorldSection[] {
    return activeSections(this.world, cameraY, VIEW_H);
  }

  private activeSectionIndexes(cameraY: number): number[] {
    const ids = new Set(this.activeSectionIds(cameraY));
    return this.world.sections.map((section, index) => ids.has(section.id) ? index : -1).filter((index) => index >= 0);
  }

  private sectionAt(y: number): number {
    const index = this.world.sections.findIndex((section) => y >= section.top && y < section.bottom);
    return index < 0 ? (y < 0 ? this.world.sections.length - 1 : 0) : index;
  }

  private defaultCameraY(): number {
    return clamp(this.player.y - VIEW_H * 0.55, 0, Math.max(0, this.world.height - VIEW_H));
  }
}

function touchesCheckpoint(player: Player, section: WorldSection): boolean {
  const checkpoint = section.checkpoint;
  return player.x + player.w > checkpoint.x - 12
    && player.x < checkpoint.x + 36
    && player.y + player.h > checkpoint.y - 24
    && player.y < checkpoint.y + 36;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
