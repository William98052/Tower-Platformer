import { platform, section } from './builders';
import type { EntityDef, SolidDef, StageDef } from './types';

function water(x: number, y: number, w: number, h: number, currentX = 0, currentY = 0): EntityDef {
  return { type: 'water', x, y, w, h, currentX, currentY };
}

function crate(x: number, y: number, w: number, sinkDistance: number): EntityDef {
  return { type: 'sinkingCrate', x, y, w, h: 20, sinkDistance };
}

function gate(x: number, y: number, w: number, h: number): SolidDef {
  return { x, y, w, h, surface: 'normal', role: 'boundary' };
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
    // 1. Clockwork-facing floor, 360-deep still cistern, 240 bank, spawn not under the bank.
    section(0, 650, [
      platform(24, 660, 656),
      platform(400, 300, 240),
      platform(640, 160, 240),
      platform(360, 90, 200),
      platform(24, 70, 300),
    ], [
      water(24, 300, 376, 360),
    ]),

    // 2. +260 canal climbs 330 to a 160 bank. Stairs lead left to a drop-in; the -260 canal
    //    is a rightward opposing swim. A top slab clips dry up-dashes; dive under it to emerge.
    section(1, 220, [
      platform(120, 660, 300),
      platform(420, 660, 80),
      platform(500, 330, 160),
      platform(360, 250, 80),
      platform(440, 200, 80),
      platform(720, 70, 216),
      gate(484, 346, 16, 314),
      gate(520, 270, 280, 16),
      gate(24, 0, 626, 100),
    ], [
      water(420, 330, 80, 330, 260),
      water(520, 86, 280, 184, -260),
    ]),

    // 3. Three rising crates over a flush recovery floor. Runway sits under Section 2's right exit.
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

    // 4. Wheel bank meets the left wall — no wall-jump column.
    section(3, 700, [
      platform(24, 660, 816),
      platform(24, 345, 366),
      platform(440, 210, 240),
      platform(700, 70, 236),
    ], [
      { type: 'waterWheel', x: 500, y: 450, radius: 120, phase: 0, paddleW: 140, paddleH: 20 },
    ]),

    // 5. Up-current column and two crates.
    section(4, 680, [
      platform(24, 660, 816),
      platform(24, 370, 220),
      platform(570, 70, 280),
    ], [
      water(24, 370, 496, 290, 0, -420),
      crate(290, 270, 100, 45),
      crate(430, 170, 100, 45),
    ]),

    // 6. Right-side runway under Section 5. Swim left out of a 360-deep cistern, dash up,
    //    then swim the second channel to the right-hand exit.
    section(5, 680, [
      platform(24, 660, 476),
      platform(500, 660, 280),
      platform(40, 300, 188),
      platform(80, 90, 200),
      platform(640, 270, 80),
      platform(720, 70, 216),
      gate(212, 316, 16, 344),
    ], [
      water(228, 300, 272, 360, -160),
      water(280, 70, 440, 200, 160),
    ]),

    // 7. Right-side runway under Section 6. Bank sits over the +420 current, 432 away from the
    //    dry floor, so jump+dash cannot skip the crates. Boundary floor seals idle sinks.
    section(6, 780, [
      platform(621, 660, 280),
      platform(40, 490, 160),
      platform(560, 70, 300),
      gate(40, 660, 581, 16),
    ], [
      water(40, 490, 581, 170, 420),
      crate(320, 476, 110, 30),
      crate(210, 476, 110, 30),
      { type: 'waterWheel', x: 160, y: 280, radius: 120, phase: 0, paddleW: 140, paddleH: 20 },
      water(80, 70, 480, 80, 0, -420),
    ]),
  ],
};
