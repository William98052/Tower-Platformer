import { describe, expect, it } from 'vitest';
import { conveyorChevronOffset, warningLampIntensity } from '../../src/render/clockwork-draw';
import { composeThemeLayers, themeBlendAt } from '../../src/render/themes';
import { TOWER } from '../../src/stages/tower';
import { buildWorld } from '../../src/stages/world';

describe('themeBlendAt', () => {
  const world = buildWorld(TOWER);
  const clockworkBottom = world.sections.find((section) => section.stageId === 2)!.bottom;

  it('keeps Moss pure below its 600-unit transition band', () => {
    const blend = themeBlendAt(world, clockworkBottom + 600);
    expect({ lower: blend.lower.id, upper: blend.upper.id, mix: blend.mix }).toEqual({
      lower: 1,
      upper: 2,
      mix: 0,
    });
  });

  it('mixes Moss and Clockwork equally halfway through the transition', () => {
    const blend = themeBlendAt(world, clockworkBottom + 300);
    expect({ lower: blend.lower.id, upper: blend.upper.id, mix: blend.mix }).toEqual({
      lower: 1,
      upper: 2,
      mix: 0.5,
    });
  });

  it('uses pure Clockwork above the stage boundary', () => {
    const blend = themeBlendAt(world, clockworkBottom - 1);
    expect({ lower: blend.lower.id, upper: blend.upper.id, mix: blend.mix }).toEqual({
      lower: 2,
      upper: 2,
      mix: 0,
    });
  });
});

describe('theme compositing', () => {
  it('renders an opaque lower layer before applying the upper mix, clearing prior-frame residue', () => {
    let pixel = 0.9;
    let alpha = 1;
    const ctx = {
      get globalAlpha() { return alpha; },
      set globalAlpha(value: number) { alpha = value; },
      save() {},
      restore() { alpha = 1; },
    } as unknown as CanvasRenderingContext2D;
    const composite = (value: number) => {
      pixel = value * ctx.globalAlpha + pixel * (1 - ctx.globalAlpha);
    };

    composeThemeLayers(ctx, 0.5, () => composite(0), () => composite(1));

    expect(pixel).toBe(0.5);
  });

  it('uses exact lower and upper endpoints without retaining the prior frame', () => {
    const render = (mix: number) => {
      let pixel = 0.75;
      let alpha = 1;
      const ctx = {
        get globalAlpha() { return alpha; },
        set globalAlpha(value: number) { alpha = value; },
        save() {},
        restore() { alpha = 1; },
      } as unknown as CanvasRenderingContext2D;
      const composite = (value: number) => {
        pixel = value * ctx.globalAlpha + pixel * (1 - ctx.globalAlpha);
      };
      composeThemeLayers(ctx, mix, () => composite(0), () => composite(1));
      return pixel;
    };

    expect(render(0)).toBe(0);
    expect(render(1)).toBe(1);
  });
});

describe('Clockwork ambient animation', () => {
  it('moves conveyor chevrons continuously in their belt direction and wraps cleanly', () => {
    expect(conveyorChevronOffset(0, 1)).toBe(0);
    expect(conveyorChevronOffset(0.25, 1)).toBeCloseTo(10, 9);
    expect(conveyorChevronOffset(0.25, -1)).toBeCloseTo(-10, 9);
    expect(conveyorChevronOffset(0.95, 1)).toBe(0);
  });

  it('pulses warning lamps without ever hiding their red state', () => {
    expect(warningLampIntensity(0, 0)).toBeGreaterThanOrEqual(0.45);
    expect(warningLampIntensity(0.3, 1)).toBeGreaterThanOrEqual(0.45);
    expect(warningLampIntensity(0.3, 1)).toBeLessThanOrEqual(1);
  });
});
