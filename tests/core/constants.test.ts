import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';

describe('tuning constants', () => {
  it('physics runs at 120 Hz', () => {
    expect(C.STEP).toBeCloseTo(1 / 120, 10);
  });

  it('jump apex is about 155 units', () => {
    const apex = (C.JUMP_VELOCITY * C.JUMP_VELOCITY) / (2 * C.GRAVITY);
    expect(apex).toBeGreaterThan(150);
    expect(apex).toBeLessThan(160);
  });

  it('no single physics step moves further than the thinnest allowed solid', () => {
    const fastest = Math.max(C.MAX_FALL, C.DASH_SPEED, C.JUMP_VELOCITY);
    expect(fastest * C.STEP).toBeLessThan(C.MIN_SOLID_THICKNESS);
  });

  it('dash covers more ground than a running jump gap needs', () => {
    expect(C.DASH_SPEED * C.DASH_TIME).toBeGreaterThan(100);
  });
});
