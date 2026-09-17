import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import type { TowerDef } from '../../src/stages/types';

/** Three stages with repeated local ids and clear space for save/restore tests. */
export const threeStageTower: TowerDef = {
  stages: ['Moss Ruins', 'Clockwork Hall', 'Aqueduct'].map((name, index) => ({
    id: index + 1,
    name,
    theme: STAGE_01_MOSS.theme,
    sections: Array.from({ length: 7 }, (_, id) => ({
      id,
      height: 600,
      checkpoint: { x: 100, y: 500 },
      solids: [],
      entities: [{ type: 'mushroom' as const, x: 400, y: 550, w: 48, h: 20, launch: 900 }],
    })),
  })),
};
