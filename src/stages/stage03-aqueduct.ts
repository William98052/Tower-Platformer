import { platform, section } from './builders';
import type { EntityDef, StageDef } from './types';

function water(x: number, y: number, w: number, h: number, currentX = 0, currentY = 0): EntityDef {
  return { type: 'water', x, y, w, h, currentX, currentY };
}

function crate(x: number, y: number, w: number, sinkDistance: number): EntityDef {
  return { type: 'sinkingCrate', x, y, w, h: 20, sinkDistance };
}

export const STAGE_03_AQUEDUCT: StageDef = {
  id: 3,
  name: 'Sunken Aqueduct',
  theme: {
    skyTop: '#082f35',
    skyBottom: '#0d4a4d',
    platform: '#244f4d',
    edge: '#62d8d1',
    accent: '#a46f45',
  },
  sections: [
    // 1. Walk off the runway into a still pool that rests on the same floor, swim up, and step onto
    //    the 240-wide bank; a three-step zigzag reaches the exit.
    section(0, 520, [
      platform(24, 660, 656),
      platform(400, 460, 240),
      platform(680, 330, 240),
      platform(380, 200, 260),
      platform(24, 70, 300),
    ], [
      water(24, 460, 376, 200),
    ]),

    // 2. A shallow sealed canal carries the player right, a staircase climbs back left, and a second
    //    sealed canal at the top pushes against the final crossing.
    section(1, 220, [
      platform(120, 660, 300),
      platform(420, 684, 340),
      platform(760, 660, 176),
      platform(620, 545, 220),
      platform(380, 430, 220),
      platform(140, 315, 220),
      platform(24, 200, 100),
      platform(100, 70, 200),
      platform(300, 110, 340),
      platform(640, 70, 280),
    ], [
      water(420, 660, 340, 24, 260),
      water(300, 70, 340, 40, -260),
    ]),

    // 3. Three rising crates step left over a flush recovery floor; a fixed zigzag leaves from the top.
    section(2, 600, [
      platform(460, 660, 300),
      platform(24, 660, 436, 'normal', 'recovery'),
      platform(200, 260, 240),
      platform(480, 165, 220),
      platform(720, 70, 216),
    ], [
      crate(340, 560, 100, 50),
      crate(200, 460, 100, 50),
      crate(60, 360, 100, 50),
    ]),

    // 4. The wheel lifts riders from the floor to a high bank no jump or dash can reach.
    section(3, 700, [
      platform(24, 660, 816),
      platform(80, 345, 310),
      platform(440, 210, 240),
      platform(700, 70, 236),
    ], [
      { type: 'waterWheel', x: 500, y: 450, radius: 120, phase: 0, paddleW: 140, paddleH: 20 },
    ]),

    // 5. An up-current column rises from the floor to a surface ledge; two crates cross above the
    //    column to the exit, and any miss drops back into the water.
    section(4, 680, [
      platform(24, 660, 816),
      platform(24, 370, 220),
      platform(570, 70, 280),
    ], [
      water(24, 370, 496, 290, 0, -420),
      crate(290, 270, 100, 45),
      crate(430, 170, 100, 45),
    ]),

    // 6. Swim up the first pool, dash across to a broad dry landing, then swim the second pool.
    section(5, 450, [
      platform(24, 660, 666),
      platform(190, 480, 180),
      platform(610, 380, 326),
      platform(610, 200, 180),
      platform(680, 70, 256),
    ], [
      water(24, 480, 166, 180, 160),
      water(790, 200, 146, 180, -160),
    ]),

    // 7. Wade against a strong current to a floating crate, climb two crates to the wheel bank, and ride
    //    the wheel up into the final water jet beside the exit.
    section(6, 640, [
      platform(24, 660, 776),
      platform(360, 490, 200),
      platform(560, 70, 300),
    ], [
      water(24, 600, 476, 60, 420),
      crate(40, 586, 110, 30),
      crate(200, 540, 110, 30),
      { type: 'waterWheel', x: 400, y: 280, radius: 120, phase: 0, paddleW: 140, paddleH: 20 },
      water(200, 70, 360, 80, 0, -420),
    ]),
  ],
};
