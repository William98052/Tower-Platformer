import type { SaveStore } from '../core/save';
import type { InputFrame } from '../core/input';
import type { Settings } from '../core/settings';
import { Game, type GameStepResult } from '../game/game';
import type { Mode } from '../modes/run-state';
import { STAGE_01_MOSS } from '../stages/stage01-moss';
import type { StageDef } from '../stages/types';

export type Screen = 'title' | 'modeSelect' | 'playing' | 'paused' | 'settings';
export type SettingsOrigin = 'title' | 'paused';
export type PauseReason = 'escape' | 'visibility';

export interface AppNotice {
  message: string;
}

export type PendingConfirmation =
  | { kind: 'newRun'; mode: Mode }
  | { kind: 'restart'; mode: Mode };

export class AppController {
  screen: Screen = 'title';
  game: Game | null = null;
  pendingConfirmation: PendingConfirmation | null = null;
  notice: AppNotice | null = null;
  private settingsOrigin: SettingsOrigin = 'title';
  private hardSaveClock = 0;

  constructor(private readonly store: SaveStore, private readonly stage: StageDef = STAGE_01_MOSS) {
    const save = this.store.load();
    if (this.store.notice) this.notice = { message: this.store.notice };
    void save;
  }

  openModeSelect(): void {
    if (this.screen === 'title') this.screen = 'modeSelect';
  }

  backToTitle(): void {
    if (this.screen === 'modeSelect') this.screen = 'title';
  }

  get settings(): Settings {
    return this.store.load().settings;
  }

  updateSettings(settings: Settings): void {
    this.store.update((save) => { save.settings = settings; });
    if (this.store.notice) this.notice = { message: this.store.notice };
  }

  newRun(mode: Mode): boolean {
    if (this.continueAvailable(mode)) {
      this.pendingConfirmation = { kind: 'newRun', mode };
      return false;
    }
    this.startFresh(mode);
    return true;
  }

  continueAvailable(mode: Mode): boolean {
    return this.store.load().runs[mode]?.kind === mode;
  }

  continueRun(mode: Mode): boolean {
    const save = this.store.load();
    const snapshot = save.runs[mode];
    if (!snapshot || snapshot.kind !== mode) return false;
    const restored = Game.restore(this.stage, snapshot, save.completedPrompts);
    if (!restored) {
      this.store.update((data) => { data.runs[mode] = null; });
      this.notice = { message: 'That saved run could not be restored and was cleared.' };
      this.screen = 'modeSelect';
      return false;
    }
    this.game = restored;
    this.screen = 'playing';
    this.hardSaveClock = 0;
    return true;
  }

  pause(_reason: PauseReason): void {
    if (this.screen !== 'playing' || !this.game) return;
    this.saveCurrent();
    this.screen = 'paused';
  }

  resume(): void {
    if (this.screen === 'paused' && this.game) this.screen = 'playing';
  }

  restart(): void {
    if (this.screen !== 'paused' || !this.game) return;
    this.pendingConfirmation = { kind: 'restart', mode: this.game.run.mode };
  }

  quitToTitle(): void {
    if (this.game) this.saveCurrent();
    this.game = null;
    this.pendingConfirmation = null;
    this.screen = 'title';
    this.hardSaveClock = 0;
  }

  openSettings(): void {
    if (this.screen !== 'title' && this.screen !== 'paused') return;
    this.settingsOrigin = this.screen;
    this.screen = 'settings';
  }

  closeSettings(): void {
    if (this.screen === 'settings') this.screen = this.settingsOrigin;
  }

  confirm(): void {
    const pending = this.pendingConfirmation;
    if (!pending) return;
    this.pendingConfirmation = null;
    this.startFresh(pending.mode);
  }

  cancelConfirmation(): void {
    this.pendingConfirmation = null;
  }

  step(input: InputFrame, cameraY?: number): GameStepResult | null {
    if (this.screen !== 'playing' || !this.game) return null;
    const result = this.game.step(input, cameraY);
    this.afterStep(result);
    return result;
  }

  afterStep(result: GameStepResult): void {
    if (!this.game || this.screen !== 'playing') return;
    const save = this.store.load();
    const promptsChanged = result.promptCompleted !== null || this.game.completedPrompts().some((id) => !save.completedPrompts.includes(id));
    if ((result.checkpointActivated && this.game.run.mode === 'normal') || promptsChanged) this.saveCurrent();
  }

  advanceRealTime(dt: number): void {
    if (this.screen !== 'playing' || this.game?.run.mode !== 'hard' || !Number.isFinite(dt) || dt <= 0) return;
    this.hardSaveClock += dt;
    if (this.hardSaveClock < 5) return;
    this.hardSaveClock %= 5;
    this.saveCurrent();
  }

  private startFresh(mode: Mode): void {
    const completed = this.store.load().completedPrompts;
    this.game = new Game(mode, this.stage, completed);
    this.screen = 'playing';
    this.pendingConfirmation = null;
    this.hardSaveClock = 0;
  }

  private saveCurrent(): void {
    const game = this.game;
    if (!game) return;
    const mode = game.run.mode;
    const prompts = game.completedPrompts();
    const height = Math.max(0, game.world.height - game.run.bestY);
    this.store.update((save) => {
      save.runs[mode] = game.snapshot();
      save.completedPrompts = [...new Set([...save.completedPrompts, ...prompts])];
      save.records[mode].bestHeight = Math.max(save.records[mode].bestHeight, height);
    });
    if (this.store.notice) this.notice = { message: this.store.notice };
  }
}
