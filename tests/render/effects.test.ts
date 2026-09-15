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

  it('cap drops the oldest particle, not the newest', () => {
    const ps = new Particles(3);
    for (const color of ['a', 'b', 'c', 'd']) ps.burst(0, 0, { ...DUST, count: 1, color });
    expect(ps.list.map((p) => p.color)).toEqual(['b', 'c', 'd']);
  });

  it('drag slows particles over time', () => {
    const ps = new Particles();
    ps.burst(0, 0, { ...DUST, count: 1, life: 10, angle: 0, spread: 0 }, () => 0.5);
    const before = Math.hypot(ps.list[0].vx, ps.list[0].vy);
    ps.update(0.5);
    expect(Math.hypot(ps.list[0].vx, ps.list[0].vy)).toBeLessThan(before);
  });

  it('ignores bursts with no count or no life', () => {
    const ps = new Particles();
    ps.burst(0, 0, { ...DUST, count: 0 });
    ps.burst(0, 0, { ...DUST, count: -3 });
    ps.burst(0, 0, { ...DUST, life: 0 });
    expect(ps.list).toHaveLength(0);
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

describe('negative time steps', () => {
  it('leave particles, squash and afterimages unchanged', () => {
    const ps = new Particles();
    ps.burst(0, 0, DUST, () => 0.5);
    const before = { ...ps.list[0] };
    ps.update(-0.1, 1000);
    expect(ps.list[0]).toEqual(before);

    const s = new Squash();
    s.set(1.3, 0.7);
    s.update(-1);
    expect(s.sx).toBe(1.3);

    const a = new Afterimages(0.1);
    a.add(0, 0);
    a.update(-1);
    expect(a.items[0].life).toBe(0.1);
  });
});
