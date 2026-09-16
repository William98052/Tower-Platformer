import type { RunSave, RunSaveV2 } from '../game/run-snapshot';
import { validateRunSave, validateRunSaveV2 } from '../game/run-snapshot';
import type { Mode } from '../modes/run-state';
import { TOWER } from '../stages/tower';
import type { PromptId, TowerDef } from '../stages/types';
import { DEFAULT_SETTINGS, type Settings, validateSettings } from './settings';

export const SAVE_KEY_V1 = 'tower-platformer.save.v1';
export const SAVE_KEY_V2 = 'tower-platformer.save.v2';
/** Compatibility alias for callers that only need the current save key. */
export const SAVE_KEY = SAVE_KEY_V2;

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

export interface SaveDataV2 {
  version: 2;
  settings: Settings;
  completedPrompts: PromptId[];
  runs: Record<Mode, RunSaveV2 | null>;
  records: Record<Mode, Records>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SAVE: SaveDataV2 = {
  version: 2,
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
  private cached: SaveDataV2 | null = null;

  constructor(private readonly storage: StorageLike | null | undefined) {}

  load(): SaveDataV2 {
    if (this.cached) return cloneSave(this.cached);
    if (!this.storage) {
      this.failStorage();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    let rawV2: string | null;
    try {
      rawV2 = this.storage.getItem(SAVE_KEY_V2);
    } catch {
      this.failStorage();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    if (rawV2 !== null) return this.loadV2(rawV2);
    return this.loadOrMigrateV1();
  }

  write(data: SaveDataV2): boolean {
    this.cached = validateDocumentV2(data as unknown as Record<string, unknown>);
    if (!this.storage || !this.available) return false;
    try {
      this.storage.setItem(SAVE_KEY_V2, JSON.stringify(this.cached));
      return true;
    } catch {
      this.failStorage();
      return false;
    }
  }

  update(mutator: (save: SaveDataV2) => void): SaveDataV2 {
    const next = this.load();
    mutator(next);
    this.write(next);
    return this.load();
  }

  private loadV2(raw: string): SaveDataV2 {
    const result = this.parseStoredValue(raw, SAVE_KEY_V2);
    if (!result.ok) return cloneSave(this.cached!);
    if (!isRecord(result.value) || result.value.version !== 2) {
      this.notice = 'This save version is not supported and was reset.';
      this.discardStoredValue(SAVE_KEY_V2);
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    this.cached = validateDocumentV2(result.value);
    return cloneSave(this.cached);
  }

  private loadOrMigrateV1(): SaveDataV2 {
    let rawV1: string | null;
    try {
      rawV1 = this.storage!.getItem(SAVE_KEY_V1);
    } catch {
      this.failStorage();
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    if (rawV1 === null) {
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    const result = this.parseStoredValue(rawV1, SAVE_KEY_V1);
    if (!result.ok) return cloneSave(this.cached!);
    const migrated = migrateV1(result.value);
    if (!migrated) {
      this.notice = 'This save version is not supported and was reset.';
      this.discardStoredValue(SAVE_KEY_V1);
      this.cached = cloneSave(DEFAULT_SAVE);
      return cloneSave(this.cached);
    }

    this.cached = migrated;
    try {
      this.storage!.setItem(SAVE_KEY_V2, JSON.stringify(this.cached));
    } catch {
      this.failStorage();
      return cloneSave(this.cached);
    }

    this.discardStoredValue(SAVE_KEY_V1);
    return cloneSave(this.cached);
  }

  private parseStoredValue(raw: string, key: string): { ok: true; value: unknown } | { ok: false } {
    try {
      return { ok: true, value: JSON.parse(raw) as unknown };
    } catch {
      this.notice = 'Corrupt save data was reset.';
      this.discardStoredValue(key);
      this.cached = cloneSave(DEFAULT_SAVE);
      return { ok: false };
    }
  }

  private discardStoredValue(key: string): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch {
      this.failStorage();
    }
  }

  private failStorage(): void {
    this.available = false;
    this.notice = STORAGE_NOTICE;
  }
}

export function migrateV1(value: SaveDataV1, tower?: TowerDef): SaveDataV2;
export function migrateV1(value: unknown, tower?: TowerDef): SaveDataV2 | null;
export function migrateV1(value: unknown, tower: TowerDef = TOWER): SaveDataV2 | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const legacy = validateDocumentV1(value);
  const moss = tower.stages.find((stage) => stage.id === 1);
  const mossHeight = moss?.sections.reduce((height, section) => height + section.height, 0);
  const hasLocalSection = (section: number): boolean =>
    moss?.sections.some((candidate) => candidate.id === section) ?? false;
  const migrateRun = (run: RunSave | null): RunSaveV2 | null => {
    if (!run || run.stageId !== 1 || mossHeight === undefined || !hasLocalSection(run.section)) return null;
    const common = {
      stageId: 1,
      localSection: run.section,
      elapsed: run.elapsed,
      falls: run.falls,
      bestHeight: mossHeight - run.bestY,
    };
    const migrated = run.kind === 'normal'
      ? { kind: 'normal' as const, ...common }
      : {
          kind: 'hard' as const,
          ...common,
          x: run.x,
          stageY: mossHeight - run.y,
          vx: run.vx,
          vy: run.vy,
        };
    return validateRunSaveV2(migrated, run.kind);
  };

  return {
    version: 2,
    settings: legacy.settings,
    completedPrompts: legacy.completedPrompts,
    runs: {
      normal: migrateRun(legacy.runs.normal),
      hard: migrateRun(legacy.runs.hard),
    },
    records: legacy.records,
  };
}

function validateDocumentV1(value: Record<string, unknown>): SaveDataV1 {
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

function validateDocumentV2(value: Record<string, unknown>): SaveDataV2 {
  const runs = isRecord(value.runs) ? value.runs : {};
  const records = isRecord(value.records) ? value.records : {};
  return {
    version: 2,
    settings: validateSettings(value.settings),
    completedPrompts: validatePrompts(value.completedPrompts),
    runs: {
      normal: validateRunSaveV2(runs.normal, 'normal'),
      hard: validateRunSaveV2(runs.hard, 'hard'),
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

function cloneSave(save: SaveDataV2): SaveDataV2 {
  return {
    version: 2,
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
