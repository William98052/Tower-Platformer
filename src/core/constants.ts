// View
export const VIEW_W = 960;
export const VIEW_H = 540;

// Simulation
export const PHYSICS_HZ = 120;
export const STEP = 1 / PHYSICS_HZ;
export const MAX_FRAME_DT = 0.25;
export const MIN_SOLID_THICKNESS = 12;

// Player body
export const PLAYER_SIZE = 28;

// Gravity and running
export const GRAVITY = 2600;
export const MAX_FALL = 1200;
export const RUN_SPEED = 300;
export const GROUND_ACCEL = 3000;
export const GROUND_DECEL = 3600;
export const AIR_ACCEL = 2000;

// Jumping
export const JUMP_VELOCITY = 900;
export const JUMP_CUT = 0.45;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.12;
export const CORNER_CORRECTION = 6;

// Walls
export const WALL_SLIDE_MAX = 160;
export const WALL_JUMP_X = 330;
export const WALL_JUMP_Y = 820;
export const WALL_JUMP_LOCK = 0.15;
export const WALL_JUMP_CONTROL = 0.3;

// Moss Ruins surfaces
export const BOUNCE_VELOCITY = 1020;

// Dash
export const DASH_SPEED = 720;
export const DASH_TIME = 0.15;
export const DASH_END_KEEP = 0.6;
export const GROUND_DASH_COOLDOWN = 0.4;
export const AIR_DASH_CHARGES = 1;
