import { describe, expect, it } from 'vitest';
import { Camera, CAMERA_STIFFNESS, fallLead, FALL_LEAD_EXTRA } from '../../src/core/camera';

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

  it('does not shift the framing for jumps or upward movement', () => {
    const cam = make();
    const still = cam.desired(1000, 1000, 0).y;
    expect(cam.desired(1000, 1000, 900).y).toBe(still);
    expect(cam.desired(1000, 1000, -900).y).toBe(still);
    expect(cam.desired(1000, 1000, -5000).y).toBe(still);
  });

  it('leads ahead of a max-speed fall by the follow lag plus the look-ahead', () => {
    expect(fallLead(0)).toBe(0);
    expect(fallLead(900)).toBe(0);
    expect(fallLead(1200)).toBeCloseTo(1200 / CAMERA_STIFFNESS + FALL_LEAD_EXTRA, 6);
    expect(fallLead(1050)).toBeCloseTo(0.5 * (1050 / CAMERA_STIFFNESS + FALL_LEAD_EXTRA), 6);
  });

  it('shows more below the player than the resting framing during a long fall', () => {
    const cam = new Camera(960, 540, 960, 45000);
    let y = 5000;
    cam.snapTo(480, y);
    for (let i = 0; i < 600; i++) {
      const dt = 1 / 60;
      y += 1200 * dt;
      cam.follow(480, y, 1200, dt);
    }
    const screenY = y - cam.y;
    expect(screenY).toBeGreaterThan(150);
    expect(screenY).toBeLessThan(540 * 0.55);
  });

  it('eases the same at 60 Hz and 144 Hz', () => {
    const a = make();
    const b = make();
    a.snapTo(1000, 1000);
    b.snapTo(1000, 1000);
    for (let i = 0; i < 60; i++) a.follow(1000, 400, 0, 1 / 60);
    for (let i = 0; i < 144; i++) b.follow(1000, 400, 0, 1 / 144);
    expect(a.y).toBeCloseTo(b.y, 6);
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

  it('suppresses active and future shake when the preference is disabled', () => {
    const cam = make();
    cam.shake(10, 1);
    cam.setShakeEnabled(false);
    cam.updateShake(0, () => 1);
    expect([cam.offsetX, cam.offsetY]).toEqual([0, 0]);
    cam.shake(10, 1);
    cam.updateShake(0, () => 1);
    expect([cam.offsetX, cam.offsetY]).toEqual([0, 0]);
  });

  it('ignores zero-duration and negative shakes without producing NaN', () => {
    const cam = make();
    cam.shake(10, 0);
    cam.shake(-5, 0.2);
    cam.updateShake(0.01, () => 1);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('does not snap back when a long fall ends', () => {
    const cam = new Camera(960, 540, 960, 45000);
    const dt = 1 / 60;
    let y = 5000;
    cam.snapTo(480, y);
    for (let i = 0; i < 600; i++) {
      y += 1200 * dt;
      cam.follow(480, y, 1200, dt);
    }
    const a = cam.y;
    y += 1200 * dt;
    cam.follow(480, y, 1200, dt);
    const speedBefore = (cam.y - a) / dt;
    const b = cam.y;
    cam.follow(480, y, 0, dt); // landed: target stops, vy drops to 0
    const speedAfter = (cam.y - b) / dt;
    // Easing keeps the camera moving the same way through a landing (unsmoothed it reversed to about -670 u/s).
    expect(speedAfter).toBeGreaterThan(0);
    expect(Math.abs(speedAfter - speedBefore)).toBeLessThan(450);
  });

  it('does not lurch when a fall speeds up past jump speed', () => {
    const cam = new Camera(960, 540, 960, 45000);
    const dt = 1 / 60;
    let y = 5000;
    let vy = 900;
    cam.snapTo(480, y);
    for (let i = 0; i < 120; i++) {
      y += vy * dt;
      cam.follow(480, y, vy, dt);
    }
    let maxSpeed = 0;
    for (let i = 0; i < 120; i++) {
      vy = Math.min(vy + 2600 * dt, 1200);
      y += vy * dt;
      const before = cam.y;
      cam.follow(480, y, vy, dt);
      maxSpeed = Math.max(maxSpeed, (cam.y - before) / dt);
    }
    expect(maxSpeed).toBeLessThan(1.5 * 1200);
  });
});
