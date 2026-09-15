import { describe, expect, it } from 'vitest';
import { MAX_FALL } from '../../src/core/constants';
import { Afterimages, Particles, Squash, squashScale } from '../../src/render/effects';

const DUST = { count: 6, speed: 100, color: '#fff', size: 3, life: 0.3 };

describe('Particles', () => {
  it('spawns a burst at the origin', () => {
    const ps = new Particles();
    ps.burst(10, 20, DUST);
    expect(ps.list).toHaveLength(6);
    expect(ps.list.every((p) => p.x === 10 && p.y === 20)).toBe(true);
  });

  it('removes particles when their life runs out', () => {
    const ps = new Particles();
    ps.burst(0, 0, DUST);
    ps.update(0.2);
    expect(ps.list).toHaveLength(6);
    ps.update(0.2);
    expect(ps.list).toHaveLength(0);
  });

  it('never holds more than max particles', () => {
    const ps = new Particles(5);
    ps.burst(0, 0, { ...DUST, count: 8 });
    expect(ps.list).toHaveLength(5);
  });

  it('aims bursts using angle and spread', () => {
    const ps = new Particles();
    ps.burst(0, 0, { ...DUST, count: 1, angle: 0, spread: 1 }, () => 0.5);
    expect(ps.list[0].vx).toBeCloseTo(70, 6);
    expect(ps.list[0].vy).toBeCloseTo(0, 6);
  });

  it('applies gravity', () => {
    const ps = new Particles();
    ps.burst(0, 0, { ...DUST, count: 1, angle: 0, spread: 0 }, () => 0.5);
    ps.update(0.1, 1000);
    expect(ps.list[0].vy).toBeGreaterThan(0);
  });
});

describe('squashScale', () => {
  it('is neutral for a gentle landing', () => {
    expect(squashScale(0)).toEqual({ sx: 1, sy: 1 });
  });

  it('is strongest at max fall speed and clamps beyond it', () => {
    expect(squashScale(MAX_FALL).sx).toBeCloseTo(1.35, 6);
    expect(squashScale(MAX_FALL).sy).toBeCloseTo(0.65, 6);
    expect(squashScale(MAX_FALL * 10)).toEqual(squashScale(MAX_FALL));
  });
});

describe('Squash', () => {
  it('springs back to neutral', () => {
    const s = new Squash();
    s.set(1.3, 0.7);
    for (let i = 0; i < 60; i++) s.update(1 / 60);
    expect(s.sx).toBeCloseTo(1, 3);
    expect(s.sy).toBeCloseTo(1, 3);
  });
});

describe('Afterimages', () => {
  it('fade out after their lifetime', () => {
    const a = new Afterimages(0.1);
    a.add(5, 5);
    a.update(0.05);
    expect(a.items).toHaveLength(1);
    a.update(0.06);
    expect(a.items).toHaveLength(0);
  });
});
