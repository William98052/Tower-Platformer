import { describe, expect, it } from 'vitest';
import { AppController } from '../../src/app/controller';
import {
  SAVE_KEY_V1,
  SAVE_KEY_V2,
  SaveStore,
  type SaveDataV1,
  type StorageLike,
} from '../../src/core/save';
import { EMPTY_INPUT } from '../../src/core/input';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import type { HardRunSaveV2 } from '../../src/game/run-snapshot';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function makeController() {
  const store = new SaveStore(memoryStorage());
  return { app: new AppController(store), store };
}

describe('AppController screen flow', () => {
  it('moves through title, mode selection, play, pause, settings, and resume', () => {
    const { app } = makeController();
    expect(app.screen).toBe('title');
    app.openModeSelect();
    expect(app.screen).toBe('modeSelect');
    expect(app.newRun('normal')).toBe(true);
    expect(app.screen).toBe('playing');
    app.pause('escape');
    expect(app.screen).toBe('paused');
    app.openSettings();
    expect(app.screen).toBe('settings');
    app.closeSettings();
    expect(app.screen).toBe('paused');
    app.resume();
    expect(app.screen).toBe('playing');
  });

  it('uses confirmations before replacing or restarting a saved run', () => {
    const { app } = makeController();
    app.openModeSelect();
    app.newRun('normal');
    app.pause('escape');
    app.quitToTitle();
    app.openModeSelect();

    expect(app.newRun('normal')).toBe(false);
    expect(app.pendingConfirmation).toEqual({ kind: 'newRun', mode: 'normal' });
    app.cancelConfirmation();
    expect(app.pendingConfirmation).toBeNull();
    app.continueRun('normal');
    app.pause('escape');
    app.restart();
    expect(app.pendingConfirmation).toEqual({ kind: 'restart', mode: 'normal' });
    app.confirm();
    expect(app.screen).toBe('playing');
    expect(app.game?.run.elapsed).toBe(0);
  });

  it('opens settings from title and returns there', () => {
    const { app } = makeController();
    app.openSettings();
    expect(app.screen).toBe('settings');
    app.closeSettings();
    expect(app.screen).toBe('title');
  });

  it('confirms before resetting settings to defaults', () => {
    const { app } = makeController();
    app.updateSettings({ ...DEFAULT_SETTINGS, masterVolume: 0.25, screenShake: false });
    app.openSettings();

    app.resetSettings();
    expect(app.pendingConfirmation).toEqual({ kind: 'resetSettings' });
    expect(app.settings.masterVolume).toBe(0.25);

    app.confirm();
    expect(app.pendingConfirmation).toBeNull();
    expect(app.screen).toBe('settings');
    expect(app.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('AppController persistence policy', () => {
  it('writes a Normal run immediately when a checkpoint activates', () => {
    const { app, store } = makeController();
    app.openModeSelect();
    app.newRun('normal');
    const checkpoint = app.game!.world.sections[1].checkpoint;
    app.game!.run.checkpoint = { ...checkpoint, section: 1 };
    app.afterStep({ jumped: false, wallJumped: false, dashed: false, landed: 0, respawned: false, checkpointActivated: true, promptCompleted: null });
    expect(store.load().runs.normal).toMatchObject({
      kind: 'normal', stageId: 1, localSection: 1,
      bestHeight: app.game!.world.height - app.game!.run.bestY,
    });
  });

  it('autosaves Hard at five seconds but not before', () => {
    const { app, store } = makeController();
    app.openModeSelect();
    app.newRun('hard');
    app.advanceRealTime(4.99);
    expect(store.load().runs.hard).toBeNull();
    app.advanceRealTime(0.01);
    expect(store.load().runs.hard).toMatchObject({
      kind: 'hard', stageId: 1, localSection: 0,
      stageY: app.game!.world.height - app.game!.player.y,
    });
  });

  it('saves either mode on pause and quit', () => {
    const { app, store } = makeController();
    app.openModeSelect();
    app.newRun('hard');
    app.pause('visibility');
    expect(store.load().runs.hard).toMatchObject({ kind: 'hard' });
    app.resume();
    app.quitToTitle();
    expect(app.screen).toBe('title');
    expect(store.load().runs.hard).toMatchObject({ kind: 'hard' });
  });

  it('persists newly completed prompts and the best height with the run', () => {
    const { app, store } = makeController();
    app.openModeSelect();
    app.newRun('normal');
    app.game!.prompts.completed.add('dash');
    app.game!.run.bestY = app.game!.world.height - 900;
    app.afterStep({ jumped: false, wallJumped: false, dashed: true, landed: 0, respawned: false, checkpointActivated: false, promptCompleted: 'dash' });
    expect(store.load().completedPrompts).toEqual(['dash']);
    expect(store.load().records.normal.bestHeight).toBe(900);
  });

  it('persists settings updates immediately', () => {
    const { app, store } = makeController();
    app.updateSettings({ ...DEFAULT_SETTINGS, masterVolume: 0.25, screenShake: false });
    expect(app.settings).toMatchObject({ masterVolume: 0.25, screenShake: false });
    expect(store.load().settings).toMatchObject({ masterVolume: 0.25, screenShake: false });
  });

  it('clears only a geometrically invalid Continue snapshot', () => {
    const { app, store } = makeController();
    const invalid: HardRunSaveV2 = {
      kind: 'hard', stageId: 1, localSection: 0,
      x: 0, stageY: 80, vx: 0, vy: 0,
      elapsed: 1, falls: 0, bestHeight: 80,
    };
    store.update((save) => { save.runs.hard = invalid; });
    app.openModeSelect();
    expect(app.continueAvailable('hard')).toBe(true);
    expect(app.continueRun('hard')).toBe(false);
    expect(app.screen).toBe('modeSelect');
    expect(store.load().runs.hard).toBeNull();
    expect(app.notice?.message).toMatch(/could not be restored/i);
  });

  it('continues a Normal run after SaveStore migrates it from version 1', () => {
    const legacy: SaveDataV1 = {
      version: 1,
      settings: DEFAULT_SETTINGS,
      completedPrompts: ['jump'],
      runs: {
        normal: { kind: 'normal', stageId: 1, section: 2, elapsed: 12.5, falls: 3, bestY: 3300 },
        hard: null,
      },
      records: {
        normal: { bestHeight: 1600, bestTime: null, fewestFalls: null },
        hard: { bestHeight: 0, bestTime: null, fewestFalls: null },
      },
    };
    const storage = memoryStorage({ [SAVE_KEY_V1]: JSON.stringify(legacy) });
    const store = new SaveStore(storage);
    const app = new AppController(store);

    app.openModeSelect();

    expect(app.continueAvailable('normal')).toBe(true);
    expect(app.continueRun('normal')).toBe(true);
    expect(app.game?.currentSection).toBe(2);
    expect(app.game?.run).toMatchObject({ elapsed: 12.5, falls: 3, bestY: 3300 });
    expect(app.game?.completedPrompts()).toEqual(['jump']);
    expect(storage.getItem(SAVE_KEY_V1)).toBeNull();
    expect(storage.getItem(SAVE_KEY_V2)).not.toBeNull();
  });
});

describe('AppController pause gating', () => {
  it('steps only while playing and makes repeated auto-pause idempotent', () => {
    const { app } = makeController();
    expect(app.step(EMPTY_INPUT)).toBeNull();
    app.openModeSelect();
    app.newRun('normal');
    const before = app.game!.run.elapsed;
    expect(app.step(EMPTY_INPUT)).not.toBeNull();
    expect(app.game!.run.elapsed).toBeGreaterThan(before);
    app.pause('visibility');
    const pausedAt = app.game!.run.elapsed;
    app.pause('visibility');
    expect(app.step(EMPTY_INPUT)).toBeNull();
    expect(app.game!.run.elapsed).toBe(pausedAt);
  });
});
