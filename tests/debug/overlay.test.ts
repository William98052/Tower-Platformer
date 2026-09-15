import { describe, expect, it } from 'vitest';
import { DebugOverlay, SLOW_MOTION_SCALE } from '../../src/debug/overlay';

describe('DebugOverlay', () => {
  it('toggles visibility with Backquote and consumes the key', () => {
    const d = new DebugOverlay();
    expect(d.handleKey('Backquote')).toBe(true);
    expect(d.visible).toBe(true);
    d.handleKey('Backquote');
    expect(d.visible).toBe(false);
  });

  it('toggles slow motion with T', () => {
    const d = new DebugOverlay();
    expect(d.timeScale).toBe(1);
    d.handleKey('KeyT');
    expect(d.timeScale).toBe(SLOW_MOTION_SCALE);
  });

  it('does not consume other keys', () => {
    expect(new DebugOverlay().handleKey('Space')).toBe(false);
  });

  it('counts frames in the last second', () => {
    const d = new DebugOverlay();
    d.recordFrame(0);
    d.recordFrame(500);
    d.recordFrame(999);
    expect(d.fps).toBe(3);
    d.recordFrame(1500);
    expect(d.fps).toBe(2);
  });
});
