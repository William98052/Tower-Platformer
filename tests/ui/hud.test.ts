import { describe, expect, it, vi } from 'vitest';
import { formatTime, progressRatio, stageProgressRatio } from '../../src/ui/hud';
import { drawHud } from '../../src/ui/overlay-draw';
import { Game } from '../../src/game/game';
import { threeStageTower } from '../helpers/tower';

describe('formatTime', () => {
  it('formats minutes, seconds, and milliseconds', () => {
    expect(formatTime(0)).toBe('00:00.000');
    expect(formatTime(65.432)).toBe('01:05.432');
    expect(formatTime(3599.999)).toBe('59:59.999');
  });
});

describe('progressRatio', () => {
  it('maps world y to bottom-to-top progress and clamps it', () => {
    expect(progressRatio(1000, 1000)).toBe(0);
    expect(progressRatio(500, 1000)).toBe(0.5);
    expect(progressRatio(0, 1000)).toBe(1);
    expect(progressRatio(-100, 1000)).toBe(1);
    expect(progressRatio(1200, 1000)).toBe(0);
  });
});

describe('stage progress', () => {
  it('places local height within the numbered stage tick, independent of total tower height', () => {
    expect(stageProgressRatio(8400, 2, 4200, 8400)).toBe(0.1);
    expect(stageProgressRatio(6300, 2, 4200, 8400)).toBe(0.15);
    expect(stageProgressRatio(4200, 2, 4200, 8400)).toBe(0.2);
    expect(stageProgressRatio(20000, 2, 4200, 8400)).toBe(0.1);
    expect(stageProgressRatio(-100, 2, 4200, 8400)).toBe(0.2);
  });

  it('draws the current stage name and the dot inside its stage tick', () => {
    const game = new Game('hard', threeStageTower);
    game.warp(10);
    const ctx = {
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    drawHud(ctx, game, 6300);
    expect(ctx.fillText).toHaveBeenCalledWith('CLOCKWORK HALL', 28, 500);
    expect(ctx.arc).toHaveBeenCalledWith(20, 414.2, 5, 0, Math.PI * 2);
  });
});
