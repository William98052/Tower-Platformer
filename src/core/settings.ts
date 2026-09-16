import type { Action } from './input';

export type SettingsBindings = Record<Action, readonly [string, string]>;

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  bindings: SettingsBindings;
  screenShake: boolean;
  reducedEffects: boolean;
}

export interface EffectsPolicy {
  shakeEnabled: boolean;
  particleScale: number;
  particleLimit: number;
  shadowBlur: boolean;
}

const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'jump', 'dash'];

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 1,
  bindings: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyC'],
    dash: ['ShiftLeft', 'KeyX'],
  },
  screenShake: true,
  reducedEffects: false,
};

export function validateSettings(value: unknown): Settings {
  if (!isRecord(value)
    || !isFiniteNumber(value.masterVolume)
    || !isFiniteNumber(value.sfxVolume)
    || typeof value.screenShake !== 'boolean'
    || typeof value.reducedEffects !== 'boolean'
    || !isRecord(value.bindings)) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  const bindings = {} as Record<Action, readonly [string, string]>;
  const used = new Set<string>();
  for (const action of ACTIONS) {
    const pair = value.bindings[action];
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((code) => typeof code !== 'string' || code.length === 0 || used.has(code))) {
      return cloneSettings(DEFAULT_SETTINGS);
    }
    const codes: readonly [string, string] = [pair[0], pair[1]];
    bindings[action] = codes;
    used.add(codes[0]);
    used.add(codes[1]);
  }

  return {
    masterVolume: clamp01(value.masterVolume),
    sfxVolume: clamp01(value.sfxVolume),
    bindings,
    screenShake: value.screenShake,
    reducedEffects: value.reducedEffects,
  };
}

export function replaceBinding(settings: Settings, action: Action, slot: 0 | 1, code: string): Settings {
  if (code.length === 0) return cloneSettings(settings);
  const next = cloneSettings(settings);
  const replaced = next.bindings[action][slot];
  if (replaced === code) return next;

  for (const candidate of ACTIONS) {
    const pair = [...next.bindings[candidate]] as [string, string];
    const conflict = pair.indexOf(code);
    if (conflict >= 0) {
      pair[conflict] = replaced;
      next.bindings[candidate] = pair;
      break;
    }
  }

  const pair = [...next.bindings[action]] as [string, string];
  pair[slot] = code;
  next.bindings[action] = pair;
  return next;
}

export function effectsPolicy(settings: Settings): EffectsPolicy {
  return {
    shakeEnabled: settings.screenShake,
    particleScale: settings.reducedEffects ? 0.5 : 1,
    particleLimit: settings.reducedEffects ? 200 : 400,
    shadowBlur: !settings.reducedEffects,
  };
}

function cloneSettings(settings: Settings): Settings {
  const bindings = {} as Record<Action, readonly [string, string]>;
  for (const action of ACTIONS) bindings[action] = [...settings.bindings[action]] as [string, string];
  return { ...settings, bindings };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
