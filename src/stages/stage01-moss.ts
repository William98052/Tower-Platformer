import type { EntityDef, SectionDef, SolidDef, SolidRole, StageDef } from './types';

const HEIGHT = 700;
const T = 16;

const shell = (): SolidDef[] => [
  { x: 0, y: 0, w: 24, h: HEIGHT, surface: 'normal', role: 'boundary' },
  { x: 936, y: 0, w: 24, h: HEIGHT, surface: 'normal', role: 'boundary' },
];

const platform = (
  x: number,
  y: number,
  w: number,
  surface: SolidDef['surface'] = 'normal',
  role: SolidRole = 'main',
): SolidDef => ({ x, y, w, h: T, surface, role });

const vine = (x: number, y: number, h: number): SolidDef =>
  ({ x, y, w: 24, h, surface: 'vine', role: 'main' });

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
    // 1. A single broken staircase introduces jumping, then the mushroom points to the exit.
    section(0, 60, [
      platform(24, 660, 300),
      platform(120, 535, 220),
      platform(300, 410, 220),
      platform(500, 285, 210),
      platform(630, 160, 210),
      platform(500, 70, 210),
      platform(260, 20, 260),
    ], [
      { type: 'prompt', x: 45, y: 500, w: 260, h: 150, prompt: 'jump' },
      { type: 'mushroom', x: 565, y: 261, w: 90, h: 24, launch: 920 },
    ]),

    // 2. The route visibly enters one framed wall-jump shaft and exits to the right.
    section(1, 280, [
      platform(240, 660, 300),
      platform(330, 540, 170),
      platform(540, 400, 180),
      platform(600, 270, 190),
      platform(690, 140, 190),
      platform(600, 20, 250),
      vine(430, 245, 315),
      vine(560, 205, 355),
    ], [
      { type: 'prompt', x: 390, y: 250, w: 230, h: 330, prompt: 'wallJump' },
    ]),

    // 3. Overlapping one-way canopies make a single readable left-right switchback.
    section(2, 620, [
      platform(580, 660, 356),
      platform(500, 535, 260, 'oneWay'),
      platform(300, 410, 260, 'oneWay'),
      platform(120, 285, 250, 'oneWay'),
      platform(350, 160, 260, 'oneWay'),
      platform(650, 35, 240),
    ], []),

    // 4. Stepped stone terraces replace the old triangular ramps; mushrooms bridge the tall beats.
    section(3, 650, [
      platform(620, 660, 316),
      platform(560, 535, 220),
      platform(390, 410, 220),
      platform(240, 285, 200),
      platform(380, 160, 220),
      platform(560, 35, 260),
    ], [
      { type: 'mushroom', x: 620, y: 511, w: 90, h: 24, launch: 940 },
      { type: 'mushroom', x: 290, y: 261, w: 90, h: 24, launch: 980 },
    ]),

    // 5. Alternating towers create obvious dash targets; one dim ledge catches a missed first dash.
    section(4, 580, [
      platform(540, 660, 300),
      platform(620, 535, 240),
      platform(180, 410, 220),
      platform(520, 285, 220),
      platform(200, 160, 220),
      platform(120, 35, 240),
      platform(410, 480, 100, 'oneWay', 'recovery'),
    ], [
      { type: 'prompt', x: 310, y: 370, w: 470, h: 230, prompt: 'dash' },
    ]),

    // 6. One S-shaped route feeds directly into a compact vine shaft and back out.
    section(5, 120, [
      platform(80, 660, 300),
      platform(240, 535, 220, 'oneWay'),
      platform(390, 410, 170),
      platform(560, 285, 200),
      platform(660, 160, 200, 'oneWay'),
      platform(520, 35, 260),
      vine(430, 235, 335),
      vine(560, 210, 360),
    ], []),

    // 7. A centered finale chains mushroom, shaft and dash without side branches.
    section(6, 550, [
      platform(500, 660, 300),
      platform(420, 535, 220),
      platform(300, 410, 180),
      platform(430, 285, 180),
      platform(650, 160, 200),
      platform(500, 35, 280),
      vine(300, 220, 250),
      vine(430, 195, 275),
    ], [
      { type: 'mushroom', x: 480, y: 511, w: 90, h: 24, launch: 1020 },
    ]),
  ],
};
