import { describe, expect, it } from 'vitest';
import { Camera, MAX_LOOK_AHEAD } from '../../src/core/camera';

const make = () => new Camera(960, 540, 2000, 2000);

describe('Camera', () => {
  it('snaps with the target centered horizontally and at 55% of the view height', () => {
    const cam = make();
    cam.snapTo(1000, 1000);
    expect(cam.x).toBe(520);
    expect(cam.y).toBeCloseTo(703, 6);
  });

  it('clamps to the world edges', () => {
    const cam = make();
    cam.snapTo(0, 0);
    expect([cam.x, cam.y]).toEqual([0, 0]);
    cam.snapTo(2000, 2000);
    expect([cam.x, cam.y]).toEqual([1040, 1460]);
  });

  it('never scrolls horizontally when the world is exactly one view wide', () => {
    const cam = new Camera(960, 540, 960, 2000);
    cam.snapTo(900, 1000);
    expect(cam.x).toBe(0);
  });

  it('eases toward the target instead of jumping', () => {
    const cam = make();
    cam.snapTo(1000, 1000);
    const startY = cam.y;
    cam.follow(1000, 600, 0, 1 / 120);
    expect(cam.y).toBeLessThan(startY);
    expect(cam.y).toBeGreaterThan(303);
    for (let i = 0; i < 240; i++) cam.follow(1000, 600, 0, 1 / 120);
    expect(cam.y).toBeCloseTo(303, 0);
  });

  it('looks ahead in the direction of vertical movement, up to a limit', () => {
    const cam = make();
    const still = cam.desired(1000, 1000, 0).y;
    expect(cam.desired(1000, 1000, 5000).y - still).toBeCloseTo(MAX_LOOK_AHEAD, 6);
    expect(cam.desired(1000, 1000, -5000).y - still).toBeCloseTo(-MAX_LOOK_AHEAD, 6);
  });

  it('shake offsets fade out over the duration', () => {
    const cam = make();
    cam.shake(10, 0.2);
    cam.updateShake(0.05, () => 1);
    expect(cam.offsetX).toBeCloseTo(7.5, 6);
    cam.updateShake(0.2, () => 1);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('a weaker shake does not override a stronger one in progress', () => {
    const cam = make();
    cam.shake(10, 0.2);
    cam.shake(2, 0.2);
    cam.updateShake(0, () => 1);
    expect(cam.offsetX).toBeCloseTo(10, 6);
  });
});
