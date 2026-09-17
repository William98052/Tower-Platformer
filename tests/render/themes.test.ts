import { describe, expect, it } from 'vitest';
import { themeBlendAt } from '../../src/render/themes';
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
