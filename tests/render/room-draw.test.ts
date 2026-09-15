import { describe, expect, it } from 'vitest';
import { mossHeight } from '../../src/render/room-draw';

describe('mossHeight', () => {
  it('stays an integer within 2..5 for any tile index, including negative', () => {
    for (let i = -500; i <= 500; i++) {
      const h = mossHeight(i);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(2);
      expect(h).toBeLessThanOrEqual(5);
    }
  });

  it('varies along a platform instead of alternating between two heights', () => {
    const heights = new Set(Array.from({ length: 20 }, (_, n) => mossHeight(n * 14)));
    expect(heights.size).toBeGreaterThan(2);
  });
});
