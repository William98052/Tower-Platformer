import { describe, expect, it, vi } from 'vitest';
import { DebugOverlay, SLOW_MOTION_SCALE } from '../../src/debug/overlay';
import { createPlayer } from '../../src/physics/player';

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D & Record<'save' | 'fillText', ReturnType<typeof vi.fn>>;
}

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

  it('queues noclip, mode, and section-warp commands once', () => {
    const d = new DebugOverlay();
    expect(d.handleKey('KeyN')).toBe(true);
    expect(d.handleKey('KeyM')).toBe(true);
    expect(d.handleKey('BracketLeft')).toBe(true);
    expect(d.handleKey('BracketRight')).toBe(true);
    expect(d.takeCommand()).toEqual({ type: 'toggleNoclip' });
    expect(d.takeCommand()).toEqual({ type: 'toggleMode' });
    expect(d.takeCommand()).toEqual({ type: 'warp', delta: -1 });
    expect(d.takeCommand()).toEqual({ type: 'warp', delta: 1 });
    expect(d.takeCommand()).toBeNull();
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

  it('draws nothing when hidden and not in slow motion', () => {
    const ctx = mockCtx();
    new DebugOverlay().draw(ctx, createPlayer(0, 0), [], 0, 0, 1);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('still shows a SLOW-MO badge when slow motion is on but the overlay is hidden', () => {
    const d = new DebugOverlay();
    d.handleKey('KeyT');
    const ctx = mockCtx();
    d.draw(ctx, createPlayer(0, 0), [], 0, 0, 1);
    expect(ctx.fillText).toHaveBeenCalledWith('SLOW-MO', expect.any(Number), expect.any(Number));
  });

  it('draws mode, section, and noclip status when visible', () => {
    const d = new DebugOverlay();
    d.handleKey('Backquote');
    const ctx = mockCtx();
    d.draw(ctx, createPlayer(0, 0), [], 0, 0, 1, { mode: 'hard', stageId: 2, localSection: 4, noclip: true });
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('mode hard'), expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('Stage 2 / Section 5'), expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('noclip true'), expect.any(Number), expect.any(Number));
  });
});
