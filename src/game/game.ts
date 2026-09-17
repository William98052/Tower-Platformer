import { STEP, VIEW_H } from '../core/constants';
import { EMPTY_INPUT, type InputFrame } from '../core/input';
import { createEntities } from '../entities/factory';
import type { Entity } from '../entities/entity';
import { activateCheckpoint, createRunState, hitHazard, recordLanding, shouldRespawnForFall, stepRunTimers, trackHeight } from '../modes/rules';
import type { Mode, RunState } from '../modes/run-state';
import { createPlayer, type Player, type StepEvents, stepPlayer } from '../physics/player';
import { overlaps } from '../physics/aabb';
import { TOWER } from '../stages/tower';
import type { PromptId, StageDef, TowerDef, World, WorldSection } from '../stages/types';
import { activeSections, buildWorld, stageAtSection } from '../stages/world';
import { StageBanner } from '../ui/banner';
import { completePromptsFromEvents, createPromptState, showPrompt, type PromptState } from '../ui/prompts';
import type { RunSaveV2 } from './run-snapshot';
import { validateRunSaveV2 } from './run-snapshot';

export interface GameStepResult extends StepEvents {
  respawned: boolean;
  checkpointActivated: boolean;
  promptCompleted: PromptId | null;
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

  constructor(mode: Mode = 'normal', tower: TowerDef | StageDef = TOWER, completedPrompts: Iterable<PromptId> = []) {
    this.world = buildWorld('stages' in tower ? tower : { stages: [tower] });
    const first = this.world.sections[0];
    const spawn = first.checkpoint;
    this.player = createPlayer(spawn.x, spawn.y);
    this.run = createRunState(mode, spawn, 0, first.stageId, first.localSection);
    this.prompts = createPromptState(completedPrompts);
    this.entitiesBySection = this.world.sections.map((section) => createEntities(section.entities));
    this.banner.enter(this.currentStage.id, this.currentStage.name);
  }

  get currentStage(): StageDef {
    return stageAtSection(this.world, this.currentSection);
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

    this.enterSection(this.sectionAt(this.player.y + this.player.h / 2));
    trackHeight(this.run, this.player.y);
    if (events.landed > 0) recordLanding(this.run, this.player.y);

    let checkpointActivated = false;
    const section = this.world.sections[this.currentSection];
    if (touchesCheckpoint(this.player, section)) {
      checkpointActivated = activateCheckpoint(this.run, section.checkpoint, this.currentSection, section.stageId, section.localSection);
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
    const promptCompleted = completePromptsFromEvents(this.prompts, events);

    if (shouldRespawnForFall(this.run, this.player.y)) {
      this.respawn();
      return { ...events, respawned: true, checkpointActivated, promptCompleted };
    }
    return { ...events, respawned: false, checkpointActivated, promptCompleted };
  }

  hitHazard(hazardCenterX: number): boolean {
    const result = hitHazard(this.run, this.player, hazardCenterX);
    if (result.respawn) this.respawn();
    return result.respawn;
  }

  respawn(): void {
    Object.assign(this.player, createPlayer(this.run.checkpoint.x, this.run.checkpoint.y));
    this.enterSection(this.run.checkpoint.globalSection);
    for (const entity of this.entitiesBySection[this.currentSection] ?? []) entity.reset();
  }

  warp(section: number): void {
    const index = clamp(Math.trunc(section), 0, this.world.sections.length - 1);
    const target = this.world.sections[index];
    Object.assign(this.player, createPlayer(target.checkpoint.x, target.checkpoint.y));
    this.enterSection(index);
  }

  toggleMode(): void {
    const next: Mode = this.run.mode === 'normal' ? 'hard' : 'normal';
    const first = this.world.sections[0];
    const spawn = first.checkpoint;
    this.run = createRunState(next, spawn, 0, first.stageId, first.localSection);
    Object.assign(this.player, createPlayer(spawn.x, spawn.y));
    this.enterSection(0);
    for (const entities of this.entitiesBySection) for (const entity of entities) entity.reset();
  }

  toggleNoclip(): void {
    this.noclip = !this.noclip;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  snapshot(): RunSaveV2 {
    const common = {
      elapsed: this.run.elapsed,
      falls: this.run.falls,
      bestHeight: this.world.height - this.run.bestY,
    };
    if (this.run.mode === 'normal') {
      return {
        kind: 'normal',
        ...common,
        stageId: this.run.checkpoint.stageId,
        localSection: this.run.checkpoint.localSection,
      };
    }
    return {
      kind: 'hard',
      ...common,
      stageId: this.currentStage.id,
      localSection: this.world.sections[this.currentSection].localSection,
      x: this.player.x,
      stageY: this.stageBottom(this.currentStage.id) - this.player.y,
      vx: this.player.vx,
      vy: this.player.vy,
    };
  }

  completedPrompts(): PromptId[] {
    const order: readonly PromptId[] = ['jump', 'wallJump', 'dash'];
    return order.filter((id) => this.prompts.completed.has(id));
  }

  static restore(tower: TowerDef | StageDef, snapshot: RunSaveV2, completedPrompts: Iterable<PromptId>): Game | null {
    const checked = validateRunSaveV2(snapshot, snapshot.kind);
    if (!checked) return null;

    const game = new Game(checked.kind, tower, completedPrompts);
    const targetIndex = game.world.sections.findIndex((section) =>
      section.stageId === checked.stageId && section.localSection === checked.localSection);
    if (targetIndex < 0) return null;
    const bestY = game.world.height - checked.bestHeight;
    game.time = checked.elapsed;

    if (checked.kind === 'normal') {
      const target = game.world.sections[targetIndex];
      game.run = createRunState('normal', target.checkpoint, targetIndex, target.stageId, target.localSection);
      game.run.elapsed = checked.elapsed;
      game.run.falls = checked.falls;
      game.run.bestY = bestY;
      game.run.peakSinceLanding = bestY;
      Object.assign(game.player, createPlayer(target.checkpoint.x, target.checkpoint.y));
      game.enterSection(targetIndex);
      return game;
    }

    const candidate = { x: checked.x, y: game.stageBottom(checked.stageId) - checked.stageY, w: game.player.w, h: game.player.h };
    if (candidate.x < 0 || candidate.y < 0
      || candidate.x + candidate.w > game.world.width
      || candidate.y + candidate.h > game.world.height
      || game.world.solids.some((solid) => overlaps(candidate, solid))) {
      return null;
    }

    Object.assign(game.player, candidate, { vx: checked.vx, vy: checked.vy, onGround: false });
    const derivedSection = game.sectionAt(game.player.y + game.player.h / 2);
    if (derivedSection !== targetIndex) return null;
    game.enterSection(derivedSection);
    game.run.elapsed = checked.elapsed;
    game.run.falls = checked.falls;
    game.run.bestY = bestY;
    game.run.peakSinceLanding = bestY;
    return game;
  }

  activeSectionIds(cameraY: number): number[] {
    return this.activeSections(cameraY).map((section) => section.globalIndex);
  }

  activeEntities(cameraY: number): Entity[] {
    return this.activeSectionIndexes(cameraY).flatMap((index) => this.entitiesBySection[index]);
  }

  private activeSections(cameraY: number): WorldSection[] {
    return activeSections(this.world, cameraY, VIEW_H);
  }

  private activeSectionIndexes(cameraY: number): number[] {
    return this.activeSectionIds(cameraY);
  }

  private enterSection(index: number): void {
    const previousStageId = this.currentStage.id;
    this.currentSection = index;
    if (this.currentStage.id !== previousStageId) this.banner.enter(this.currentStage.id, this.currentStage.name);
  }

  private stageBottom(stageId: number): number {
    return this.world.sections.find((section) => section.stageId === stageId)!.bottom;
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
