import type { AABB } from '../physics/aabb';

export interface Room {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  solids: AABB[];
}

const T = 16; // platform thickness

export const TEST_ROOM: Room = {
  width: 960,
  height: 1620,
  spawn: { x: 80, y: 1540 },
  solids: [
    // Shell (enclosed, so the player can never leave the world)
    { x: 0, y: 0, w: 960, h: 24 }, // ceiling
    { x: 0, y: 1580, w: 960, h: 40 }, // floor
    { x: 0, y: 24, w: 24, h: 1556 }, // left wall
    { x: 936, y: 24, w: 24, h: 1556 }, // right wall

    // Warm-up steps
    { x: 24, y: 1460, w: 220, h: T },
    { x: 340, y: 1380, w: 160, h: T },
    { x: 600, y: 1300, w: 140, h: T },

    // Wall-jump shaft between the pillar and the right wall (enter under the pillar)
    { x: 820, y: 880, w: 24, h: 220 }, // pillar, bottom at 1100
    { x: 844, y: 1220, w: 92, h: T }, // shaft floor

    // Shaft exit, then a 240-unit gap to a platform 120 units higher that needs a dash
    { x: 560, y: 860, w: 200, h: T },
    { x: 200, y: 740, w: 120, h: T },

    // Overhang for corner correction, then the upper route
    { x: 120, y: 620, w: 100, h: T },
    { x: 40, y: 480, w: 180, h: T },
    { x: 360, y: 380, w: 160, h: T },
    { x: 640, y: 300, w: 200, h: T },
    { x: 380, y: 160, w: 200, h: T },
  ],
};
