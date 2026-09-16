import type { PendingConfirmation, Screen } from '../app/controller';
import type { Action } from '../core/input';
import type { Settings } from '../core/settings';

export interface MenuModel {
  screen: Screen;
  settings: Settings;
  canContinueNormal: boolean;
  canContinueHard: boolean;
  pendingConfirmation: PendingConfirmation | null;
}

export type MenuAction =
  | { type: 'play' | 'openSettings' | 'back' | 'resume' | 'restart' | 'quit' | 'resetSettings' | 'confirm' | 'cancel' }
  | { type: 'newRun' | 'continueRun'; mode: 'normal' | 'hard' }
  | { type: 'setVolume'; name: 'masterVolume' | 'sfxVolume'; value: number }
  | { type: 'setToggle'; name: 'screenShake' | 'reducedEffects'; value: boolean }
  | { type: 'beginBinding'; action: Action; slot: 0 | 1 }
  | { type: 'replaceBinding'; action: Action; slot: 0 | 1; code: string };

export type SettingsRow =
  | { id: 'masterVolume' | 'sfxVolume'; kind: 'volume'; value: number }
  | { id: Action; kind: 'bindings'; values: readonly [string, string] }
  | { id: 'screenShake' | 'reducedEffects'; kind: 'toggle'; value: boolean };

const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'jump', 'dash'];

export function menuButtons(model: MenuModel): string[] {
  if (model.pendingConfirmation) return ['confirm', 'cancel'];
  switch (model.screen) {
    case 'title': return ['play', 'settings'];
    case 'modeSelect': return [
      'new-normal',
      ...(model.canContinueNormal ? ['continue-normal'] : []),
      'new-hard',
      ...(model.canContinueHard ? ['continue-hard'] : []),
      'back',
    ];
    case 'paused': return ['resume', 'restart', 'settings', 'quit'];
    case 'settings': return ['reset', 'back'];
    case 'playing': return [];
  }
}

export function settingsRows(settings: Settings): SettingsRow[] {
  return [
    { id: 'masterVolume', kind: 'volume', value: settings.masterVolume },
    { id: 'sfxVolume', kind: 'volume', value: settings.sfxVolume },
    ...ACTIONS.map((action): SettingsRow => ({ id: action, kind: 'bindings', values: settings.bindings[action] })),
    { id: 'screenShake', kind: 'toggle', value: settings.screenShake },
    { id: 'reducedEffects', kind: 'toggle', value: settings.reducedEffects },
  ];
}

export function actionFromControl(id: string, value?: string, checked?: boolean): MenuAction | null {
  const simple: Record<string, MenuAction['type']> = {
    play: 'play', settings: 'openSettings', back: 'back', resume: 'resume', restart: 'restart', quit: 'quit',
    reset: 'resetSettings', confirm: 'confirm', cancel: 'cancel',
  };
  if (id in simple) return { type: simple[id] } as MenuAction;
  if (id === 'new-normal' || id === 'new-hard') return { type: 'newRun', mode: id.endsWith('hard') ? 'hard' : 'normal' };
  if (id === 'continue-normal' || id === 'continue-hard') return { type: 'continueRun', mode: id.endsWith('hard') ? 'hard' : 'normal' };
  if (id === 'masterVolume' || id === 'sfxVolume') {
    const amount = Number(value);
    return Number.isFinite(amount) ? { type: 'setVolume', name: id, value: amount } : null;
  }
  if (id === 'screenShake' || id === 'reducedEffects') return { type: 'setToggle', name: id, value: Boolean(checked) };
  const binding = /^bind-(left|right|up|down|jump|dash)-([01])$/.exec(id);
  if (binding) return { type: 'beginBinding', action: binding[1] as Action, slot: Number(binding[2]) as 0 | 1 };
  return null;
}

export class MenuView {
  private capture: { action: Action; slot: 0 | 1 } | null = null;
  private readonly onClick = (event: Event) => this.handleControl(event);
  private readonly onInput = (event: Event) => this.handleControl(event);
  private readonly onTrapKey = (event: KeyboardEvent) => this.trapFocus(event);
  private readonly onCaptureKey = (event: KeyboardEvent) => this.captureKey(event);
  private readonly onCaptureBlur = () => this.cancelBindingCapture();

  constructor(
    private readonly root: HTMLElement,
    private readonly notice: HTMLElement,
    private readonly dispatch: (action: MenuAction) => void,
  ) {
    root.addEventListener('click', this.onClick);
    root.addEventListener('input', this.onInput);
    root.addEventListener('keydown', this.onTrapKey);
  }

  render(model: MenuModel): void {
    this.cancelBindingCapture();
    this.root.hidden = model.screen === 'playing' && !model.pendingConfirmation;
    this.root.innerHTML = model.pendingConfirmation
      ? renderConfirmation(model.pendingConfirmation)
      : renderScreen(model);
    if (!this.root.hidden) queueMicrotask(() => this.focusFirst());
  }

  showNotice(message: string): void {
    this.notice.textContent = message;
    this.notice.classList.add('is-visible');
  }

  beginBindingCapture(action: Action, slot: 0 | 1): void {
    this.cancelBindingCapture();
    this.capture = { action, slot };
    const button = this.root.querySelector<HTMLButtonElement>(`[data-action="bind-${action}-${slot}"]`);
    if (button) {
      button.textContent = 'Press a key…';
      button.classList.add('is-capturing');
    }
    window.addEventListener('keydown', this.onCaptureKey, true);
    window.addEventListener('blur', this.onCaptureBlur, { once: true });
  }

  destroy(): void {
    this.cancelBindingCapture();
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('input', this.onInput);
    this.root.removeEventListener('keydown', this.onTrapKey);
  }

  private handleControl(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest<HTMLElement>('[data-action]');
    if (!control) return;
    if (event.type === 'click' && (control instanceof HTMLInputElement)) return;
    const action = actionFromControl(
      control.dataset.action ?? '',
      control instanceof HTMLInputElement ? control.value : undefined,
      control instanceof HTMLInputElement ? control.checked : undefined,
    );
    if (action) this.dispatch(action);
  }

  private captureKey(event: KeyboardEvent): void {
    if (!this.capture) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
      this.cancelBindingCapture();
      return;
    }
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(event.code)) return;
    const { action, slot } = this.capture;
    this.cancelBindingCapture();
    this.dispatch({ type: 'replaceBinding', action, slot, code: event.code });
  }

  private cancelBindingCapture(): void {
    this.capture = null;
    window.removeEventListener('keydown', this.onCaptureKey, true);
    window.removeEventListener('blur', this.onCaptureBlur);
  }

  private focusFirst(): void {
    this.root.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus();
  }

  private trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
    if (focusable.length === 0) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (current <= 0 ? focusable.length - 1 : current - 1)
      : (current >= focusable.length - 1 ? 0 : current + 1);
    event.preventDefault();
    focusable[next].focus();
  }
}

function renderScreen(model: MenuModel): string {
  switch (model.screen) {
    case 'title': return panel('Tower Platformer', '<p class="menu-kicker">Climb beyond the ruins</p>' + button('play', 'Play') + button('settings', 'Settings'));
    case 'modeSelect': return panel('Choose a mode', `
      <div class="mode-cards">
        <section class="mode-card"><h2>Normal</h2><p>Section checkpoints and quick recovery.</p>${button('new-normal', 'New Run')}${model.canContinueNormal ? button('continue-normal', 'Continue') : ''}</section>
        <section class="mode-card"><h2>Hard</h2><p>No checkpoints. Every fall is real.</p>${button('new-hard', 'New Run')}${model.canContinueHard ? button('continue-hard', 'Continue') : ''}</section>
      </div>${button('back', 'Back', 'secondary')}`);
    case 'paused': return panel('Paused', button('resume', 'Resume') + button('restart', 'Restart') + button('settings', 'Settings') + button('quit', 'Quit to Menu', 'secondary'));
    case 'settings': return panel('Settings', renderSettings(model.settings) + button('reset', 'Reset Defaults', 'secondary') + button('back', 'Back'));
    case 'playing': return '';
  }
}

function renderConfirmation(pending: PendingConfirmation): string {
  const message = pending.kind === 'restart'
    ? 'Restart this run from the beginning?'
    : pending.kind === 'resetSettings'
      ? 'Restore every setting and key binding to its default?'
      : `Replace the saved ${pending.mode} run?`;
  return panel('Are you sure?', `<p>${message}</p>${button('confirm', 'Confirm')}${button('cancel', 'Cancel', 'secondary')}`);
}

function renderSettings(settings: Settings): string {
  return settingsRows(settings).map((row) => {
    if (row.kind === 'volume') return `<label class="setting-row"><span>${label(row.id)}</span><input data-action="${row.id}" type="range" min="0" max="1" step="0.05" value="${row.value}"></label>`;
    if (row.kind === 'toggle') return `<label class="setting-row"><span>${label(row.id)}</span><input data-action="${row.id}" type="checkbox" ${row.value ? 'checked' : ''}></label>`;
    return `<div class="setting-row binding-row"><span>${label(row.id)}</span><span>${row.values.map((code, slot) => `<button data-action="bind-${row.id}-${slot}" class="key-button">${keyLabel(code)}</button>`).join('')}</span></div>`;
  }).join('');
}

function panel(title: string, content: string): string {
  return `<div class="menu-backdrop"><main class="menu-panel" aria-modal="true" role="dialog"><h1>${title}</h1>${content}</main></div>`;
}

function button(action: string, text: string, className = ''): string {
  return `<button data-action="${action}" class="menu-button ${className}">${text}</button>`;
}

function label(id: string): string {
  const labels: Record<string, string> = {
    masterVolume: 'Master volume', sfxVolume: 'SFX volume', left: 'Move left', right: 'Move right',
    up: 'Aim up', down: 'Aim down', jump: 'Jump', dash: 'Dash', screenShake: 'Screen shake', reducedEffects: 'Reduced effects',
  };
  return labels[id] ?? id;
}

function keyLabel(code: string): string {
  return code.replace(/^Key/, '').replace(/^Arrow/, '').replace('ShiftLeft', 'Left Shift');
}
