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
      platform(320, 360, 320),
      platform(500, 70, 360),
    ], [
      { type: 'gear', x: 520, y: 420, radius: 90, period: 6, phase: 0, paddleW: 140 },
      { type: 'gear', x: 420, y: 120, radius: 90, period: 6, phase: 0.5, paddleW: 140 },
    ]),

    // 4. The first piston sweeps a floor toward a dedicated catch; the second descends from overhead.
    section(3, 420, [
      platform(380, 660, 280),
      platform(680, 625, 240, 'normal', 'recovery'),
      platform(350, 535, 300),
      platform(520, 410, 300),
      platform(360, 285, 320),
      platform(500, 170, 340),
      platform(500, 70, 360),
    ], [
      { type: 'piston', x: 480, y: 507, w: 70, h: 28, axis: 'x', travel: 100, phase: 0 },
      { type: 'piston', x: 560, y: 186, w: 70, h: 24, axis: 'y', travel: 70, phase: 0.5 },
    ]),

    // 5. Split floors make every gate's waiting area explicit and keep closing space empty.
    section(4, 560, [
      platform(80, 660, 420),
      platform(524, 660, 376),
      platform(80, 535, 320),
      platform(424, 535, 476),
      platform(80, 410, 480),
      platform(584, 410, 316),
      platform(80, 285, 320),
      platform(240, 170, 320),
      platform(300, 70, 360),
    ], [
      { type: 'timedDoor', x: 500, y: 580, w: 24, h: 80, phase: 0 },
      { type: 'timedDoor', x: 400, y: 455, w: 24, h: 80, phase: 1 / 3 },
      { type: 'timedDoor', x: 560, y: 330, w: 24, h: 80, phase: 2 / 3 },
    ]),

    // 6. One belt feeds two compact gear transfers, then a short retracting-piston ride.
    section(5, 540, [
      platform(500, 660, 360),
      conveyor(320, 535, 360, 'conveyorRight', 160),
      platform(180, 350, 340),
      platform(340, 180, 340),
      platform(500, 70, 360),
    ], [
      { type: 'gear', x: 330, y: 385, radius: 50, period: 4, phase: 0, paddleW: 120 },
      { type: 'gear', x: 300, y: 225, radius: 45, period: 4, phase: 0.5, paddleW: 110 },
      { type: 'piston', x: 560, y: 86, w: 80, h: 24, axis: 'y', travel: 70, phase: 0.25 },
    ]),

    // 7. The finale stays linear: fast belt, large gear, two telegraphed shoves, then one gate.
    section(6, 540, [
      platform(500, 660, 380),
      conveyor(300, 535, 400, 'conveyorRight', 160),
      platform(200, 330, 360),
      platform(260, 205, 300),
      platform(584, 205, 316),
      platform(560, 70, 340),
    ], [
      { type: 'gear', x: 300, y: 365, radius: 70, period: 4, phase: 0, paddleW: 140 },
      { type: 'piston', x: 260, y: 302, w: 70, h: 28, axis: 'x', travel: 140, phase: 0 },
      { type: 'piston', x: 460, y: 212, w: 70, h: 24, axis: 'y', travel: 80, phase: 0.5 },
      { type: 'timedDoor', x: 560, y: 133, w: 24, h: 72, phase: 0.25 },
    ]),
  ],
};
