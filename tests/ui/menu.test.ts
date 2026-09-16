import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { actionFromControl, menuButtons, settingsRows, type MenuModel } from '../../src/ui/menu';

const model: MenuModel = {
  screen: 'title',
  settings: DEFAULT_SETTINGS,
  canContinueNormal: false,
  canContinueHard: false,
  pendingConfirmation: null,
};

describe('menu model', () => {
  it('shows only the actions valid for the current screen', () => {
    expect(menuButtons(model)).toEqual(['play', 'settings']);
    expect(menuButtons({ ...model, screen: 'paused' })).toEqual(['resume', 'restart', 'settings', 'quit']);
    expect(menuButtons({ ...model, screen: 'modeSelect', canContinueNormal: true })).toEqual([
      'new-normal', 'continue-normal', 'new-hard', 'back',
    ]);
  });

  it('replaces screen actions with confirmation controls when required', () => {
    expect(menuButtons({ ...model, screen: 'paused', pendingConfirmation: { kind: 'restart', mode: 'normal' } })).toEqual(['confirm', 'cancel']);
  });

  it('describes two sliders, six binding rows, and two effect toggles', () => {
    const rows = settingsRows(DEFAULT_SETTINGS);
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.id)).toEqual([
      'masterVolume', 'sfxVolume', 'left', 'right', 'up', 'down', 'jump', 'dash', 'screenShake', 'reducedEffects',
    ]);
    expect(rows.find((row) => row.id === 'jump')).toMatchObject({ kind: 'bindings', values: ['Space', 'KeyC'] });
  });

  it('maps controls to typed application actions', () => {
    expect(actionFromControl('new-hard')).toEqual({ type: 'newRun', mode: 'hard' });
    expect(actionFromControl('continue-normal')).toEqual({ type: 'continueRun', mode: 'normal' });
    expect(actionFromControl('masterVolume', '0.35')).toEqual({ type: 'setVolume', name: 'masterVolume', value: 0.35 });
    expect(actionFromControl('screenShake', undefined, false)).toEqual({ type: 'setToggle', name: 'screenShake', value: false });
    expect(actionFromControl('bind-jump-1')).toEqual({ type: 'beginBinding', action: 'jump', slot: 1 });
  });
});
