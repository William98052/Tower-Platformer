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
      platform(630, 80, 210),
    ], [
      { type: 'prompt', x: 45, y: 500, w: 260, h: 150, prompt: 'jump' },
      { type: 'mushroom', x: 565, y: 261, w: 90, h: 24, launch: 980 },
    ]),

    // 2. The route visibly enters one framed wall-jump shaft and exits to the right.
    section(1, 300, [
      platform(240, 660, 600),
      platform(584, 310, 250),
      platform(650, 190, 220),
      platform(600, 70, 250),
      vine(430, 310, 250),
      vine(560, 310, 250),
    ], [
      { type: 'prompt', x: 420, y: 300, w: 180, h: 370, prompt: 'wallJump' },
    ]),

    // 3. Overlapping one-way canopies make a single readable left-right switchback.
    section(2, 620, [
      platform(580, 660, 356),
      platform(500, 535, 260, 'oneWay'),
      platform(300, 410, 260, 'oneWay'),
      platform(120, 280, 250, 'oneWay'),
      platform(350, 170, 260, 'oneWay'),
      platform(650, 70, 240),
    ], []),

    // 4. Stepped stone terraces replace the old triangular ramps; mushrooms bridge the tall beats.
    section(3, 650, [
      platform(620, 660, 316),
      platform(560, 535, 220),
      platform(390, 410, 220),
      platform(240, 280, 200),
      platform(380, 170, 220),
      platform(560, 70, 260),
    ], [
      { type: 'mushroom', x: 620, y: 511, w: 90, h: 24, launch: 940 },
      { type: 'mushroom', x: 290, y: 256, w: 90, h: 24, launch: 980 },
    ]),

    // 5. Alternating towers create obvious dash targets; one dim ledge catches a missed first dash.
    section(4, 580, [
      platform(540, 660, 300),
      platform(620, 535, 240),
      platform(180, 410, 220),
      platform(520, 280, 220),
      platform(200, 170, 220),
      platform(120, 70, 240),
      platform(410, 480, 100, 'oneWay', 'recovery'),
    ], [
      { type: 'prompt', x: 310, y: 370, w: 470, h: 230, prompt: 'dash' },
    ]),

    // 6. One S-shaped route feeds directly into a compact vine shaft and back out.
    section(5, 160, [
      platform(80, 660, 780),
      platform(454, 310, 300),
      platform(600, 190, 260, 'oneWay'),
      platform(520, 70, 260),
      vine(300, 310, 250),
      vine(430, 310, 250),
    ], []),

    // 7. A centered finale chains mushroom, shaft and dash without side branches.
    section(6, 350, [
      platform(300, 660, 560),
      platform(654, 310, 206),
      platform(650, 185, 200),
      platform(500, 60, 280),
      vine(500, 310, 250),
      vine(630, 310, 250),
    ], [
      { type: 'mushroom', x: 700, y: 286, w: 70, h: 24, launch: 1020 },
    ]),
  ],
};
