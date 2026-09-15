import type { EntityDef, SectionDef, SolidDef, StageDef } from './types';

const HEIGHT = 700;
const T = 16;

const shell = (): SolidDef[] => [
  { x: 0, y: 0, w: 24, h: HEIGHT, surface: 'normal' },
  { x: 936, y: 0, w: 24, h: HEIGHT, surface: 'normal' },
];

const platform = (x: number, y: number, w: number, surface: SolidDef['surface'] = 'normal'): SolidDef =>
  ({ x, y, w, h: T, surface });

const section = (
  id: number,
  checkpointX: number,
  solids: SolidDef[],
  entities: EntityDef[],
): SectionDef => ({
  id,
  height: HEIGHT,
  checkpoint: { x: checkpointX, y: 620 },
  solids: [...shell(), ...solids],
  entities,
});

export const STAGE_01_MOSS: StageDef = {
  id: 1,
  name: 'Moss Ruins',
  theme: {
    skyTop: '#0d1714',
    skyBottom: '#263a2c',
    platform: '#2a3b30',
    edge: '#c4dea0',
    accent: '#83ad62',
  },
  sections: [
    // 1. Broken stair ascent: jump basics and a safe mushroom demonstration.
    section(0, 60, [
      platform(24, 660, 912),
      platform(90, 540, 220),
      platform(390, 420, 190),
      platform(650, 300, 190),
      platform(390, 180, 190),
      platform(110, 60, 220),
    ], [
      { type: 'prompt', x: 45, y: 500, w: 220, h: 150, prompt: 'jump' },
      { type: 'mushroom', x: 690, y: 276, w: 90, h: 24, launch: 920 },
    ]),

    // 2. A generous two-sided vine shaft teaches alternating wall jumps.
    section(1, 70, [
      platform(24, 660, 270),
      platform(170, 520, 190),
      platform(560, 380, 180),
      platform(690, 240, 220),
      platform(400, 100, 220),
      { x: 390, y: 210, w: 24, h: 340, surface: 'vine' },
      { x: 524, y: 150, w: 24, h: 400, surface: 'vine' },
    ], [
      { type: 'prompt', x: 330, y: 300, w: 280, h: 300, prompt: 'wallJump' },
    ]),

    // 3. One-way canopy platforms form a readable switchback.
    section(2, 760, [
      platform(700, 660, 236),
      platform(520, 530, 250, 'oneWay'),
      platform(180, 400, 240, 'oneWay'),
      platform(500, 270, 250, 'oneWay'),
      platform(150, 140, 240, 'oneWay'),
      platform(430, 20, 230),
    ], []),

    // 4. Broad slopes and mushrooms create a flowing zigzag.
    section(3, 80, [
      platform(24, 660, 250),
      { x: 240, y: 500, w: 180, h: 120, surface: 'slopeUp' },
      platform(420, 500, 160),
      { x: 580, y: 360, w: 180, h: 120, surface: 'slopeDown' },
      platform(500, 340, 160),
      platform(250, 220, 180),
      { x: 90, y: 60, w: 160, h: 120, surface: 'slopeUp' },
      platform(250, 60, 180),
    ], [
      { type: 'mushroom', x: 470, y: 476, w: 90, h: 24, launch: 980 },
      { type: 'mushroom', x: 285, y: 196, w: 90, h: 24, launch: 1000 },
    ]),

    // 5. First required dash; low catch ledges make misses recoverable.
    section(4, 70, [
      platform(24, 660, 260),
      platform(80, 540, 230),
      platform(550, 420, 260),
      platform(350, 500, 120, 'oneWay'),
      platform(690, 300, 210),
      platform(380, 180, 190),
      platform(100, 60, 210),
    ], [
      { type: 'prompt', x: 180, y: 390, w: 450, h: 220, prompt: 'dash' },
    ]),

    // 6. Combined vine, canopy and diagonal-dash route.
    section(5, 760, [
      platform(690, 660, 246),
      platform(610, 540, 210, 'oneWay'),
      { x: 470, y: 320, w: 24, h: 300, surface: 'vine' },
      { x: 600, y: 280, w: 24, h: 280, surface: 'vine' },
      platform(300, 400, 170, 'oneWay'),
      platform(90, 270, 180),
      platform(400, 140, 170, 'oneWay'),
      platform(690, 20, 190),
    ], []),

    // 7. Finale: mushroom launch, wall jump, ramp and final dash.
    section(6, 70, [
      platform(24, 660, 260),
      platform(260, 540, 150),
      { x: 430, y: 300, w: 24, h: 300, surface: 'vine' },
      { x: 560, y: 260, w: 24, h: 300, surface: 'vine' },
      platform(584, 400, 170, 'oneWay'),
      { x: 650, y: 230, w: 170, h: 120, surface: 'slopeUp' },
      platform(520, 220, 130),
      platform(150, 90, 190),
      platform(500, 20, 260),
    ], [
      { type: 'mushroom', x: 300, y: 516, w: 90, h: 24, launch: 1080 },
    ]),
  ],
};
