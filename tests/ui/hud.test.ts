import { describe, expect, it } from 'vitest';
import { formatTime, progressRatio } from '../../src/ui/hud';

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
