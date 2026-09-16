import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, effectsPolicy, replaceBinding, validateSettings } from '../../src/core/settings';

describe('game settings', () => {
  it('provides two familiar keyboard bindings for every action', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      masterVolume: 0.8,
      sfxVolume: 1,
      screenShake: true,
      reducedEffects: false,
    });
    expect(DEFAULT_SETTINGS.bindings).toEqual({
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      jump: ['Space', 'KeyC'],
      dash: ['ShiftLeft', 'KeyX'],
    });
  });

  it('clamps valid volume settings without changing valid preferences', () => {
    const settings = validateSettings({ ...DEFAULT_SETTINGS, masterVolume: 4, sfxVolume: -1 });
    expect(settings).toMatchObject({ masterVolume: 1, sfxVolume: 0, screenShake: true, reducedEffects: false });
  });

  it('falls back to a fresh default object when a settings shape is malformed', () => {
    const settings = validateSettings({ ...DEFAULT_SETTINGS, reducedEffects: 'yes' });
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings).not.toBe(DEFAULT_SETTINGS);
    expect(settings.bindings).not.toBe(DEFAULT_SETTINGS.bindings);
  });

  it('swaps a conflicting key instead of allowing two actions to share it', () => {
    const changed = replaceBinding(DEFAULT_SETTINGS, 'jump', 0, 'KeyA');
    expect(changed.bindings.jump).toEqual(['KeyA', 'KeyC']);
    expect(changed.bindings.left).toEqual(['ArrowLeft', 'Space']);
    expect(DEFAULT_SETTINGS.bindings.jump).toEqual(['Space', 'KeyC']);
  });

  it('derives presentation limits without changing gameplay rules', () => {
    expect(effectsPolicy(DEFAULT_SETTINGS)).toEqual({ shakeEnabled: true, particleScale: 1, particleLimit: 400, shadowBlur: true });
    expect(effectsPolicy({ ...DEFAULT_SETTINGS, screenShake: false, reducedEffects: true })).toEqual({
      shakeEnabled: false,
      particleScale: 0.5,
      particleLimit: 200,
      shadowBlur: false,
    });
  });
});
