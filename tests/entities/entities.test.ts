import { describe, expect, it } from 'vitest';
import { createEntities } from '../../src/entities/factory';
import { MushroomEntity } from '../../src/entities/mushroom';
import { createPlayer } from '../../src/physics/player';

describe('MushroomEntity', () => {
  it('launches a descending player that overlaps its cap', () => {
    const mushroom = new MushroomEntity({ type: 'mushroom', x: 100, y: 100, w: 80, h: 24, launch: 1050 });
    const player = createPlayer(120, 78);
    player.vy = 300;
    expect(mushroom.collide(player)).toEqual({ kind: 'launch', velocityY: -1050 });
    expect(mushroom.compression).toBeGreaterThan(0);
  });

  it('does not launch rising players or players below its cap', () => {
    const mushroom = new MushroomEntity({ type: 'mushroom', x: 100, y: 100, w: 80, h: 24, launch: 1050 });
    const rising = createPlayer(120, 78);
    rising.vy = -100;
    expect(mushroom.collide(rising)).toEqual({ kind: 'none' });
    const below = createPlayer(120, 110);
    below.vy = 100;
    expect(mushroom.collide(below)).toEqual({ kind: 'none' });
  });

  it('reset restores its initial state', () => {
    const mushroom = new MushroomEntity({ type: 'mushroom', x: 100, y: 100, w: 80, h: 24, launch: 1050 });
    const player = createPlayer(120, 78);
    player.vy = 300;
    mushroom.collide(player);
    mushroom.reset();
    expect(mushroom.compression).toBe(0);
  });
});

describe('entity factory', () => {
  it('creates prompt triggers that report their id without becoming solid', () => {
    const [prompt] = createEntities([{ type: 'prompt', x: 10, y: 20, w: 100, h: 80, prompt: 'wallJump' }]);
    const player = createPlayer(20, 30);
    expect(prompt.collide(player)).toEqual({ kind: 'prompt', id: 'wallJump' });
    player.x = 500;
    expect(prompt.collide(player)).toEqual({ kind: 'none' });
  });
});
