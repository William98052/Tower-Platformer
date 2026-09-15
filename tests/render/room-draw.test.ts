import { describe, expect, it } from 'vitest';
import { mossHeight, solidStyle, surfaceColors } from '../../src/render/room-draw';

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

describe('surfaceColors', () => {
  it('gives every Stage 1 surface a distinct readable treatment', () => {
    const surfaces = ['normal', 'oneWay', 'vine', 'bouncy', 'slopeUp', 'slopeDown'] as const;
    const treatments = surfaces.map((surface) => surfaceColors(surface));
    expect(new Set(treatments.map((item) => `${item.body}/${item.edge}`)).size).toBe(surfaces.length);
  });

  it('visually prioritizes the main route over recovery ledges', () => {
    expect(solidStyle('main').alpha).toBe(1);
    expect(solidStyle('recovery').alpha).toBeLessThan(0.7);
    expect(solidStyle('boundary').alpha).toBeLessThan(1);
  });
});
