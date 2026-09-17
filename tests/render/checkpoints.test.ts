import { expect, it, vi } from 'vitest';
import { buildWorld } from '../../src/stages/world';
import { drawCheckpoints } from '../../src/render/entity-draw';
import { threeStageTower } from '../helpers/tower';

it('lights checkpoints by global progression when local section ids repeat', () => {
  const colors: string[] = [];
  const ctx = {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), closePath: vi.fn(), fillStyle: '',
    fill(this: { fillStyle: string }) { colors.push(this.fillStyle); },
  } as unknown as CanvasRenderingContext2D;
  const world = buildWorld(threeStageTower);
  drawCheckpoints(ctx, [world.sections[6], world.sections[10], world.sections[14]],
    { x: 100, y: 6500, globalSection: 10, stageId: 2, localSection: 3 }, 'normal', 0, 0);
  expect(colors).toEqual(['#a9d477', '#a9d477', '#4b5748']);
});
