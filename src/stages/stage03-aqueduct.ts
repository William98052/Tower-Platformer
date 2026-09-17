import { platform, section } from './builders';
import type { StageDef } from './types';

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
    // 1. A broad dry start feeds one shallow pool and a large, obvious right-bank exit.
    section(0, 760, [
      platform(600, 660, 320),
      platform(600, 410, 240),
      platform(360, 280, 300),
      platform(160, 170, 300),
      platform(80, 70, 320),
    ], [
      { type: 'water', x: 80, y: 410, w: 520, h: 234, currentX: 0, currentY: 0 },
    ]),

    // 2. The first channel carries right; the upper channel visibly resists the same direction.
    section(1, 140, [
      platform(80, 660, 340),
      platform(700, 500, 220),
      platform(500, 380, 260),
      platform(80, 330, 220),
      platform(700, 200, 220),
      platform(440, 70, 320),
    ], [
      { type: 'water', x: 300, y: 500, w: 400, h: 144, currentX: 260, currentY: 0 },
      { type: 'water', x: 300, y: 200, w: 400, h: 144, currentX: -260, currentY: 0 },
    ]),

    // 3. Three close-set crates cross one basin; the floor below catches every miss.
    section(2, 600, [
      platform(560, 660, 360),
      platform(80, 660, 480, 'normal', 'recovery'),
      platform(24, 430, 116),
      platform(140, 300, 380),
      platform(440, 180, 260),
      platform(660, 70, 260),
    ], [
      { type: 'sinkingCrate', x: 430, y: 535, w: 100, h: 20, sinkDistance: 50 },
      { type: 'sinkingCrate', x: 300, y: 505, w: 100, h: 20, sinkDistance: 50 },
      { type: 'sinkingCrate', x: 170, y: 475, w: 100, h: 20, sinkDistance: 50 },
    ]),

    // 4. The complete wheel path is clear between two broad stone banks.
    section(3, 600, [
      platform(480, 660, 360),
      platform(80, 380, 310),
      platform(260, 250, 260),
      platform(260, 140, 260),
      platform(260, 70, 320),
    ], [
      { type: 'waterWheel', x: 500, y: 485, radius: 120, phase: 0, paddleW: 140, paddleH: 20 },
    ]),

    // 5. One readable up-current surrounds two resting ledges without forming a wall shaft.
    section(4, 270, [
      platform(260, 660, 340),
      platform(660, 465, 260),
      platform(60, 285, 260),
      platform(660, 70, 260),
    ], [
      { type: 'water', x: 300, y: 70, w: 360, h: 574, currentX: 0, currentY: -420 },
      { type: 'sinkingCrate', x: 390, y: 500, w: 120, h: 20, sinkDistance: 45 },
      { type: 'sinkingCrate', x: 470, y: 310, w: 120, h: 20, sinkDistance: 45 },
    ]),

    // 6. Two separate swim channels alternate with wide dry dash landings.
    section(5, 740, [
      platform(600, 660, 320),
      platform(80, 410, 200),
      platform(300, 300, 200),
      platform(720, 180, 200),
      platform(380, 70, 320),
    ], [
      { type: 'water', x: 280, y: 410, w: 320, h: 234, currentX: -160, currentY: 0 },
      { type: 'water', x: 500, y: 180, w: 220, h: 194, currentX: 160, currentY: 0 },
    ]),

    // 7. Current, crates, wheel, and exit jet form one readable finale sequence.
    section(6, 650, [
      platform(390, 660, 340),
      platform(620, 510, 300),
      platform(420, 330, 220),
      platform(320, 210, 300),
      platform(320, 70, 340),
    ], [
      { type: 'water', x: 300, y: 510, w: 320, h: 134, currentX: 420, currentY: 0 },
      { type: 'sinkingCrate', x: 370, y: 565, w: 110, h: 20, sinkDistance: 40 },
      { type: 'sinkingCrate', x: 500, y: 535, w: 110, h: 20, sinkDistance: 40 },
      { type: 'waterWheel', x: 550, y: 430, radius: 95, phase: 0, paddleW: 120, paddleH: 20 },
      { type: 'water', x: 80, y: 70, w: 240, h: 155, currentX: 0, currentY: -420 },
    ]),
  ],
};
