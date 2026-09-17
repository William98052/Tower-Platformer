import { describe, expect, it } from 'vitest';
import { STEP } from '../../src/core/constants';
import { createEntities } from '../../src/entities/factory';
import { GearEntity } from '../../src/entities/gear';
import { PistonEntity } from '../../src/entities/piston';
import { timedDoorAudioEvents, timedDoorStateAt, TimedDoorEntity } from '../../src/entities/timed-door';
import { createPlayer } from '../../src/physics/player';

const gearDef = { type: 'gear' as const, x: 300, y: 200, radius: 60, period: 4 as const, phase: 0, paddleW: 80 };
const pistonDef = { type: 'piston' as const, x: 100, y: 200, w: 80, h: 24, axis: 'x' as const, travel: 90, phase: 0 };
const doorDef = { type: 'timedDoor' as const, x: 500, y: 120, w: 24, h: 120, phase: 0 };

function gearAt(t: number) {
  const gear = new GearEntity(gearDef);
  gear.update(t, STEP);
  return gear;
}

function pistonAt(t: number) {
  const piston = new PistonEntity(pistonDef);
  piston.update(t, STEP);
  return piston;
}

function doorAt(t: number) {
  const door = new TimedDoorEntity(doorDef);
  door.update(t, STEP);
  return door;
}

describe('GearEntity', () => {
  it('derives its orbit from elapsed time and configured period', () => {
    expect(gearAt(0).dynamicSolids()[0].box).toMatchObject({ x: 300, y: 200 });
    expect(gearAt(1).dynamicSolids()[0].box.x).toBeCloseTo(300 + gearDef.radius, 9);

    const slow = new GearEntity({ ...gearDef, period: 6 });
    slow.update(1.5, STEP);
    expect(slow.dynamicSolids()[0].box.x).toBeCloseTo(300 + gearDef.radius, 9);
  });

  it('reports frame displacement and resets to deterministic time zero', () => {
    const gear = new GearEntity(gearDef);
    gear.update(1 - STEP, STEP);
    const previous = { ...gear.dynamicSolids()[0].box };
    gear.update(1, STEP);
    const moved = gear.dynamicSolids()[0];
    expect(moved.delta.x).toBeCloseTo(moved.box.x - previous.x, 9);
    expect(moved.delta.y).toBeCloseTo(moved.box.y - previous.y, 9);

    gear.reset();
    expect(gear.dynamicSolids()[0]).toMatchObject({
      box: { x: 300, y: 200 },
      delta: { x: 0, y: 0 },
    });
  });

  it('reports only one-step motion on its first update at a large absolute time', () => {
    const uninterrupted = new GearEntity(gearDef);
    uninterrupted.update(101 - STEP, STEP);
    uninterrupted.update(101, STEP);
    const activated = new GearEntity(gearDef);
    activated.update(101, STEP);

    expect(activated.dynamicSolids()[0].delta).toEqual(uninterrupted.dynamicSolids()[0].delta);
  });
});

describe('PistonEntity', () => {
  it('uses the exact warning, extension, hold, and retraction timing', () => {
    expect(pistonAt(1.19).phase).toBe('resting');
    expect(pistonAt(1.45).phase).toBe('warning');
    expect(pistonAt(1.79).phase).toBe('extended');
    expect(pistonAt(2.0).dynamicSolids()[0].box.x).toBe(pistonDef.x + pistonDef.travel);
    expect(pistonAt(2.3).phase).toBe('retracting');
  });

  it('moves along its configured axis and reports push contact rather than a hazard', () => {
    const piston = pistonAt(1.79);
    expect(piston.dynamicSolids()[0].box.x).toBeCloseTo(pistonDef.x + pistonDef.travel / 2, 9);
    expect(piston.dynamicSolids()[0].box.y).toBe(pistonDef.y);
    const player = createPlayer(piston.bounds().x + 4, piston.bounds().y);

    expect(piston.collide(player)).toMatchObject({ kind: 'push' });
  });

  it('resets to deterministic time-zero geometry', () => {
    const piston = pistonAt(2);
    piston.reset();
    expect(piston.phase).toBe('resting');
    expect(piston.dynamicSolids()[0]).toEqual({
      box: { x: pistonDef.x, y: pistonDef.y, w: pistonDef.w, h: pistonDef.h, surface: 'normal' },
      delta: { x: 0, y: 0 },
    });
  });

  it('reports only one-step motion on its first update at a large absolute time', () => {
    const t = 244.79;
    const uninterrupted = new PistonEntity(pistonDef);
    uninterrupted.update(t - STEP, STEP);
    uninterrupted.update(t, STEP);
    const activated = new PistonEntity(pistonDef);
    activated.update(t, STEP);

    expect(activated.dynamicSolids()[0].delta).toEqual(uninterrupted.dynamicSolids()[0].delta);
  });
});

describe('TimedDoorEntity', () => {
  it('follows the exact open, closing, closed, and opening schedule', () => {
    expect(doorAt(0).dynamicSolids()).toEqual([]);
    expect(doorAt(1.39).dynamicSolids()).toEqual([]);
    expect(doorAt(1.5).phase).toBe('closing');
    expect(doorAt(1.8).dynamicSolids()).toHaveLength(1);
    expect(doorAt(1.8).phase).toBe('closed');
    expect(doorAt(2.9).phase).toBe('opening');
  });

  it('stores transition displacement and resets to its open time-zero geometry', () => {
    const door = new TimedDoorEntity(doorDef);
    door.update(1.5 - STEP, STEP);
    const previousY = door.dynamicSolids()[0].box.y;
    door.update(1.5, STEP);
    expect(door.dynamicSolids()[0].delta.y).toBeCloseTo(door.dynamicSolids()[0].box.y - previousY, 9);

    door.reset();
    expect(door.phase).toBe('open');
    expect(door.dynamicSolids()).toEqual([]);
  });

  it('reports only one-step motion on its first update at a large absolute time', () => {
    const t = 301.5;
    const uninterrupted = new TimedDoorEntity(doorDef);
    uninterrupted.update(t - STEP, STEP);
    uninterrupted.update(t, STEP);
    const activated = new TimedDoorEntity(doorDef);
    activated.update(t, STEP);

    expect(activated.dynamicSolids()[0].delta).toEqual(uninterrupted.dynamicSolids()[0].delta);
  });

  it('warns before closing motion and advances a continuous full-cycle telegraph', () => {
    const beforeWarning = timedDoorStateAt(1.19, 0);
    const warning = timedDoorStateAt(1.21, 0);
    const closing = timedDoorStateAt(1.41, 0);

    expect(beforeWarning.warning).toBe(false);
    expect(warning).toMatchObject({ phase: 'open', warning: true, closedAmount: 0 });
    expect(closing).toMatchObject({ phase: 'closing', warning: false });
    expect(warning.cycleProgress).toBeCloseTo(1.21 / 3, 9);
    expect(closing.cycleProgress).toBeCloseTo(1.41 / 3, 9);
  });

  it('emits the warning cue before the later door-motion cue', () => {
    expect(timedDoorAudioEvents(timedDoorStateAt(1.19, 0), timedDoorStateAt(1.21, 0)))
      .toEqual(['machineWarning']);
    expect(timedDoorAudioEvents(timedDoorStateAt(1.39, 0), timedDoorStateAt(1.41, 0)))
      .toEqual(['door']);
  });
});

describe('clockwork entity factory', () => {
  it('constructs each discriminated machinery definition', () => {
    const entities = createEntities([gearDef, pistonDef, doorDef]);
    expect(entities[0]).toBeInstanceOf(GearEntity);
    expect(entities[1]).toBeInstanceOf(PistonEntity);
    expect(entities[2]).toBeInstanceOf(TimedDoorEntity);
  });
});
