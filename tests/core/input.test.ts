import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, InputTracker, NO_PAD, readPad, withoutPresses } from '../../src/core/input';

function pad(pressed: number[], axes: number[] = [0, 0]) {
  const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) }));
  return { axes, buttons };
}

describe('InputTracker keyboard', () => {
  it('maps held arrow keys and WASD to movement axes', () => {
    const t = new InputTracker();
    t.keyDown('ArrowRight');
    t.keyDown('KeyW');
    const f = t.sample();
    expect(f.moveX).toBe(1);
    expect(f.moveY).toBe(-1);
  });

  it('cancels opposite directions', () => {
    const t = new InputTracker();
    t.keyDown('KeyA');
    t.keyDown('KeyD');
    expect(t.sample().moveX).toBe(0);
  });

  it('reports jumpPressed only on the first sample after the press', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    const first = t.sample();
    expect(first.jump).toBe(true);
    expect(first.jumpPressed).toBe(true);
    const second = t.sample();
    expect(second.jump).toBe(true);
    expect(second.jumpPressed).toBe(false);
  });

  it('ignores key-repeat keydown events', () => {
    const t = new InputTracker();
    t.keyDown('KeyX');
    t.sample();
    t.keyDown('KeyX');
    expect(t.sample().dashPressed).toBe(false);
  });

  it('keeps a tap that happens entirely between samples', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.keyUp('Space');
    const f = t.sample();
    expect(f.jumpPressed).toBe(true);
    expect(f.jump).toBe(false);
  });

  it('does not treat W or Up as jump', () => {
    const t = new InputTracker();
    t.keyDown('KeyW');
    t.keyDown('ArrowUp');
    const f = t.sample();
    expect(f.jump).toBe(false);
    expect(f.jumpPressed).toBe(false);
  });

  it('releaseAll clears held and pending presses', () => {
    const t = new InputTracker();
    t.keyDown('ShiftLeft');
    t.keyDown('ArrowLeft');
    t.releaseAll();
    const f = t.sample();
    expect(f.moveX).toBe(0);
    expect(f.dashPressed).toBe(false);
  });

  it('re-holds a key from a repeat event after releaseAll without firing a press', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.sample();
    t.releaseAll();
    t.keyDown('Space', true);
    expect(t.sample()).toMatchObject({ jump: true, jumpPressed: false });
  });

  it('a fresh press after releaseAll produces a new edge', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.sample();
    t.releaseAll();
    expect(t.sample().jump).toBe(false);
    t.keyUp('Space'); // late keyup after refocus is a no-op
    t.keyDown('Space');
    expect(t.sample()).toMatchObject({ jump: true, jumpPressed: true });
  });

  it('a second key bound to jump fires a new press, and jump stays held until both are released', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.sample();
    t.keyDown('KeyC');
    expect(t.sample().jumpPressed).toBe(true);
    t.keyUp('Space');
    expect(t.sample().jump).toBe(true);
    t.keyUp('KeyC');
    expect(t.sample().jump).toBe(false);
  });

  it('honours injected bindings', () => {
    const t = new InputTracker({ ...DEFAULT_BINDINGS, jump: ['KeyZ'] });
    t.keyDown('Space');
    expect(t.sample().jumpPressed).toBe(false);
    t.keyDown('KeyZ');
    expect(t.sample().jumpPressed).toBe(true);
  });

  it('releases held input when live bindings change', () => {
    const t = new InputTracker();
    t.keyDown('KeyA');
    t.keyDown('Space');
    t.setBindings({ ...DEFAULT_BINDINGS, left: ['KeyJ'], jump: ['KeyK'] });
    expect(t.sample()).toMatchObject({ moveX: 0, jump: false, jumpPressed: false });
    t.keyDown('KeyJ');
    t.keyDown('KeyK');
    expect(t.sample()).toMatchObject({ moveX: -1, jump: true, jumpPressed: true });
  });
});

describe('readPad', () => {
  it('returns NO_PAD when no gamepad is connected', () => {
    expect(readPad(null)).toEqual(NO_PAD);
  });

  it('uses the left stick past the deadzone', () => {
    expect(readPad(pad([], [0.3, 0])).right).toBe(false);
    expect(readPad(pad([], [0.8, -0.9]))).toMatchObject({ right: true, up: true });
  });

  it('maps d-pad, A to jump, and X or RB to dash', () => {
    expect(readPad(pad([14, 0]))).toMatchObject({ left: true, jump: true, dash: false });
    expect(readPad(pad([2])).dash).toBe(true);
    expect(readPad(pad([5])).dash).toBe(true);
  });
});

describe('InputTracker gamepad merge', () => {
  it('detects pad button edges across samples', () => {
    const t = new InputTracker();
    const held = readPad(pad([0]));
    expect(t.sample(held).jumpPressed).toBe(true);
    expect(t.sample(held).jumpPressed).toBe(false);
    expect(t.sample(NO_PAD).jump).toBe(false);
    expect(t.sample(held).jumpPressed).toBe(true);
  });

  it('merges keyboard and pad, detects the pad dash edge, and releases on disconnect', () => {
    const t = new InputTracker();
    const rb = readPad(pad([5]));
    t.keyDown('ArrowLeft');
    expect(t.sample(rb)).toMatchObject({ moveX: -1, dashPressed: true });
    expect(t.sample(rb).dashPressed).toBe(false);
    expect(t.sample(readPad(null)).dashPressed).toBe(false);
  });
});

describe('withoutPresses', () => {
  it('clears edge flags but keeps held state', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.keyDown('KeyX');
    t.keyDown('ArrowRight');
    const f = withoutPresses(t.sample());
    expect(f).toEqual({ moveX: 1, moveY: 0, jump: true, jumpPressed: false, dashPressed: false });
  });
});
