export interface NormalRunSave {
  kind: 'normal';
  stageId: number;
  section: number;
  elapsed: number;
  falls: number;
  bestY: number;
}

export interface HardRunSave {
  kind: 'hard';
  stageId: number;
  section: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  elapsed: number;
  falls: number;
  bestY: number;
}

export type RunSave = NormalRunSave | HardRunSave;

export interface RunLocation {
  stageId: number;
  localSection: number;
}

export interface NormalRunSaveV2 extends RunLocation {
  kind: 'normal';
  elapsed: number;
  falls: number;
  bestHeight: number;
}

export interface HardRunSaveV2 extends RunLocation {
  kind: 'hard';
  x: number;
  stageY: number;
  vx: number;
  vy: number;
  elapsed: number;
  falls: number;
  bestHeight: number;
}

export type RunSaveV2 = NormalRunSaveV2 | HardRunSaveV2;

export function validateRunSave(value: unknown, kind: RunSave['kind']): RunSave | null {
  if (!isRecord(value)
    || value.kind !== kind
    || !isIntegerBetween(value.stageId, 1, 10)
    || !isIntegerBetween(value.section, 0, 999)
    || !isNonNegativeNumber(value.elapsed)
    || !isIntegerBetween(value.falls, 0, Number.MAX_SAFE_INTEGER)
    || !isFiniteNumber(value.bestY)) {
    return null;
  }

  const common = {
    stageId: value.stageId,
    section: value.section,
    elapsed: value.elapsed,
    falls: value.falls,
    bestY: value.bestY,
  };
  if (kind === 'normal') return { kind, ...common };
  if (![value.x, value.y, value.vx, value.vy].every(isFiniteNumber)) return null;
  return { kind, ...common, x: value.x as number, y: value.y as number, vx: value.vx as number, vy: value.vy as number };
}

export function validateRunSaveV2(value: unknown, kind: RunSaveV2['kind']): RunSaveV2 | null {
  if (!isRecord(value)
    || value.kind !== kind
    || !isIntegerBetween(value.stageId, 1, 10)
    || !isIntegerBetween(value.localSection, 0, 999)
    || !isNonNegativeNumber(value.elapsed)
    || !isIntegerBetween(value.falls, 0, Number.MAX_SAFE_INTEGER)
    || !isNonNegativeNumber(value.bestHeight)) {
    return null;
  }

  const common = {
    stageId: value.stageId,
    localSection: value.localSection,
    elapsed: value.elapsed,
    falls: value.falls,
    bestHeight: value.bestHeight,
  };
  if (kind === 'normal') return { kind, ...common };
  if (![value.x, value.stageY, value.vx, value.vy].every(isFiniteNumber)) return null;
  return {
    kind,
    ...common,
    x: value.x as number,
    stageY: value.stageY as number,
    vx: value.vx as number,
    vy: value.vy as number,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
