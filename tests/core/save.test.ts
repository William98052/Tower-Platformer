import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, SAVE_KEY, SaveStore, type StorageLike } from '../../src/core/save';
import type { HardRunSave } from '../../src/game/run-snapshot';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const hardRun: HardRunSave = {
  kind: 'hard',
  stageId: 1,
  section: 3,
  x: 420,
  y: 1800,
  vx: 50,
  vy: -20,
  elapsed: 42.5,
  falls: 2,
  bestY: 1600,
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
    const storage = memoryStorage({ [SAVE_KEY]: '{not json' });
    const store = new SaveStore(storage);
    expect(store.load()).toEqual(DEFAULT_SAVE);
    expect(store.available).toBe(true);
    expect(store.notice).toMatch(/reset/i);
    expect(store.write(DEFAULT_SAVE)).toBe(true);
  });

  it('rejects unknown save versions', () => {
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify({ ...DEFAULT_SAVE, version: 99 }) });
    const store = new SaveStore(storage);
    expect(store.load()).toEqual(DEFAULT_SAVE);
    expect(store.notice).toMatch(/version/i);
  });

  it('drops only an invalid mode run while preserving valid data', () => {
    const raw = {
      ...DEFAULT_SAVE,
      completedPrompts: ['jump', 'jump', 'unknown'],
      runs: {
        normal: { kind: 'normal', stageId: 1, section: -4, elapsed: 10, falls: 1, bestY: 2 },
        hard: hardRun,
      },
    };
    const store = new SaveStore(memoryStorage({ [SAVE_KEY]: JSON.stringify(raw) }));
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
});
