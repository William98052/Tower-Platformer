import type { RunSave } from '../game/run-snapshot';
import { validateRunSave } from '../game/run-snapshot';
import type { Mode } from '../modes/run-state';
import type { PromptId } from '../stages/types';
import { DEFAULT_SETTINGS, type Settings, validateSettings } from './settings';

export const SAVE_KEY = 'tower-platformer.save.v1';

export interface Records {
  bestHeight: number;
  bestTime: number | null;
  fewestFalls: number | null;
}

export interface SaveDataV1 {
  version: 1;
  settings: Settings;
  completedPrompts: PromptId[];
  runs: Record<Mode, RunSave | null>;
  records: Record<Mode, Records>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SAVE: SaveDataV1 = {
  version: 1,
  settings: validateSettings(DEFAULT_SETTINGS),
  completedPrompts: [],
  runs: { normal: null, hard: null },
  records: {
    normal: { bestHeight: 0, bestTime: null, fewestFalls: null },
    hard: { bestHeight: 0, bestTime: null, fewestFalls: null },
  },
};

const STORAGE_NOTICE = 'Saving is unavailable. This session will continue without saving.';

export class SaveStore {
  available = true;
  notice: string | null = null;
  private cached: SaveDataV1 | null = null;

  constructor(private readonly storage: StorageLike | null | undefined) {}

  load(): SaveDataV1 {
    if (this.cached) return cloneSave(this.cached);
    if (!this.storage) {
      this.failStorage();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    let raw: string | null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch {
      this.failStorage();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    if (raw === null) {
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.notice = 'Corrupt save data was reset.';
      this.discardStoredValue();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    if (!isRecord(parsed) || parsed.version !== 1) {
      this.notice = 'This save version is not supported and was reset.';
      this.discardStoredValue();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    this.cached = validateDocument(parsed);
    return cloneSave(this.cached);
  }

  write(data: SaveDataV1): boolean {
    this.cached = validateDocument(data as unknown as Record<string, unknown>);
    if (!this.storage || !this.available) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.cached));
      return true;
    } catch {
      this.failStorage();
      return false;
    }
  }

  update(mutator: (save: SaveDataV1) => void): SaveDataV1 {
    const next = this.load();
    mutator(next);
    this.write(next);
    return this.load();
  }

  private discardStoredValue(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      this.failStorage();
    }
  }

  private failStorage(): void {
    this.available = false;
    this.notice = STORAGE_NOTICE;
  }
}

function validateDocument(value: Record<string, unknown>): SaveDataV1 {
  const runs = isRecord(value.runs) ? value.runs : {};
  const records = isRecord(value.records) ? value.records : {};
  return {
    version: 1,
    settings: validateSettings(value.settings),
    completedPrompts: validatePrompts(value.completedPrompts),
    runs: {
      normal: validateRunSave(runs.normal, 'normal'),
      hard: validateRunSave(runs.hard, 'hard'),
    },
    records: {
      normal: validateRecords(records.normal),
      hard: validateRecords(records.hard),
    },
  };
}

function validatePrompts(value: unknown): PromptId[] {
  if (!Array.isArray(value)) return [];
  const known: readonly PromptId[] = ['jump', 'wallJump', 'dash'];
  return known.filter((id) => value.includes(id));
}

function validateRecords(value: unknown): Records {
  if (!isRecord(value)) return { bestHeight: 0, bestTime: null, fewestFalls: null };
  return {
    bestHeight: nonNegative(value.bestHeight) ?? 0,
    bestTime: nullableNonNegative(value.bestTime),
    fewestFalls: nullableNonNegativeInteger(value.fewestFalls),
  };
}

function cloneSave(save: SaveDataV1): SaveDataV1 {
  return {
    version: 1,
    settings: validateSettings(save.settings),
    completedPrompts: [...save.completedPrompts],
    runs: {
      normal: save.runs.normal ? { ...save.runs.normal } : null,
      hard: save.runs.hard ? { ...save.runs.hard } : null,
    },
    records: {
      normal: { ...save.records.normal },
      hard: { ...save.records.hard },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function nullableNonNegative(value: unknown): number | null {
  return value === null ? null : nonNegative(value);
}

function nullableNonNegativeInteger(value: unknown): number | null {
  return value === null ? null : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
