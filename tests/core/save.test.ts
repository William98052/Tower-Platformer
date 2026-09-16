import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAVE,
  SAVE_KEY_V1,
  SAVE_KEY_V2,
  SaveStore,
  type SaveDataV1,
  type StorageLike,
} from '../../src/core/save';
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

const hardRun: HardRunSaveV2 = {
  kind: 'hard',
  stageId: 1,
  localSection: 3,
  x: 420,
  stageY: 3100,
  vx: 50,
  vy: -20,
  elapsed: 42.5,
  falls: 2,
  bestHeight: 3300,
};

const legacySave: SaveDataV1 = {
  version: 1,
  settings: DEFAULT_SAVE.settings,
  completedPrompts: ['jump'],
  runs: {
    normal: { kind: 'normal', stageId: 1, section: 3, elapsed: 12, falls: 1, bestY: 1700 },
    hard: {
      kind: 'hard', stageId: 1, section: 3,
      x: 420, y: 1800, vx: 50, vy: -20,
      elapsed: 42.5, falls: 2, bestY: 1600,
    },
  },
  records: {
    normal: { bestHeight: 3200, bestTime: null, fewestFalls: null },
    hard: { bestHeight: 3300, bestTime: null, fewestFalls: null },
  },
};

describe('SaveStore', () => {
  it('starts with independent defaults and round-trips a complete document', () => {
    const storage = memoryStorage();
    const first = new SaveStore(storage);
    const initial = first.load();
    expect(initial).toEqual(DEFAULT_SAVE);
    expect(initial).not.toBe(DEFAULT_SAVE);

    const changed = first.update((save) => {
      save.completedPrompts = ['jump'];
      save.runs.hard = hardRun;
      save.settings.masterVolume = 0.4;
    });
    expect(changed.completedPrompts).toEqual(['jump']);

    const loaded = new SaveStore(storage).load();
    expect(loaded.completedPrompts).toEqual(['jump']);
    expect(loaded.runs.hard).toEqual(hardRun);
    expect(loaded.settings.masterVolume).toBe(0.4);
  });

  it('discards corrupt JSON without preventing future saves', () => {
    const storage = memoryStorage({ [SAVE_KEY_V2]: '{not json' });
    const store = new SaveStore(storage);
    expect(store.load()).toEqual(DEFAULT_SAVE);
    expect(store.available).toBe(true);
    expect(store.notice).toMatch(/reset/i);
    expect(store.write(DEFAULT_SAVE)).toBe(true);
  });

  it('rejects unknown save versions', () => {
    const storage = memoryStorage({ [SAVE_KEY_V2]: JSON.stringify({ ...DEFAULT_SAVE, version: 99 }) });
    const store = new SaveStore(storage);
    expect(store.load()).toEqual(DEFAULT_SAVE);
    expect(store.notice).toMatch(/version/i);
  });

  it('rejects a non-object version 2 document without throwing', () => {
    const store = new SaveStore(memoryStorage({ [SAVE_KEY_V2]: 'null' }));

    expect(store.load()).toEqual(DEFAULT_SAVE);
    expect(store.notice).toMatch(/version/i);
  });

  it('drops only an invalid mode run while preserving valid data', () => {
    const raw = {
      ...DEFAULT_SAVE,
      completedPrompts: ['jump', 'jump', 'unknown'],
      runs: {
        normal: { kind: 'normal', stageId: 1, localSection: -4, elapsed: 10, falls: 1, bestHeight: 2 },
        hard: hardRun,
      },
    };
    const store = new SaveStore(memoryStorage({ [SAVE_KEY_V2]: JSON.stringify(raw) }));
    const loaded = store.load();
    expect(loaded.runs.normal).toBeNull();
    expect(loaded.runs.hard).toEqual(hardRun);
    expect(loaded.completedPrompts).toEqual(['jump']);
  });

  it('continues in memory when reading storage throws', () => {
    const storage: StorageLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const store = new SaveStore(storage);
    expect(store.load()).toEqual(DEFAULT_SAVE);
    expect(store.available).toBe(false);
    expect(store.notice).toMatch(/without saving/i);
  });

  it('preserves an update in memory when a write throws', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('full'); },
      removeItem: () => undefined,
    };
    const store = new SaveStore(storage);
    store.load();
    const updated = store.update((save) => { save.completedPrompts = ['dash']; });
    expect(updated.completedPrompts).toEqual(['dash']);
    expect(store.load().completedPrompts).toEqual(['dash']);
    expect(store.available).toBe(false);
  });

  it('migrates both version 1 run modes to stage-relative version 2 data', () => {
    const storage = memoryStorage({ [SAVE_KEY_V1]: JSON.stringify(legacySave) });

    const save = new SaveStore(storage).load();

    expect(save.version).toBe(2);
    expect(save.settings).toEqual(legacySave.settings);
    expect(save.completedPrompts).toEqual(['jump']);
    expect(save.records).toEqual(legacySave.records);
    expect(save.runs.normal).toEqual({
      kind: 'normal', stageId: 1, localSection: 3,
      elapsed: 12, falls: 1, bestHeight: 3200,
    });
    expect(save.runs.hard).toEqual(hardRun);
    expect(storage.getItem(SAVE_KEY_V1)).toBeNull();
    expect(storage.getItem(SAVE_KEY_V2)).not.toBeNull();
  });

  it('keeps the version 1 key and migrated in-memory data when the version 2 write fails', () => {
    const storage = memoryStorage({ [SAVE_KEY_V1]: JSON.stringify(legacySave) });
    storage.setItem = (key, value) => {
      if (key === SAVE_KEY_V2) throw new Error('full');
      storage.values.set(key, value);
    };
    const store = new SaveStore(storage);

    const save = store.load();

    expect(save.version).toBe(2);
    expect(save.runs.normal).toMatchObject({ stageId: 1, localSection: 3 });
    expect(save.runs.hard).toMatchObject({ stageId: 1, stageY: 3100 });
    expect(storage.getItem(SAVE_KEY_V1)).not.toBeNull();
    expect(storage.getItem(SAVE_KEY_V2)).toBeNull();
    expect(store.available).toBe(false);
    expect(store.notice).toMatch(/without saving/i);
    expect(store.load()).toEqual(save);
  });

  it('drops only a corrupt version 1 run during migration', () => {
    const corruptNormal = {
      ...legacySave,
      runs: {
        ...legacySave.runs,
        normal: { ...legacySave.runs.normal, bestY: Number.NaN },
      },
    };

    const save = new SaveStore(memoryStorage({ [SAVE_KEY_V1]: JSON.stringify(corruptNormal) })).load();

    expect(save.runs.normal).toBeNull();
    expect(save.runs.hard).toEqual(hardRun);
  });
});
