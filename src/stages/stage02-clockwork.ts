import { platform, section } from './builders';
import type { StageDef } from './types';

const conveyor = (
  x: number,
  y: number,
  w: number,
  direction: 'conveyorLeft' | 'conveyorRight',
  speed: 90 | 160,
) => platform(x, y, w, direction, 'main', speed);

export const STAGE_02_CLOCKWORK: StageDef = {
  id: 2,
  name: 'Clockwork Hall',
  theme: {
    skyTop: '#100f12',
    skyBottom: '#2a241e',
    platform: '#302e2b',
    edge: '#d2aa52',
    accent: '#ef6a3a',
  },
  sections: [
    // 1. Slow belts sit between broad landings; the offset floor catches a missed second belt.
    section(0, 540, [
      platform(500, 660, 380),
      conveyor(80, 535, 280, 'conveyorRight', 90),
      platform(430, 510, 470, 'normal', 'recovery'),
      conveyor(500, 410, 300, 'conveyorLeft', 90),
      platform(600, 285, 300),
      platform(400, 170, 300),
      platform(380, 70, 320),
    ], []),

    // 2. Alternating speeds and directions form one generous, readable switchback.
    section(1, 340, [
      platform(300, 660, 400),
      conveyor(500, 535, 340, 'conveyorRight', 90),
      platform(240, 410, 360),
      conveyor(100, 285, 340, 'conveyorLeft', 160),
      platform(340, 170, 340),
      conveyor(500, 70, 340, 'conveyorRight', 90),
    ], []),

    // 3. Each slow gear spans one otherwise-tall gap between the three fixed landings.
    section(2, 600, [
      platform(560, 660, 320),
      platform(240, 360, 280),
      platform(570, 70, 330),
    ], [
      { type: 'gear', x: 520, y: 420, radius: 90, period: 6, phase: 0, paddleW: 140 },
      { type: 'gear', x: 420, y: 120, radius: 90, period: 6, phase: 0, paddleW: 140 },
    ]),

    // 4. The first piston sweeps a floor toward a dedicated catch; the second descends from overhead.
    section(3, 540, [
      platform(500, 660, 280),
      platform(800, 625, 120, 'normal', 'recovery'),
      platform(450, 535, 320),
      platform(520, 410, 300),
      platform(360, 285, 320),
      platform(500, 170, 340),
      platform(500, 70, 360),
    ], [
      { type: 'piston', x: 570, y: 507, w: 70, h: 28, axis: 'x', travel: 130, phase: 0 },
      { type: 'piston', x: 560, y: 186, w: 70, h: 24, axis: 'y', travel: 70, phase: 0.5 },
    ]),

    // 5. Three gates share one low-ceiling corridor, so every phase must be read and crossed.
    section(4, 660, [
      platform(24, 660, 176),
      platform(224, 660, 176),
      platform(424, 660, 176),
      platform(624, 660, 296),
      platform(100, 560, 100),
      platform(224, 560, 176),
      platform(424, 560, 176),
      platform(624, 560, 312),
      platform(80, 430, 320),
      platform(240, 300, 320),
      platform(300, 170, 320),
      platform(300, 70, 360),
    ], [
      { type: 'timedDoor', x: 600, y: 600, w: 24, h: 60, phase: 0 },
      { type: 'timedDoor', x: 400, y: 600, w: 24, h: 60, phase: 1 / 3 },
      { type: 'timedDoor', x: 200, y: 600, w: 24, h: 60, phase: 2 / 3 },
    ]),

    // 6. One belt feeds two compact gear transfers, then a short retracting-piston ride.
    section(5, 540, [
      platform(500, 660, 360),
      conveyor(320, 535, 360, 'conveyorRight', 160),
      platform(24, 350, 286),
      platform(530, 230, 270),
      platform(300, 60, 260),
      platform(640, 60, 280),
    ], [
      { type: 'gear', x: 330, y: 421, radius: 35, period: 4, phase: 0, paddleW: 120 },
      { type: 'gear', x: 350, y: 263, radius: 35, period: 4, phase: 0, paddleW: 110 },
      { type: 'piston', x: 560, y: 76, w: 80, h: 24, axis: 'y', travel: 154, phase: 0.25 },
    ]),

    // 7. The finale stays linear: fast belt, large gear, two telegraphed shoves, then one gate.
    section(6, 540, [
      platform(500, 660, 380),
      conveyor(300, 535, 400, 'conveyorRight', 160),
      platform(200, 330, 100),
      platform(581, 330, 171),
      platform(776, 330, 160),
      platform(24, 205, 728),
      platform(776, 205, 104),
      platform(560, 70, 340),
    ], [
      { type: 'gear', x: 140, y: 380, radius: 65, period: 4, phase: 0, paddleW: 60 },
      { type: 'piston', x: 300, y: 330, w: 80, h: 24, axis: 'x', travel: 201, phase: 0 },
      { type: 'piston', x: 630, y: 221, w: 70, h: 81, axis: 'y', travel: 28, phase: 0.5 },
      { type: 'timedDoor', x: 752, y: 246, w: 24, h: 84, phase: 0.25 },
    ]),
  ],
};
