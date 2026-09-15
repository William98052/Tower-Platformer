import { describe, expect, it } from 'vitest';
import { FixedStep } from '../../src/core/loop';

const STEP = 1 / 120;

describe('FixedStep', () => {
  it('runs 2 steps for one 60 Hz frame', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(1 / 60)).toBe(2);
  });

  it('carries leftover time into the next frame', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(1 / 240)).toBe(0);
    expect(loop.alpha).toBeCloseTo(0.5, 6);
    expect(loop.advance(1 / 240)).toBe(1);
    expect(loop.alpha).toBeCloseTo(0, 6);
  });

  it('clamps huge frame gaps to maxFrame', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(3)).toBe(30);
  });

  it('ignores negative frame times', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(-1)).toBe(0);
  });

  it('keeps alpha within [0, 1)', () => {
    const loop = new FixedStep(STEP, 0.25);
    for (const dt of [0.013, 0.007, 0.021, 0.0166, 0.0069]) {
      loop.advance(dt);
      expect(loop.alpha).toBeGreaterThanOrEqual(0);
      expect(loop.alpha).toBeLessThan(1);
    }
  });

  it('treats non-finite frame times as zero instead of breaking', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(Number.NaN)).toBe(0);
    expect(loop.advance(Number.POSITIVE_INFINITY)).toBe(0);
    expect(loop.advance(1 / 60)).toBe(2);
    expect(Number.isFinite(loop.alpha)).toBe(true);
  });

  it('does not drift over many frames at 144 Hz', () => {
    const loop = new FixedStep(STEP, 0.25);
    let steps = 0;
    for (let i = 0; i < 14400; i++) steps += loop.advance(1 / 144);
    // 100 seconds at 120 Hz; allow the final partial step to still be pending.
    expect(steps).toBeGreaterThanOrEqual(11999);
    expect(steps).toBeLessThanOrEqual(12000);
  });
});
