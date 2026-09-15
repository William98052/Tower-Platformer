# Milestone 1 — Movement Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable browser test room where a glowing cube runs, jumps (variable height, coyote time, jump buffer), wall-slides, wall-jumps and 8-way dashes, with smooth fixed-step physics, an easing camera, game-feel effects and a debug overlay.

**Architecture:** TypeScript + Canvas 2D, no engine. Pure, unit-tested logic modules (collision, fixed-step loop, input, player controller, camera, effects state) are driven by a thin `main.ts` that owns the DOM, `requestAnimationFrame` and drawing. Physics runs at 120 Hz; rendering interpolates between physics states. Level geometry is plain data (`AABB[]`).

**Tech Stack:** TypeScript 5.9, Vite 8, Vitest 5, HTML5 Canvas 2D. Node 25.

**Spec:** `docs/superpowers/specs/2026-09-14-tower-platformer-design.md` (§2, §3, §10, §11 step 1).

**Conventions used in every task**
- World units; **y points down** (canvas convention). "Up" means negative `vy`.
- All logic tests live in `tests/` mirroring `src/`. Run a single file with `npx vitest run <path>`.
- Rendering code (`src/render/*-draw.ts`, `src/main.ts`, `src/debug/overlay.ts`) is verified visually, not unit-tested (spec §10).
- Commit after every task. Commit messages end with the line `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Project scaffold, scripts, Vitest config, page shell |
| `src/core/constants.ts` | View size, physics rate, all movement tuning numbers |
| `src/physics/aabb.ts` | `AABB` type and `overlaps` |
| `src/physics/collision.ts` | `moveAndCollide` (axis-separated, corner correction), `isTouching` |
| `src/core/loop.ts` | `FixedStep` accumulator (steps per frame + interpolation alpha) |
| `src/core/input.ts` | `InputFrame`, key bindings, `InputTracker` (edge detection), `readPad` |
| `src/physics/player.ts` | `Player` state, `createPlayer`, `stepPlayer`, `aimDirection` |
| `src/core/camera.ts` | `Camera` follow with easing, clamping, look-ahead, shake |
| `src/render/effects.ts` | Pure effect state: `Particles`, `Squash`, `squashScale`, `Afterimages` |
| `src/stages/test-room.ts` | `Room` type and `TEST_ROOM` geometry |
| `src/render/room-draw.ts` | Background parallax + platform drawing |
| `src/render/player-draw.ts` | Cube, eye, scarf, glow, squash drawing |
| `src/render/effects-draw.ts` | Particle and afterimage drawing |
| `src/debug/overlay.ts` | Hitboxes, FPS, state readout, slow-motion |
| `src/main.ts` | Canvas setup, game loop wiring, events → effects |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tower-platformer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install -D typescript@5.9 vite@8 vitest@5`
Expected: `added N packages`, and `package.json` gains a `devDependencies` block.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tower Platformer</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0c1110; overflow: hidden; }
      body { display: flex; align-items: center; justify-content: center; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create placeholder `src/main.ts`**

```ts
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = 960;
canvas.height = 540;
ctx.fillStyle = '#1b2a22';
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

- [ ] **Step 7: Verify tooling runs**

Run: `npx vitest run --passWithNoTests`
Expected: exits 0 with "No test files found".

Run: `npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

### Task 2: Tuning constants

**Files:**
- Create: `src/core/constants.ts`
- Test: `tests/core/constants.test.ts`

- [ ] **Step 1: Write the failing test**

These tests pin the *intent* behind the numbers (spec §3) so later tuning can't silently break the design.

```ts
import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';

describe('tuning constants', () => {
  it('physics runs at 120 Hz', () => {
    expect(C.STEP).toBeCloseTo(1 / 120, 10);
  });

  it('jump apex is about 155 units', () => {
    const apex = (C.JUMP_VELOCITY * C.JUMP_VELOCITY) / (2 * C.GRAVITY);
    expect(apex).toBeGreaterThan(150);
    expect(apex).toBeLessThan(160);
  });

  it('no single physics step moves further than the thinnest allowed solid', () => {
    const fastest = Math.max(C.MAX_FALL, C.DASH_SPEED, C.JUMP_VELOCITY);
    expect(fastest * C.STEP).toBeLessThan(C.MIN_SOLID_THICKNESS);
  });

  it('dash covers more ground than a running jump gap needs', () => {
    expect(C.DASH_SPEED * C.DASH_TIME).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/constants.test.ts`
Expected: FAIL — cannot resolve `../../src/core/constants`.

- [ ] **Step 3: Write the implementation**

```ts
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

// Dash
export const DASH_SPEED = 720;
export const DASH_TIME = 0.15;
export const DASH_END_KEEP = 0.6;
export const GROUND_DASH_COOLDOWN = 0.4;
export const AIR_DASH_CHARGES = 1;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/constants.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/constants.ts tests/core/constants.test.ts
git commit -m "feat: add movement tuning constants"
```

---

### Task 3: AABB and axis-separated collision

**Files:**
- Create: `src/physics/aabb.ts`, `src/physics/collision.ts`
- Test: `tests/physics/collision.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { overlaps } from '../../src/physics/aabb';
import { isTouching, moveAndCollide } from '../../src/physics/collision';

const box = { x: 0, y: 0, w: 10, h: 10 };

describe('overlaps', () => {
  it('is true for intersecting boxes', () => {
    expect(overlaps(box, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('is false for boxes that only share an edge', () => {
    expect(overlaps(box, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps(box, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });
});

describe('moveAndCollide', () => {
  it('moves freely with no solids', () => {
    expect(moveAndCollide(box, 3, -4, [])).toEqual({ x: 3, y: -4, hitX: false, hitY: false });
  });

  it('lands on a floor when moving down', () => {
    const floor = { x: -50, y: 15, w: 100, h: 10 };
    expect(moveAndCollide(box, 0, 10, [floor])).toEqual({ x: 0, y: 5, hitX: false, hitY: true });
  });

  it('stops at a ceiling when moving up', () => {
    const ceiling = { x: -50, y: -20, w: 100, h: 10 };
    expect(moveAndCollide(box, 0, -15, [ceiling])).toEqual({ x: 0, y: -10, hitX: false, hitY: true });
  });

  it('stops at a wall when moving right', () => {
    const wall = { x: 20, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, 15, 0, [wall])).toEqual({ x: 10, y: 0, hitX: true, hitY: false });
  });

  it('stops at a wall when moving left', () => {
    const wall = { x: -30, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, -25, 0, [wall])).toEqual({ x: -20, y: 0, hitX: true, hitY: false });
  });

  it('slides along a floor it is resting on', () => {
    const floor = { x: -50, y: 10, w: 100, h: 10 };
    expect(moveAndCollide(box, 5, 0, [floor])).toEqual({ x: 5, y: 0, hitX: false, hitY: false });
  });

  it('resolves against the nearest of several solids', () => {
    const near = { x: 12, y: -50, w: 10, h: 100 };
    const far = { x: 18, y: -50, w: 10, h: 100 };
    expect(moveAndCollide(box, 15, 0, [far, near]).x).toBe(2);
  });
});

describe('isTouching', () => {
  it('detects a solid one unit below', () => {
    const floor = { x: -50, y: 10, w: 100, h: 10 };
    expect(isTouching(box, 0, 1, [floor])).toBe(true);
    expect(isTouching(box, 0, -1, [floor])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/physics/collision.test.ts`
Expected: FAIL — cannot resolve `../../src/physics/aabb`.

- [ ] **Step 3: Write `src/physics/aabb.ts`**

```ts
export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

- [ ] **Step 4: Write `src/physics/collision.ts`**

```ts
import { type AABB, overlaps } from './aabb';

export interface MoveResult {
  x: number;
  y: number;
  hitX: boolean;
  hitY: boolean;
}

function solidsAt(x: number, y: number, w: number, h: number, solids: readonly AABB[]): AABB[] {
  const probe = { x, y, w, h };
  return solids.filter((s) => overlaps(probe, s));
}

/** Moves on X first, then Y, clamping against solids on each axis. */
export function moveAndCollide(box: AABB, dx: number, dy: number, solids: readonly AABB[]): MoveResult {
  const { w, h } = box;

  let x = box.x + dx;
  let hitX = false;
  if (dx !== 0) {
    for (const s of solidsAt(x, box.y, w, h, solids)) {
      x = dx > 0 ? Math.min(x, s.x - w) : Math.max(x, s.x + s.w);
      hitX = true;
    }
  }

  let y = box.y + dy;
  let hitY = false;
  if (dy !== 0) {
    for (const s of solidsAt(x, y, w, h, solids)) {
      y = dy > 0 ? Math.min(y, s.y - h) : Math.max(y, s.y + s.h);
      hitY = true;
    }
  }

  return { x, y, hitX, hitY };
}

export function isTouching(box: AABB, offsetX: number, offsetY: number, solids: readonly AABB[]): boolean {
  return solidsAt(box.x + offsetX, box.y + offsetY, box.w, box.h, solids).length > 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/physics/collision.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/physics/aabb.ts src/physics/collision.ts tests/physics/collision.test.ts
git commit -m "feat: add AABB collision with axis-separated resolution"
```

---

### Task 4: Corner correction

When the player's head clips the very edge of a ceiling, nudge them sideways around it instead of stopping the jump (spec §3).

**Files:**
- Modify: `src/physics/collision.ts`
- Test: `tests/physics/collision.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Add to the end of `tests/physics/collision.test.ts`:

```ts
describe('moveAndCollide corner correction', () => {
  const player = { x: 0, y: 20, w: 10, h: 10 };

  it('nudges around a ceiling corner that overlaps by 4 units', () => {
    const ledge = { x: -100, y: 0, w: 104, h: 10 }; // right edge at x=4
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: 4, y: 5, hitX: false, hitY: false });
  });

  it('nudges left around a corner on the right', () => {
    const ledge = { x: 7, y: 0, w: 100, h: 10 }; // left edge at x=7, overlap 3
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: -3, y: 5, hitX: false, hitY: false });
  });

  it('does not nudge when the overlap is larger than the correction', () => {
    const ledge = { x: -100, y: 0, w: 108, h: 10 }; // overlap 8
    expect(moveAndCollide(player, 0, -15, [ledge], 6)).toEqual({ x: 0, y: 10, hitX: false, hitY: true });
  });

  it('does not nudge when disabled', () => {
    const ledge = { x: -100, y: 0, w: 104, h: 10 };
    expect(moveAndCollide(player, 0, -15, [ledge]).hitY).toBe(true);
  });

  it('never nudges when moving down', () => {
    const floor = { x: -100, y: 35, w: 104, h: 10 };
    expect(moveAndCollide(player, 0, 10, [floor], 6)).toEqual({ x: 0, y: 25, hitX: false, hitY: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/physics/collision.test.ts`
Expected: FAIL — the first two corner tests report `hitY: true` (the 4th argument is ignored).

- [ ] **Step 3: Replace `moveAndCollide` in `src/physics/collision.ts`**

Replace the whole `moveAndCollide` function with this version, and add `findCornerNudge` below it:

```ts
/**
 * Moves on X first, then Y, clamping against solids on each axis.
 * When moving up into a ceiling, tries sliding up to `cornerCorrection`
 * units sideways to clear the corner before giving up.
 */
export function moveAndCollide(
  box: AABB,
  dx: number,
  dy: number,
  solids: readonly AABB[],
  cornerCorrection = 0,
): MoveResult {
  const { w, h } = box;

  let x = box.x + dx;
  let hitX = false;
  if (dx !== 0) {
    for (const s of solidsAt(x, box.y, w, h, solids)) {
      x = dx > 0 ? Math.min(x, s.x - w) : Math.max(x, s.x + s.w);
      hitX = true;
    }
  }

  let y = box.y + dy;
  let hitY = false;
  if (dy !== 0) {
    let blockers = solidsAt(x, y, w, h, solids);
    if (blockers.length > 0 && dy < 0 && cornerCorrection > 0) {
      const nudge = findCornerNudge(x, y, w, h, solids, cornerCorrection);
      if (nudge !== 0) {
        x += nudge;
        blockers = [];
      }
    }
    for (const s of blockers) {
      y = dy > 0 ? Math.min(y, s.y - h) : Math.max(y, s.y + s.h);
      hitY = true;
    }
  }

  return { x, y, hitX, hitY };
}

function findCornerNudge(
  x: number,
  y: number,
  w: number,
  h: number,
  solids: readonly AABB[],
  max: number,
): number {
  for (let k = 1; k <= max; k++) {
    if (solidsAt(x + k, y, w, h, solids).length === 0) return k;
    if (solidsAt(x - k, y, w, h, solids).length === 0) return -k;
  }
  return 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/physics/collision.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/physics/collision.ts tests/physics/collision.test.ts
git commit -m "feat: add ceiling corner correction to collision"
```

---

### Task 5: Fixed-step loop accumulator

Physics runs at exactly 120 steps per second no matter the monitor refresh rate; the leftover fraction becomes the render interpolation `alpha` (spec §2.2).

**Files:**
- Create: `src/core/loop.ts`
- Test: `tests/core/loop.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { FixedStep } from '../../src/core/loop';

const STEP = 1 / 120;

describe('FixedStep', () => {
  it('runs 2 steps for one 60 Hz frame', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(1 / 60)).toBe(2);
  });

  it('carries leftover time into the next frame', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(1 / 240)).toBe(0);
    expect(loop.alpha).toBeCloseTo(0.5, 6);
    expect(loop.advance(1 / 240)).toBe(1);
    expect(loop.alpha).toBeCloseTo(0, 6);
  });

  it('clamps huge frame gaps to maxFrame', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(3)).toBe(30);
  });

  it('ignores negative frame times', () => {
    const loop = new FixedStep(STEP, 0.25);
    expect(loop.advance(-1)).toBe(0);
  });

  it('keeps alpha within [0, 1)', () => {
    const loop = new FixedStep(STEP, 0.25);
    for (const dt of [0.013, 0.007, 0.021, 0.0166, 0.0069]) {
      loop.advance(dt);
      expect(loop.alpha).toBeGreaterThanOrEqual(0);
      expect(loop.alpha).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/loop.test.ts`
Expected: FAIL — cannot resolve `../../src/core/loop`.

- [ ] **Step 3: Write the implementation**

```ts
/** Converts variable frame times into a whole number of fixed physics steps. */
export class FixedStep {
  /** Fraction of a step left over, used to interpolate rendering. */
  alpha = 0;
  private accumulator = 0;

  constructor(
    readonly step: number,
    readonly maxFrame: number,
  ) {}

  /** Adds frame time and returns how many physics steps to run now. */
  advance(frameDt: number): number {
    this.accumulator += Math.min(Math.max(frameDt, 0), this.maxFrame);
    // Small epsilon so 1/60 counts as exactly two 1/120 steps despite float error.
    const steps = Math.floor(this.accumulator / this.step + 1e-9);
    this.accumulator = Math.max(0, this.accumulator - steps * this.step);
    this.alpha = Math.min(this.accumulator / this.step, 0.999999);
    return steps;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/loop.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/loop.ts tests/core/loop.test.ts
git commit -m "feat: add fixed-step loop accumulator"
```

---

### Task 6: Input tracking (keyboard + gamepad)

`InputTracker` holds raw key state and turns it into an `InputFrame` once per rendered frame. "Pressed" flags are edges: true only in the first frame after a press, even if the key was tapped and released between frames. W/Up only aim; jump is Space or C.

**Files:**
- Create: `src/core/input.ts`, `tests/helpers/input.ts`
- Test: `tests/core/input.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { InputTracker, NO_PAD, readPad, withoutPresses } from '../../src/core/input';

function pad(pressed: number[], axes: number[] = [0, 0]) {
  const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) }));
  return { axes, buttons };
}

describe('InputTracker keyboard', () => {
  it('maps held arrow keys and WASD to movement axes', () => {
    const t = new InputTracker();
    t.keyDown('ArrowRight');
    t.keyDown('KeyW');
    const f = t.sample();
    expect(f.moveX).toBe(1);
    expect(f.moveY).toBe(-1);
  });

  it('cancels opposite directions', () => {
    const t = new InputTracker();
    t.keyDown('KeyA');
    t.keyDown('KeyD');
    expect(t.sample().moveX).toBe(0);
  });

  it('reports jumpPressed only on the first sample after the press', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    const first = t.sample();
    expect(first.jump).toBe(true);
    expect(first.jumpPressed).toBe(true);
    const second = t.sample();
    expect(second.jump).toBe(true);
    expect(second.jumpPressed).toBe(false);
  });

  it('ignores key-repeat keydown events', () => {
    const t = new InputTracker();
    t.keyDown('KeyX');
    t.sample();
    t.keyDown('KeyX');
    expect(t.sample().dashPressed).toBe(false);
  });

  it('keeps a tap that happens entirely between samples', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.keyUp('Space');
    const f = t.sample();
    expect(f.jumpPressed).toBe(true);
    expect(f.jump).toBe(false);
  });

  it('does not treat W or Up as jump', () => {
    const t = new InputTracker();
    t.keyDown('KeyW');
    t.keyDown('ArrowUp');
    const f = t.sample();
    expect(f.jump).toBe(false);
    expect(f.jumpPressed).toBe(false);
  });

  it('releaseAll clears held and pending presses', () => {
    const t = new InputTracker();
    t.keyDown('ShiftLeft');
    t.keyDown('ArrowLeft');
    t.releaseAll();
    const f = t.sample();
    expect(f.moveX).toBe(0);
    expect(f.dashPressed).toBe(false);
  });
});

describe('readPad', () => {
  it('returns NO_PAD when no gamepad is connected', () => {
    expect(readPad(null)).toEqual(NO_PAD);
  });

  it('uses the left stick past the deadzone', () => {
    expect(readPad(pad([], [0.3, 0])).right).toBe(false);
    expect(readPad(pad([], [0.8, -0.9]))).toMatchObject({ right: true, up: true });
  });

  it('maps d-pad, A to jump, and X or RB to dash', () => {
    expect(readPad(pad([14, 0]))).toMatchObject({ left: true, jump: true, dash: false });
    expect(readPad(pad([2])).dash).toBe(true);
    expect(readPad(pad([5])).dash).toBe(true);
  });
});

describe('InputTracker gamepad merge', () => {
  it('detects pad button edges across samples', () => {
    const t = new InputTracker();
    const held = readPad(pad([0]));
    expect(t.sample(held).jumpPressed).toBe(true);
    expect(t.sample(held).jumpPressed).toBe(false);
    expect(t.sample(NO_PAD).jump).toBe(false);
    expect(t.sample(held).jumpPressed).toBe(true);
  });
});

describe('withoutPresses', () => {
  it('clears edge flags but keeps held state', () => {
    const t = new InputTracker();
    t.keyDown('Space');
    t.keyDown('KeyX');
    t.keyDown('ArrowRight');
    const f = withoutPresses(t.sample());
    expect(f).toEqual({ moveX: 1, moveY: 0, jump: true, jumpPressed: false, dashPressed: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/input.test.ts`
Expected: FAIL — cannot resolve `../../src/core/input`.

- [ ] **Step 3: Write `src/core/input.ts`**

```ts
export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'dash';
export type Bindings = Record<Action, readonly string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyC'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyX'],
};

export type Axis = -1 | 0 | 1;

/** One physics step's worth of player intent. */
export interface InputFrame {
  moveX: Axis;
  /** -1 is up (y points down). */
  moveY: Axis;
  jump: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
}

export const EMPTY_INPUT: InputFrame = {
  moveX: 0,
  moveY: 0,
  jump: false,
  jumpPressed: false,
  dashPressed: false,
};

export interface PadState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  dash: boolean;
}

export const NO_PAD: PadState = { left: false, right: false, up: false, down: false, jump: false, dash: false };

export interface GamepadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

const STICK_DEADZONE = 0.5;

/** Reads a standard-mapping gamepad. */
export function readPad(gp: GamepadLike | null | undefined): PadState {
  if (!gp) return NO_PAD;
  const button = (i: number) => gp.buttons[i]?.pressed ?? false;
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  return {
    left: ax < -STICK_DEADZONE || button(14),
    right: ax > STICK_DEADZONE || button(15),
    up: ay < -STICK_DEADZONE || button(12),
    down: ay > STICK_DEADZONE || button(13),
    jump: button(0),
    dash: button(2) || button(5),
  };
}

function axis(negative: boolean, positive: boolean): Axis {
  if (negative === positive) return 0;
  return positive ? 1 : -1;
}

export class InputTracker {
  private held = new Set<string>();
  private pressed = new Set<'jump' | 'dash'>();
  private prevPad: PadState = NO_PAD;

  constructor(private readonly bindings: Bindings = DEFAULT_BINDINGS) {}

  keyDown(code: string): void {
    if (this.held.has(code)) return; // browser key repeat
    this.held.add(code);
    if (this.bindings.jump.includes(code)) this.pressed.add('jump');
    if (this.bindings.dash.includes(code)) this.pressed.add('dash');
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  releaseAll(): void {
    this.held.clear();
    this.pressed.clear();
  }

  /** Builds this frame's input and consumes pending presses. */
  sample(pad: PadState = NO_PAD): InputFrame {
    const frame: InputFrame = {
      moveX: axis(this.isHeld('left') || pad.left, this.isHeld('right') || pad.right),
      moveY: axis(this.isHeld('up') || pad.up, this.isHeld('down') || pad.down),
      jump: this.isHeld('jump') || pad.jump,
      jumpPressed: this.pressed.has('jump') || (pad.jump && !this.prevPad.jump),
      dashPressed: this.pressed.has('dash') || (pad.dash && !this.prevPad.dash),
    };
    this.pressed.clear();
    this.prevPad = pad;
    return frame;
  }

  private isHeld(action: Action): boolean {
    return this.bindings[action].some((code) => this.held.has(code));
  }
}

/** Same frame with edge flags cleared, for the 2nd+ physics step of a render frame. */
export function withoutPresses(frame: InputFrame): InputFrame {
  return { ...frame, jumpPressed: false, dashPressed: false };
}
```

- [ ] **Step 4: Write the shared test helper `tests/helpers/input.ts`**

Used by all player tests from Task 7 onward.

```ts
import { EMPTY_INPUT, type InputFrame } from '../../src/core/input';

export function input(partial: Partial<InputFrame> = {}): InputFrame {
  return { ...EMPTY_INPUT, ...partial };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/input.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/input.ts tests/core/input.test.ts tests/helpers/input.ts
git commit -m "feat: add keyboard and gamepad input tracking"
```

---

### Task 7: Player — gravity, running, ground and wall contact

**Files:**
- Create: `src/physics/player.ts`
- Test: `tests/physics/player-move.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { approach, createPlayer, stepPlayer, type StepEvents } from '../../src/physics/player';
import { input } from '../helpers/input';

const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };
const FLOOR_Y = FLOOR.y - C.PLAYER_SIZE; // 72

function onFloor(x = 0) {
  const p = createPlayer(x, FLOOR_Y);
  stepPlayer(p, input(), [FLOOR]);
  return p;
}

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 4)).toBe(6);
    expect(approach(1, 0, 4)).toBe(0);
  });
});

describe('stepPlayer: gravity and ground', () => {
  it('falls and comes to rest on the floor', () => {
    const p = createPlayer(0, 0);
    for (let i = 0; i < 120; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.y).toBe(FLOOR_Y);
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
  });

  it('caps fall speed', () => {
    const p = createPlayer(0, 0);
    for (let i = 0; i < 300; i++) stepPlayer(p, input(), []);
    expect(p.vy).toBe(C.MAX_FALL);
  });

  it('reports the impact speed once when landing', () => {
    const p = createPlayer(0, -200);
    const landings: number[] = [];
    for (let i = 0; i < 120; i++) {
      const e: StepEvents = stepPlayer(p, input(), [FLOOR]);
      if (e.landed > 0) landings.push(e.landed);
    }
    expect(landings).toHaveLength(1);
    expect(landings[0]).toBeGreaterThan(1000);
  });
});

describe('stepPlayer: running', () => {
  it('accelerates to run speed', () => {
    const p = onFloor();
    for (let i = 0; i < 60; i++) stepPlayer(p, input({ moveX: 1 }), [FLOOR]);
    expect(p.vx).toBe(C.RUN_SPEED);
  });

  it('decelerates to a stop when input is released', () => {
    const p = onFloor();
    p.vx = C.RUN_SPEED;
    for (let i = 0; i < 60; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.vx).toBe(0);
  });

  it('turns to face the movement direction', () => {
    const p = onFloor();
    stepPlayer(p, input({ moveX: -1 }), [FLOOR]);
    expect(p.facing).toBe(-1);
  });

  it('stops against a wall', () => {
    const wall = { x: 100, y: -1000, w: 40, h: 1100 };
    const p = onFloor();
    for (let i = 0; i < 120; i++) stepPlayer(p, input({ moveX: 1 }), [FLOOR, wall]);
    expect(p.x).toBe(100 - C.PLAYER_SIZE);
    expect(p.vx).toBe(0);
  });
});

describe('stepPlayer: wall contact', () => {
  const wall = { x: 100, y: -2000, w: 40, h: 4000 };

  it('reports the wall side while airborne', () => {
    const p = createPlayer(100 - C.PLAYER_SIZE, 0);
    stepPlayer(p, input(), [wall]);
    expect(p.wallDir).toBe(1);
  });

  it('reports no wall while standing on the ground', () => {
    const p = createPlayer(100 - C.PLAYER_SIZE, FLOOR_Y);
    stepPlayer(p, input(), [FLOOR, wall]);
    expect(p.onGround).toBe(true);
    expect(p.wallDir).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/physics/player-move.test.ts`
Expected: FAIL — cannot resolve `../../src/physics/player`.

- [ ] **Step 3: Write `src/physics/player.ts`**

All state fields used by later tasks are declared now, so later tasks only add behavior.

```ts
import * as C from '../core/constants';
import type { InputFrame } from '../core/input';
import type { AABB } from './aabb';
import { isTouching, moveAndCollide } from './collision';

export interface Player extends AABB {
  vx: number;
  vy: number;
  onGround: boolean;
  /** -1 wall on the left, 1 wall on the right, 0 none (always 0 on the ground). */
  wallDir: -1 | 0 | 1;
  facing: -1 | 1;
  coyote: number;
  jumpBuffer: number;
  /** True while rising from a jump that can still be cut short. */
  jumping: boolean;
  wallJumpLock: number;
  dashCharges: number;
  dashTimer: number;
  dashCooldown: number;
}

/** What happened during one step, for effects and sound. */
export interface StepEvents {
  jumped: boolean;
  wallJumped: boolean;
  dashed: boolean;
  /** Downward speed at the moment of landing, or 0 if the player did not land this step. */
  landed: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    w: C.PLAYER_SIZE,
    h: C.PLAYER_SIZE,
    vx: 0,
    vy: 0,
    onGround: false,
    wallDir: 0,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    jumping: false,
    wallJumpLock: 0,
    dashCharges: C.AIR_DASH_CHARGES,
    dashTimer: 0,
    dashCooldown: 0,
  };
}

export function approach(value: number, target: number, maxDelta: number): number {
  return value < target ? Math.min(value + maxDelta, target) : Math.max(value - maxDelta, target);
}

export function stepPlayer(p: Player, input: InputFrame, solids: readonly AABB[], dt = C.STEP): StepEvents {
  const events: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };
  applyHorizontal(p, input, dt);
  applyGravity(p, dt);
  moveAndResolve(p, solids, dt, events);
  return events;
}

function applyHorizontal(p: Player, input: InputFrame, dt: number): void {
  if (input.moveX !== 0) p.facing = input.moveX;
  const target = input.moveX * C.RUN_SPEED;
  const accel = p.onGround ? (input.moveX !== 0 ? C.GROUND_ACCEL : C.GROUND_DECEL) : C.AIR_ACCEL;
  p.vx = approach(p.vx, target, accel * dt);
}

function applyGravity(p: Player, dt: number): void {
  p.vy = Math.min(p.vy + C.GRAVITY * dt, C.MAX_FALL);
}

function moveAndResolve(p: Player, solids: readonly AABB[], dt: number, events: StepEvents): void {
  const impact = p.vy;
  const result = moveAndCollide(p, p.vx * dt, p.vy * dt, solids, C.CORNER_CORRECTION);
  p.x = result.x;
  p.y = result.y;
  if (result.hitX) p.vx = 0;
  if (result.hitY) p.vy = 0;

  const wasOnGround = p.onGround;
  p.onGround = isTouching(p, 0, 1, solids);
  p.wallDir = p.onGround ? 0 : isTouching(p, -1, 0, solids) ? -1 : isTouching(p, 1, 0, solids) ? 1 : 0;
  if (p.onGround && !wasOnGround) events.landed = Math.max(impact, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/physics/player-move.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/physics/player.ts tests/physics/player-move.test.ts
git commit -m "feat: add player gravity, running and contact detection"
```

---

### Task 8: Player — variable jump, coyote time, jump buffer

**Files:**
- Modify: `src/physics/player.ts`
- Test: `tests/physics/player-jump.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };
const FLOOR_Y = FLOOR.y - C.PLAYER_SIZE;

function onFloor(x = 0, solids = [FLOOR]) {
  const p = createPlayer(x, FLOOR_Y);
  stepPlayer(p, input(), solids);
  return p;
}

/** Jumps, holding jump for `holdSteps` steps, and returns the height gained at the apex. */
function jumpHeight(holdSteps: number): number {
  const p = onFloor();
  const startY = p.y;
  let minY = p.y;
  stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
  for (let i = 1; i < 240; i++) {
    stepPlayer(p, input({ jump: i < holdSteps }), [FLOOR]);
    minY = Math.min(minY, p.y);
    if (p.vy >= 0) break;
  }
  return startY - minY;
}

describe('jump', () => {
  it('leaves the ground with upward velocity', () => {
    const p = onFloor();
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
    expect(e.jumped).toBe(true);
    expect(p.vy).toBe(-C.JUMP_VELOCITY);
    expect(p.onGround).toBe(false);
  });

  it('reaches about 155 units when held', () => {
    const h = jumpHeight(1000);
    // ≈159.5 in practice: the jump step sets vy after gravity, so that step rises a full 7.5 units.
    expect(h).toBeGreaterThan(145);
    expect(h).toBeLessThan(162);
  });

  it('is much shorter when released early', () => {
    const h = jumpHeight(3);
    expect(h).toBeGreaterThan(20);
    expect(h).toBeLessThan(60);
  });

  it('cannot jump in mid-air without coyote time', () => {
    const p = createPlayer(0, 0);
    for (let i = 0; i < 30; i++) stepPlayer(p, input(), []);
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), []);
    expect(e.jumped).toBe(false);
    expect(p.vy).toBeGreaterThan(0);
  });
});

describe('coyote time', () => {
  const LEDGE = { x: 0, y: 100, w: 100, h: 40 };

  function runOffLedge(extraSteps: number) {
    const p = onFloor(60, [LEDGE]);
    for (let i = 0; i < 120 && p.onGround; i++) stepPlayer(p, input({ moveX: 1 }), [LEDGE]);
    expect(p.onGround).toBe(false);
    for (let i = 0; i < extraSteps; i++) stepPlayer(p, input({ moveX: 1 }), [LEDGE]);
    return stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [LEDGE]);
  }

  it('allows a jump shortly after running off a ledge', () => {
    expect(runOffLedge(6).jumped).toBe(true);
  });

  it('expires after COYOTE_TIME', () => {
    expect(runOffLedge(18).jumped).toBe(false);
  });
});

describe('jump buffer', () => {
  it('jumps on landing when pressed just before touching down', () => {
    const p = createPlayer(0, FLOOR_Y - 30);
    p.vy = 400;
    let jumped = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]).jumped;
    for (let i = 1; i < 14 && !jumped; i++) {
      jumped = stepPlayer(p, input({ jump: true }), [FLOOR]).jumped;
    }
    expect(jumped).toBe(true);
  });

  it('expires when pressed too early', () => {
    const p = createPlayer(0, FLOOR_Y - 222);
    p.vy = 400;
    let jumped = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]).jumped;
    for (let i = 1; i < 60; i++) {
      jumped ||= stepPlayer(p, input({ jump: true }), [FLOOR]).jumped;
    }
    expect(jumped).toBe(false);
    expect(p.onGround).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/physics/player-jump.test.ts`
Expected: FAIL — `jumped` is always `false` (no jump logic yet).

- [ ] **Step 3: Replace `stepPlayer` and add the jump helpers in `src/physics/player.ts`**

Replace the existing `stepPlayer` function with:

```ts
export function stepPlayer(p: Player, input: InputFrame, solids: readonly AABB[], dt = C.STEP): StepEvents {
  const events: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };
  tickTimers(p, input, dt);
  applyHorizontal(p, input, dt);
  applyGravity(p, dt);
  tryJump(p, events);
  applyJumpCut(p, input);
  moveAndResolve(p, solids, dt, events);
  return events;
}
```

Add these functions below `applyGravity`:

```ts
function tickTimers(p: Player, input: InputFrame, dt: number): void {
  p.coyote = p.onGround ? C.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? C.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
}

function tryJump(p: Player, events: StepEvents): void {
  if (p.jumpBuffer <= 0) return;
  if (p.onGround || p.coyote > 0) {
    p.vy = -C.JUMP_VELOCITY;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.onGround = false;
    p.jumping = true;
    events.jumped = true;
  }
}

/** Releasing jump while still rising cuts the jump short. */
function applyJumpCut(p: Player, input: InputFrame): void {
  if (!p.jumping) return;
  if (p.vy >= 0) {
    p.jumping = false;
  } else if (!input.jump) {
    p.vy *= C.JUMP_CUT;
    p.jumping = false;
  }
}
```

- [ ] **Step 4: Run all player tests to verify they pass**

Run: `npx vitest run tests/physics`
Expected: PASS (all collision, player-move and player-jump tests).

- [ ] **Step 5: Commit**

```bash
git add src/physics/player.ts tests/physics/player-jump.test.ts
git commit -m "feat: add variable jump, coyote time and jump buffer"
```

---

### Task 9: Player — wall slide and wall jump

**Files:**
- Modify: `src/physics/player.ts`
- Test: `tests/physics/player-wall.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const WALL = { x: 100, y: -2000, w: 40, h: 4000 };
const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };

function againstWall() {
  const p = createPlayer(WALL.x - C.PLAYER_SIZE, 0);
  p.vy = 600;
  return p;
}

describe('wall slide', () => {
  it('caps fall speed while holding toward the wall', () => {
    const p = againstWall();
    for (let i = 0; i < 60; i++) stepPlayer(p, input({ moveX: 1 }), [WALL]);
    expect(p.wallDir).toBe(1);
    expect(p.vy).toBe(C.WALL_SLIDE_MAX);
  });

  it('does not slow the fall when not holding toward the wall', () => {
    const p = againstWall();
    for (let i = 0; i < 60; i++) stepPlayer(p, input(), [WALL]);
    expect(p.vy).toBeGreaterThan(C.WALL_SLIDE_MAX);
  });
});

describe('wall jump', () => {
  function slideThenJump() {
    const p = againstWall();
    for (let i = 0; i < 10; i++) stepPlayer(p, input({ moveX: 1 }), [WALL]);
    const e = stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [WALL]);
    return { p, e };
  }

  it('launches up and away from the wall', () => {
    const { p, e } = slideThenJump();
    expect(e.wallJumped).toBe(true);
    expect(e.jumped).toBe(false);
    expect(p.vx).toBe(-C.WALL_JUMP_X);
    expect(p.vy).toBe(-C.WALL_JUMP_Y);
    expect(p.facing).toBe(-1);
  });

  it('reduces air control briefly afterwards', () => {
    const { p } = slideThenJump();
    stepPlayer(p, input({ moveX: 1, jump: true }), [WALL]);
    const expected = -C.WALL_JUMP_X + C.AIR_ACCEL * C.WALL_JUMP_CONTROL * C.STEP;
    expect(p.vx).toBeCloseTo(expected, 6);
  });

  it('restores full air control after the lock expires', () => {
    const { p } = slideThenJump();
    for (let i = 0; i < 20; i++) stepPlayer(p, input({ jump: true }), [WALL]);
    const before = p.vx;
    stepPlayer(p, input({ moveX: 1, jump: true }), [WALL]);
    expect(p.vx - before).toBeCloseTo(C.AIR_ACCEL * C.STEP, 6);
  });

  it('does a normal jump instead when standing on the ground next to a wall', () => {
    const p = createPlayer(WALL.x - C.PLAYER_SIZE, FLOOR.y - C.PLAYER_SIZE);
    stepPlayer(p, input(), [FLOOR, WALL]);
    const e = stepPlayer(p, input({ moveX: 1, jump: true, jumpPressed: true }), [FLOOR, WALL]);
    expect(e.jumped).toBe(true);
    expect(e.wallJumped).toBe(false);
  });

  it('does nothing in open air', () => {
    const p = createPlayer(0, 0);
    p.vy = 600;
    stepPlayer(p, input(), []);
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), []);
    expect(e.wallJumped).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/physics/player-wall.test.ts`
Expected: FAIL — the wall-slide cap test gets a `vy` above 160, and the wall-jump tests get `wallJumped: false`.

- [ ] **Step 3: Update `src/physics/player.ts`**

Replace `stepPlayer`, `applyHorizontal`, `applyGravity`, `tickTimers` and `tryJump` with these versions (`applyGravity` now takes `input`):

```ts
export function stepPlayer(p: Player, input: InputFrame, solids: readonly AABB[], dt = C.STEP): StepEvents {
  const events: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };
  tickTimers(p, input, dt);
  applyHorizontal(p, input, dt);
  applyGravity(p, input, dt);
  tryJump(p, events);
  applyJumpCut(p, input);
  moveAndResolve(p, solids, dt, events);
  return events;
}

function applyHorizontal(p: Player, input: InputFrame, dt: number): void {
  if (input.moveX !== 0) p.facing = input.moveX;
  const target = input.moveX * C.RUN_SPEED;
  const accel = p.onGround ? (input.moveX !== 0 ? C.GROUND_ACCEL : C.GROUND_DECEL) : C.AIR_ACCEL;
  const control = p.wallJumpLock > 0 ? C.WALL_JUMP_CONTROL : 1;
  p.vx = approach(p.vx, target, accel * control * dt);
}

function applyGravity(p: Player, input: InputFrame, dt: number): void {
  p.vy = Math.min(p.vy + C.GRAVITY * dt, C.MAX_FALL);
  const sliding = !p.onGround && p.wallDir !== 0 && input.moveX === p.wallDir;
  if (sliding && p.vy > C.WALL_SLIDE_MAX) p.vy = C.WALL_SLIDE_MAX;
}

function tickTimers(p: Player, input: InputFrame, dt: number): void {
  p.coyote = p.onGround ? C.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? C.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
  p.wallJumpLock = Math.max(0, p.wallJumpLock - dt);
}

function tryJump(p: Player, events: StepEvents): void {
  if (p.jumpBuffer <= 0) return;
  if (p.onGround || p.coyote > 0) {
    p.vy = -C.JUMP_VELOCITY;
    p.onGround = false;
    events.jumped = true;
  } else if (p.wallDir !== 0) {
    p.vx = -p.wallDir * C.WALL_JUMP_X;
    p.vy = -C.WALL_JUMP_Y;
    p.facing = p.wallDir === 1 ? -1 : 1;
    p.wallJumpLock = C.WALL_JUMP_LOCK;
    events.wallJumped = true;
  } else {
    return;
  }
  p.jumpBuffer = 0;
  p.coyote = 0;
  p.jumping = true;
}
```

- [ ] **Step 4: Run all physics tests to verify they pass**

Run: `npx vitest run tests/physics`
Expected: PASS (collision, player-move, player-jump and player-wall).

- [ ] **Step 5: Commit**

```bash
git add src/physics/player.ts tests/physics/player-wall.test.ts
git commit -m "feat: add wall slide and wall jump"
```

---

### Task 10: Player — 8-direction dash

**Files:**
- Modify: `src/physics/player.ts`
- Test: `tests/physics/player-dash.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { aimDirection, createPlayer, stepPlayer } from '../../src/physics/player';
import { input } from '../helpers/input';

const FLOOR = { x: -1000, y: 100, w: 3000, h: 40 };
const FLOOR_Y = FLOOR.y - C.PLAYER_SIZE;
const DASH = input({ dashPressed: true });

function onFloor() {
  const p = createPlayer(0, FLOOR_Y);
  stepPlayer(p, input(), [FLOOR]);
  return p;
}

describe('aimDirection', () => {
  it('uses facing when no direction is held', () => {
    expect(aimDirection(0, 0, -1)).toEqual({ x: -1, y: 0 });
  });

  it('normalizes diagonals', () => {
    const d = aimDirection(1, -1, 1);
    expect(d.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(d.y).toBeCloseTo(-Math.SQRT1_2, 6);
  });

  it('supports straight down', () => {
    expect(aimDirection(0, 1, 1)).toEqual({ x: 0, y: 1 });
  });
});

describe('air dash', () => {
  it('moves at dash speed with no gravity', () => {
    const p = createPlayer(0, 0);
    const e = stepPlayer(p, input({ dashPressed: true, moveX: 1 }), []);
    expect(e.dashed).toBe(true);
    expect(p.vx).toBe(C.DASH_SPEED);
    expect(p.vy).toBe(0);
    for (let i = 0; i < 10; i++) stepPlayer(p, input(), []);
    expect(p.vx).toBe(C.DASH_SPEED);
    expect(p.vy).toBe(0);
  });

  it('dashes the way the player faces when no direction is held', () => {
    const p = createPlayer(0, 0);
    p.facing = -1;
    stepPlayer(p, DASH, []);
    expect(p.vx).toBe(-C.DASH_SPEED);
  });

  it('dashes diagonally', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, input({ dashPressed: true, moveX: 1, moveY: -1 }), []);
    expect(p.vx).toBeCloseTo(C.DASH_SPEED * Math.SQRT1_2, 6);
    expect(p.vy).toBeCloseTo(-C.DASH_SPEED * Math.SQRT1_2, 6);
  });

  it('ends after DASH_TIME and keeps part of its speed', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, input({ dashPressed: true, moveX: 1 }), []);
    let steps = 1;
    while (p.dashTimer > 0 && steps < 30) {
      stepPlayer(p, input(), []);
      steps++;
    }
    expect(steps).toBeGreaterThanOrEqual(17);
    expect(steps).toBeLessThanOrEqual(19);
    expect(p.vx).toBeCloseTo(C.DASH_SPEED * C.DASH_END_KEEP, 6);
  });

  it('allows only one dash in the air', () => {
    const p = createPlayer(0, 0);
    stepPlayer(p, DASH, []);
    for (let i = 0; i < 30; i++) stepPlayer(p, input(), []);
    expect(stepPlayer(p, DASH, []).dashed).toBe(false);
  });

  it('refills when landing', () => {
    const p = createPlayer(0, FLOOR_Y - 100);
    stepPlayer(p, DASH, [FLOOR]);
    expect(p.dashCharges).toBe(0);
    for (let i = 0; i < 120; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.onGround).toBe(true);
    expect(p.dashCharges).toBe(C.AIR_DASH_CHARGES);
  });

  it('refills while wall sliding', () => {
    const wall = { x: 100, y: -2000, w: 40, h: 4000 };
    const p = createPlayer(wall.x - C.PLAYER_SIZE, 0);
    p.dashCharges = 0;
    stepPlayer(p, input({ moveX: 1 }), [wall]);
    stepPlayer(p, input({ moveX: 1 }), [wall]);
    expect(p.dashCharges).toBe(C.AIR_DASH_CHARGES);
  });
});

describe('ground dash', () => {
  it('does not spend the air charge', () => {
    const p = onFloor();
    expect(stepPlayer(p, DASH, [FLOOR]).dashed).toBe(true);
    expect(p.dashCharges).toBe(C.AIR_DASH_CHARGES);
  });

  it('has a cooldown', () => {
    const p = onFloor();
    stepPlayer(p, DASH, [FLOOR]);
    // 30 steps: the dash itself (18 steps) is over, but the 0.4 s cooldown is not.
    for (let i = 0; i < 30; i++) stepPlayer(p, input(), [FLOOR]);
    expect(p.dashTimer).toBe(0);
    expect(stepPlayer(p, DASH, [FLOOR]).dashed).toBe(false);
    for (let i = 0; i < 60; i++) stepPlayer(p, input(), [FLOOR]);
    expect(stepPlayer(p, DASH, [FLOOR]).dashed).toBe(true);
  });

  it('can be cancelled by jumping', () => {
    const p = onFloor();
    stepPlayer(p, input({ dashPressed: true, moveX: 1 }), [FLOOR]);
    const e = stepPlayer(p, input({ jump: true, jumpPressed: true }), [FLOOR]);
    expect(e.jumped).toBe(true);
    expect(p.dashTimer).toBe(0);
    expect(p.vy).toBe(-C.JUMP_VELOCITY);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/physics/player-dash.test.ts`
Expected: FAIL — `aimDirection` is not exported.

- [ ] **Step 3: Update `src/physics/player.ts`**

Add `aimDirection` after `approach`:

```ts
/** Unit dash direction from held input; falls back to facing when nothing is held. */
export function aimDirection(moveX: number, moveY: number, facing: -1 | 1): { x: number; y: number } {
  if (moveX === 0 && moveY === 0) return { x: facing, y: 0 };
  const length = Math.hypot(moveX, moveY);
  return { x: moveX / length, y: moveY / length };
}
```

Replace `stepPlayer` and `tickTimers`:

```ts
export function stepPlayer(p: Player, input: InputFrame, solids: readonly AABB[], dt = C.STEP): StepEvents {
  const events: StepEvents = { jumped: false, wallJumped: false, dashed: false, landed: 0 };
  tickTimers(p, input, dt);
  if (tryStartDash(p, input, events) || p.dashTimer > 0) {
    updateDash(p, dt);
  } else {
    applyHorizontal(p, input, dt);
    applyGravity(p, input, dt);
  }
  tryJump(p, events);
  applyJumpCut(p, input);
  moveAndResolve(p, solids, dt, events);
  refillDash(p, input);
  return events;
}

function tickTimers(p: Player, input: InputFrame, dt: number): void {
  p.coyote = p.onGround ? C.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? C.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
  p.wallJumpLock = Math.max(0, p.wallJumpLock - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
}
```

In `tryJump`, add `p.dashTimer = 0;` next to `p.jumping = true;` at the end, so the tail reads:

```ts
  p.jumpBuffer = 0;
  p.coyote = 0;
  p.jumping = true;
  p.dashTimer = 0;
}
```

Add these functions below `applyJumpCut`:

```ts
function tryStartDash(p: Player, input: InputFrame, events: StepEvents): boolean {
  if (!input.dashPressed || p.dashTimer > 0) return false;
  if (p.onGround) {
    if (p.dashCooldown > 0) return false;
    p.dashCooldown = C.GROUND_DASH_COOLDOWN;
  } else {
    if (p.dashCharges <= 0) return false;
    p.dashCharges -= 1;
  }
  if (input.moveX !== 0) p.facing = input.moveX;
  const dir = aimDirection(input.moveX, input.moveY, p.facing);
  p.vx = dir.x * C.DASH_SPEED;
  p.vy = dir.y * C.DASH_SPEED;
  p.dashTimer = C.DASH_TIME;
  p.jumping = false;
  events.dashed = true;
  return true;
}

/** Holds dash velocity (no gravity) until the timer runs out, then bleeds speed. */
function updateDash(p: Player, dt: number): void {
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  if (p.dashTimer === 0) {
    p.vx *= C.DASH_END_KEEP;
    p.vy *= C.DASH_END_KEEP;
  }
}

function refillDash(p: Player, input: InputFrame): void {
  if (p.dashTimer > 0) return;
  const sliding = p.wallDir !== 0 && input.moveX === p.wallDir;
  if (p.onGround || sliding) p.dashCharges = C.AIR_DASH_CHARGES;
}
```

- [ ] **Step 4: Run all physics tests to verify they pass**

Run: `npx vitest run tests/physics`
Expected: PASS (collision, player-move, player-jump, player-wall and player-dash).

- [ ] **Step 5: Commit**

```bash
git add src/physics/player.ts tests/physics/player-dash.test.ts
git commit -m "feat: add 8-direction dash with air charge and ground cooldown"
```

---

### Task 11: Camera — easing follow, clamping, look-ahead, shake

**Files:**
- Create: `src/core/camera.ts`
- Test: `tests/core/camera.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { Camera, MAX_LOOK_AHEAD } from '../../src/core/camera';

const make = () => new Camera(960, 540, 2000, 2000);

describe('Camera', () => {
  it('snaps with the target centered horizontally and at 55% of the view height', () => {
    const cam = make();
    cam.snapTo(1000, 1000);
    expect(cam.x).toBe(520);
    expect(cam.y).toBeCloseTo(703, 6);
  });

  it('clamps to the world edges', () => {
    const cam = make();
    cam.snapTo(0, 0);
    expect([cam.x, cam.y]).toEqual([0, 0]);
    cam.snapTo(2000, 2000);
    expect([cam.x, cam.y]).toEqual([1040, 1460]);
  });

  it('never scrolls horizontally when the world is exactly one view wide', () => {
    const cam = new Camera(960, 540, 960, 2000);
    cam.snapTo(900, 1000);
    expect(cam.x).toBe(0);
  });

  it('eases toward the target instead of jumping', () => {
    const cam = make();
    cam.snapTo(1000, 1000);
    const startY = cam.y;
    cam.follow(1000, 600, 0, 1 / 120);
    expect(cam.y).toBeLessThan(startY);
    expect(cam.y).toBeGreaterThan(303);
    for (let i = 0; i < 240; i++) cam.follow(1000, 600, 0, 1 / 120);
    expect(cam.y).toBeCloseTo(303, 0);
  });

  it('looks ahead in the direction of vertical movement, up to a limit', () => {
    const cam = make();
    const still = cam.desired(1000, 1000, 0).y;
    expect(cam.desired(1000, 1000, 5000).y - still).toBeCloseTo(MAX_LOOK_AHEAD, 6);
    expect(cam.desired(1000, 1000, -5000).y - still).toBeCloseTo(-MAX_LOOK_AHEAD, 6);
  });

  it('shake offsets fade out over the duration', () => {
    const cam = make();
    cam.shake(10, 0.2);
    cam.updateShake(0.05, () => 1);
    expect(cam.offsetX).toBeCloseTo(7.5, 6);
    cam.updateShake(0.2, () => 1);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('a weaker shake does not override a stronger one in progress', () => {
    const cam = make();
    cam.shake(10, 0.2);
    cam.shake(2, 0.2);
    cam.updateShake(0, () => 1);
    expect(cam.offsetX).toBeCloseTo(10, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/camera.test.ts`
Expected: FAIL — cannot resolve `../../src/core/camera`.

- [ ] **Step 3: Write `src/core/camera.ts`**

```ts
export const CAMERA_STIFFNESS = 8;
export const TARGET_SCREEN_Y = 0.55;
export const LOOK_AHEAD_TIME = 0.12;
export const MAX_LOOK_AHEAD = 80;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export class Camera {
  /** Top-left corner of the view in world units. */
  x = 0;
  y = 0;
  /** Shake offset added at draw time only. */
  offsetX = 0;
  offsetY = 0;
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;

  constructor(
    readonly viewW: number,
    readonly viewH: number,
    public worldW: number,
    public worldH: number,
  ) {}

  /** Where the camera wants to be for a target center point and vertical speed. */
  desired(targetX: number, targetY: number, targetVy: number): { x: number; y: number } {
    const lookAhead = clamp(targetVy * LOOK_AHEAD_TIME, -MAX_LOOK_AHEAD, MAX_LOOK_AHEAD);
    return {
      x: clamp(targetX - this.viewW / 2, 0, Math.max(0, this.worldW - this.viewW)),
      y: clamp(targetY - this.viewH * TARGET_SCREEN_Y + lookAhead, 0, Math.max(0, this.worldH - this.viewH)),
    };
  }

  follow(targetX: number, targetY: number, targetVy: number, dt: number): void {
    const d = this.desired(targetX, targetY, targetVy);
    const k = 1 - Math.exp(-CAMERA_STIFFNESS * dt);
    this.x += (d.x - this.x) * k;
    this.y += (d.y - this.y) * k;
  }

  snapTo(targetX: number, targetY: number): void {
    const d = this.desired(targetX, targetY, 0);
    this.x = d.x;
    this.y = d.y;
  }

  shake(magnitude: number, duration: number): void {
    if (magnitude < this.currentMagnitude()) return;
    this.shakeMagnitude = magnitude;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  updateShake(dt: number, random: () => number = Math.random): void {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    const m = this.currentMagnitude();
    this.offsetX = m === 0 ? 0 : (random() * 2 - 1) * m;
    this.offsetY = m === 0 ? 0 : (random() * 2 - 1) * m;
  }

  private currentMagnitude(): number {
    return this.shakeTime > 0 ? this.shakeMagnitude * (this.shakeTime / this.shakeDuration) : 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/camera.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/camera.ts tests/core/camera.test.ts
git commit -m "feat: add easing camera with look-ahead and shake"
```

---

### Task 12: Effect state — particles, squash and stretch, afterimages

Pure simulation state for game feel; drawing comes in Task 14.

**Files:**
- Create: `src/render/effects.ts`
- Test: `tests/render/effects.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { MAX_FALL } from '../../src/core/constants';
import { Afterimages, Particles, Squash, squashScale } from '../../src/render/effects';

const DUST = { count: 6, speed: 100, color: '#fff', size: 3, life: 0.3 };

describe('Particles', () => {
  it('spawns a burst at the origin', () => {
    const ps = new Particles();
    ps.burst(10, 20, DUST);
    expect(ps.list).toHaveLength(6);
    expect(ps.list.every((p) => p.x === 10 && p.y === 20)).toBe(true);
  });

  it('removes particles when their life runs out', () => {
    const ps = new Particles();
    ps.burst(0, 0, DUST);
    ps.update(0.2);
    expect(ps.list).toHaveLength(6);
    ps.update(0.2);
    expect(ps.list).toHaveLength(0);
  });

  it('never holds more than max particles', () => {
    const ps = new Particles(5);
    ps.burst(0, 0, { ...DUST, count: 8 });
    expect(ps.list).toHaveLength(5);
  });

  it('aims bursts using angle and spread', () => {
    const ps = new Particles();
    ps.burst(0, 0, { ...DUST, count: 1, angle: 0, spread: 1 }, () => 0.5);
    expect(ps.list[0].vx).toBeCloseTo(70, 6);
    expect(ps.list[0].vy).toBeCloseTo(0, 6);
  });

  it('applies gravity', () => {
    const ps = new Particles();
    ps.burst(0, 0, { ...DUST, count: 1, angle: 0, spread: 0 }, () => 0.5);
    ps.update(0.1, 1000);
    expect(ps.list[0].vy).toBeGreaterThan(0);
  });
});

describe('squashScale', () => {
  it('is neutral for a gentle landing', () => {
    expect(squashScale(0)).toEqual({ sx: 1, sy: 1 });
  });

  it('is strongest at max fall speed and clamps beyond it', () => {
    expect(squashScale(MAX_FALL).sx).toBeCloseTo(1.35, 6);
    expect(squashScale(MAX_FALL).sy).toBeCloseTo(0.65, 6);
    expect(squashScale(MAX_FALL * 10)).toEqual(squashScale(MAX_FALL));
  });
});

describe('Squash', () => {
  it('springs back to neutral', () => {
    const s = new Squash();
    s.set(1.3, 0.7);
    for (let i = 0; i < 60; i++) s.update(1 / 60);
    expect(s.sx).toBeCloseTo(1, 3);
    expect(s.sy).toBeCloseTo(1, 3);
  });
});

describe('Afterimages', () => {
  it('fade out after their lifetime', () => {
    const a = new Afterimages(0.1);
    a.add(5, 5);
    a.update(0.05);
    expect(a.items).toHaveLength(1);
    a.update(0.06);
    expect(a.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/render/effects.test.ts`
Expected: FAIL — cannot resolve `../../src/render/effects`.

- [ ] **Step 3: Write `src/render/effects.ts`**

```ts
import { MAX_FALL } from '../core/constants';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface BurstOptions {
  count: number;
  speed: number;
  color: string;
  size: number;
  life: number;
  /** Center direction in radians (0 = right, -PI/2 = up). Default: up. */
  angle?: number;
  /** Total cone width in radians. Default: full circle. */
  spread?: number;
}

export class Particles {
  readonly list: Particle[] = [];

  constructor(private readonly max = 400) {}

  burst(x: number, y: number, o: BurstOptions, random: () => number = Math.random): void {
    for (let i = 0; i < o.count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const angle = (o.angle ?? -Math.PI / 2) + (random() - 0.5) * (o.spread ?? Math.PI * 2);
      const speed = o.speed * (0.4 + random() * 0.6);
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: o.life,
        maxLife: o.life,
        size: o.size,
        color: o.color,
      });
    }
  }

  update(dt: number, gravity = 0, drag = 3): void {
    const friction = Math.exp(-drag * dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += gravity * dt;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}

/** Landing squash: wider and flatter the harder the impact. */
export function squashScale(impactSpeed: number): { sx: number; sy: number } {
  const t = Math.min(Math.max(impactSpeed / MAX_FALL, 0), 1);
  return { sx: 1 + 0.35 * t, sy: 1 - 0.35 * t };
}

export class Squash {
  sx = 1;
  sy = 1;

  set(sx: number, sy: number): void {
    this.sx = sx;
    this.sy = sy;
  }

  update(dt: number, recover = 14): void {
    const k = 1 - Math.exp(-recover * dt);
    this.sx += (1 - this.sx) * k;
    this.sy += (1 - this.sy) * k;
  }
}

export class Afterimages {
  readonly items: { x: number; y: number; life: number }[] = [];

  constructor(readonly lifetime = 0.18) {}

  add(x: number, y: number): void {
    this.items.push({ x, y, life: this.lifetime });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].life -= dt;
      if (this.items[i].life <= 0) this.items.splice(i, 1);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/render/effects.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/effects.ts tests/render/effects.test.ts
git commit -m "feat: add particle, squash and afterimage effect state"
```

---

### Task 13: Test room geometry and validation

A single enclosed room (960 × 1620) that exercises every move: stepped platforms, a wall-jump shaft, a gap that needs a dash, an overhang for corner correction, and an upper route.

**Files:**
- Create: `src/stages/test-room.ts`
- Test: `tests/stages/test-room.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { MIN_SOLID_THICKNESS } from '../../src/core/constants';
import { overlaps } from '../../src/physics/aabb';
import { createPlayer, stepPlayer } from '../../src/physics/player';
import { TEST_ROOM } from '../../src/stages/test-room';
import { input } from '../helpers/input';

describe('TEST_ROOM', () => {
  it('keeps every solid inside the world bounds', () => {
    for (const s of TEST_ROOM.solids) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(TEST_ROOM.width);
      expect(s.y + s.h).toBeLessThanOrEqual(TEST_ROOM.height);
    }
  });

  it('never uses solids thinner than the anti-tunnelling minimum', () => {
    for (const s of TEST_ROOM.solids) {
      expect(Math.min(s.w, s.h)).toBeGreaterThanOrEqual(MIN_SOLID_THICKNESS);
    }
  });

  it('has no overlapping solids', () => {
    const { solids } = TEST_ROOM;
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        expect(overlaps(solids[i], solids[j]), `solids ${i} and ${j}`).toBe(false);
      }
    }
  });

  it('spawns the player in free space above ground they land on', () => {
    const p = createPlayer(TEST_ROOM.spawn.x, TEST_ROOM.spawn.y);
    expect(TEST_ROOM.solids.some((s) => overlaps(p, s))).toBe(false);
    for (let i = 0; i < 120; i++) stepPlayer(p, input(), TEST_ROOM.solids);
    expect(p.onGround).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stages/test-room.test.ts`
Expected: FAIL — cannot resolve `../../src/stages/test-room`.

- [ ] **Step 3: Write `src/stages/test-room.ts`**

```ts
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
    // Shell
    { x: 0, y: 1580, w: 960, h: 40 }, // floor
    { x: 0, y: 0, w: 24, h: 1580 }, // left wall
    { x: 936, y: 0, w: 24, h: 1580 }, // right wall

    // Warm-up steps
    { x: 24, y: 1460, w: 220, h: T },
    { x: 340, y: 1380, w: 160, h: T },
    { x: 600, y: 1300, w: 140, h: T },

    // Wall-jump shaft between the pillar and the right wall (enter under the pillar)
    { x: 820, y: 880, w: 24, h: 220 }, // pillar, bottom at 1100
    { x: 844, y: 1220, w: 92, h: T }, // shaft floor

    // Shaft exit, then a 240-unit gap that needs a dash
    { x: 560, y: 860, w: 200, h: T },
    { x: 200, y: 760, w: 120, h: T },

    // Overhang for corner correction, then the upper route
    { x: 120, y: 620, w: 100, h: T },
    { x: 40, y: 480, w: 180, h: T },
    { x: 360, y: 380, w: 160, h: T },
    { x: 640, y: 300, w: 200, h: T },
    { x: 380, y: 160, w: 200, h: T },
  ],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stages/test-room.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stages/test-room.ts tests/stages/test-room.test.ts
git commit -m "feat: add movement test room geometry"
```

---

### Task 14: Renderers — background, platforms, player, effects

Drawing only; no unit tests (spec §10). Style follows the approved mockup: flat, moody, a lit top edge on platforms, parallax layers, and a glowing cream cube with an eye and a scarf. The test room uses a mossy-ruins palette as a preview of Stage 1.

**Files:**
- Create: `src/render/room-draw.ts`, `src/render/player-draw.ts`, `src/render/effects-draw.ts`

- [ ] **Step 1: Write `src/render/room-draw.ts`**

```ts
import { VIEW_H, VIEW_W } from '../core/constants';
import type { AABB } from '../physics/aabb';

const COLORS = {
  skyTop: '#0e1815',
  skyBottom: '#223428',
  far: '#17241e',
  farWindow: 'rgba(170, 220, 140, 0.10)',
  mid: '#1c2c23',
  vine: '#2f4a35',
  body: '#2a3b30',
  bodyShade: '#223127',
  seam: '#344a3b',
  edge: '#bcd98c',
  moss: '#7ea55a',
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Calls `draw` for every tile of a w×h grid scrolled by (offX, offY) that touches the view. */
function tile(offX: number, offY: number, w: number, h: number, draw: (x: number, y: number) => void): void {
  const startX = -mod(offX, w) - w;
  const startY = -mod(offY, h) - h;
  for (let x = startX; x < VIEW_W + w; x += w) {
    for (let y = startY; y < VIEW_H + h; y += h) draw(x, y);
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  tile(camX * 0.25, camY * 0.25, 240, 360, (x, y) => drawRuin(ctx, x, y));
  tile(camX * 0.5, camY * 0.5, 320, 420, (x, y) => drawVines(ctx, x, y, t));
  drawSpores(ctx, camY, t);
}

function drawRuin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.far;
  ctx.fillRect(x + 20, y, 34, 360); // column
  ctx.fillRect(x + 12, y + 40, 50, 10); // capital
  ctx.fillRect(x + 54, y + 60, 186, 16); // lintel
  ctx.fillStyle = COLORS.farWindow;
  ctx.beginPath();
  ctx.roundRect(x + 130, y + 170, 22, 40, [11, 11, 0, 0]);
  ctx.fill();
}

function drawVines(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = COLORS.mid;
  ctx.fillRect(x + 140, y + 220, 44, 200); // broken pillar
  ctx.strokeStyle = COLORS.vine;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const baseX = x + 60 + k * 90;
    const sway = Math.sin(t * 0.8 + x * 0.01 + k);
    ctx.beginPath();
    ctx.moveTo(baseX, y);
    ctx.quadraticCurveTo(baseX + sway * 10, y + 60, baseX + sway * 4, y + 120 + k * 30);
    ctx.stroke();
  }
}

function drawSpores(ctx: CanvasRenderingContext2D, camY: number, t: number): void {
  for (let i = 0; i < 40; i++) {
    const x = ((i * 137.5) % VIEW_W) + Math.sin(t + i) * 6;
    const y = mod(i * 89 - t * 12 - camY * 0.8, VIEW_H);
    const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(200, 235, 160, ${a})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

export function drawSolids(ctx: CanvasRenderingContext2D, solids: readonly AABB[], camX: number, camY: number): void {
  for (const s of solids) {
    const sx = s.x - camX;
    const sy = s.y - camY;
    if (sx > VIEW_W || sx + s.w < 0 || sy > VIEW_H || sy + s.h < 0) continue;

    const isPlatform = s.h <= 40;
    if (isPlatform) {
      const fade = ctx.createLinearGradient(0, sy + s.h, 0, sy + s.h + 22);
      fade.addColorStop(0, 'rgba(42, 59, 48, 0.55)');
      fade.addColorStop(1, 'rgba(42, 59, 48, 0)');
      ctx.fillStyle = fade;
      ctx.fillRect(sx, sy + s.h, s.w, 22);
    }

    ctx.fillStyle = COLORS.body;
    ctx.fillRect(sx, sy, s.w, s.h);
    ctx.fillStyle = COLORS.bodyShade;
    ctx.fillRect(sx, sy + 6, s.w, s.h - 6);

    ctx.fillStyle = COLORS.seam;
    if (isPlatform) {
      for (let k = 36; k < s.w - 8; k += 40) ctx.fillRect(sx + k, sy + 6, 2, s.h - 6);
    } else {
      for (let k = 48; k < s.h; k += 48) ctx.fillRect(sx, sy + k, s.w, 2);
    }

    ctx.save();
    ctx.shadowColor = COLORS.edge;
    ctx.shadowBlur = 8;
    ctx.fillStyle = COLORS.edge;
    ctx.fillRect(sx, sy, s.w, 3);
    ctx.restore();

    ctx.fillStyle = COLORS.moss;
    for (let k = 4; k < s.w - 4; k += 14) {
      const h = 2 + (Math.floor(s.x + k) * 7) % 4;
      ctx.fillRect(sx + k, sy - h + 1, 6, h);
    }
  }
}
```

- [ ] **Step 2: Write `src/render/player-draw.ts`**

```ts
import type { Player } from '../physics/player';
import type { Squash } from './effects';

export type PlayerLook = Pick<
  Player,
  'x' | 'y' | 'w' | 'h' | 'facing' | 'vx' | 'vy' | 'dashCharges' | 'dashTimer' | 'onGround'
>;

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerLook,
  squash: Squash,
  camX: number,
  camY: number,
  t: number,
): void {
  // Dimmed when airborne with no dash left, so the player can read their charge.
  const tired = !p.onGround && p.dashCharges === 0 && p.dashTimer === 0;
  const w = p.w * squash.sx;
  const h = p.h * squash.sy;
  const cx = p.x + p.w / 2 - camX;
  const bottom = p.y + p.h - camY;
  const left = cx - w / 2;
  const top = bottom - h;

  // Scarf trails behind, pulled by velocity.
  const ax = cx - p.facing * (w / 2 - 3);
  const ay = top + h * 0.55;
  ctx.strokeStyle = '#e2596a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  for (let i = 1; i <= 5; i++) {
    ctx.lineTo(
      ax - p.facing * i * 5 - p.vx * 0.018 * i,
      ay + i * 1.2 - p.vy * 0.012 * i + Math.sin(t * 10 - i * 0.9) * 2,
    );
  }
  ctx.stroke();

  // Body with glow
  ctx.save();
  ctx.shadowColor = tired ? 'rgba(200, 180, 140, 0.35)' : 'rgba(255, 215, 140, 0.85)';
  ctx.shadowBlur = tired ? 8 : 20;
  ctx.fillStyle = tired ? '#b8a57f' : '#f3d9a0';
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 4);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = tired ? '#cbb994' : '#ffeec8';
  ctx.beginPath();
  ctx.roundRect(left, top, w, Math.max(4, h * 0.2), [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = tired ? '#a08e6a' : '#e0bf7f';
  ctx.fillRect(left, bottom - 4, w, 4);

  // Eye looks where you're going and blinks every few seconds.
  const eyeH = t % 3.4 < 0.12 ? 1.5 : 7;
  const ex = cx + p.facing * w * 0.18 - 2.5;
  const ey = top + h * 0.32 + Math.max(-2, Math.min(2, p.vy * 0.004)) + (7 - eyeH) / 2;
  ctx.fillStyle = '#1b1418';
  ctx.fillRect(ex, ey, 5, eyeH);
}
```

- [ ] **Step 3: Write `src/render/effects-draw.ts`**

```ts
import type { Afterimages, Particles } from './effects';

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particles, camX: number, camY: number): void {
  for (const p of particles.list) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camX - p.size / 2, p.y - camY - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawAfterimages(
  ctx: CanvasRenderingContext2D,
  afterimages: Afterimages,
  w: number,
  h: number,
  camX: number,
  camY: number,
): void {
  for (const a of afterimages.items) {
    ctx.fillStyle = `rgba(255, 228, 170, ${(a.life / afterimages.lifetime) * 0.4})`;
    ctx.beginPath();
    ctx.roundRect(a.x - camX, a.y - camY, w, h, 4);
    ctx.fill();
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 5: Commit**

```bash
git add src/render/room-draw.ts src/render/player-draw.ts src/render/effects-draw.ts
git commit -m "feat: add room, player and effect renderers"
```

---

### Task 15: Debug overlay

Backquote (`` ` ``) toggles hitboxes and a state readout; T toggles quarter-speed slow motion.

**Files:**
- Create: `src/debug/overlay.ts`
- Test: `tests/debug/overlay.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { DebugOverlay, SLOW_MOTION_SCALE } from '../../src/debug/overlay';

describe('DebugOverlay', () => {
  it('toggles visibility with Backquote and consumes the key', () => {
    const d = new DebugOverlay();
    expect(d.handleKey('Backquote')).toBe(true);
    expect(d.visible).toBe(true);
    d.handleKey('Backquote');
    expect(d.visible).toBe(false);
  });

  it('toggles slow motion with T', () => {
    const d = new DebugOverlay();
    expect(d.timeScale).toBe(1);
    d.handleKey('KeyT');
    expect(d.timeScale).toBe(SLOW_MOTION_SCALE);
  });

  it('does not consume other keys', () => {
    expect(new DebugOverlay().handleKey('Space')).toBe(false);
  });

  it('counts frames in the last second', () => {
    const d = new DebugOverlay();
    d.recordFrame(0);
    d.recordFrame(500);
    d.recordFrame(999);
    expect(d.fps).toBe(3);
    d.recordFrame(1500);
    expect(d.fps).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/debug/overlay.test.ts`
Expected: FAIL — cannot resolve `../../src/debug/overlay`.

- [ ] **Step 3: Write `src/debug/overlay.ts`**

```ts
import type { AABB } from '../physics/aabb';
import type { Player } from '../physics/player';

export const SLOW_MOTION_SCALE = 0.25;

export class DebugOverlay {
  visible = false;
  slowMotion = false;
  private frameTimes: number[] = [];

  /** Returns true if the key was a debug key and should not reach gameplay input. */
  handleKey(code: string): boolean {
    if (code === 'Backquote') {
      this.visible = !this.visible;
      return true;
    }
    if (code === 'KeyT') {
      this.slowMotion = !this.slowMotion;
      return true;
    }
    return false;
  }

  get timeScale(): number {
    return this.slowMotion ? SLOW_MOTION_SCALE : 1;
  }

  recordFrame(nowMs: number): void {
    this.frameTimes.push(nowMs);
    while (this.frameTimes.length > 0 && nowMs - this.frameTimes[0] >= 1000) this.frameTimes.shift();
  }

  get fps(): number {
    return this.frameTimes.length;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    solids: readonly AABB[],
    camX: number,
    camY: number,
    stepsThisFrame: number,
  ): void {
    if (!this.visible) return;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.6)';
    for (const s of solids) ctx.strokeRect(s.x - camX + 0.5, s.y - camY + 0.5, s.w - 1, s.h - 1);
    ctx.strokeStyle = '#ff4d6d';
    ctx.strokeRect(player.x - camX + 0.5, player.y - camY + 0.5, player.w - 1, player.h - 1);

    const lines = [
      `fps ${this.fps}  steps ${stepsThisFrame}${this.slowMotion ? '  SLOW-MO' : ''}`,
      `pos ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `vel ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)}`,
      `ground ${player.onGround}  wall ${player.wallDir}`,
      `dash ${player.dashCharges}  timer ${player.dashTimer.toFixed(2)}  cd ${player.dashCooldown.toFixed(2)}`,
      `coyote ${player.coyote.toFixed(2)}  buffer ${player.jumpBuffer.toFixed(2)}`,
    ];
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(8, 8, 320, 12 + lines.length * 16);
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, 16, 14 + i * 16));
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/debug/overlay.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/debug/overlay.ts tests/debug/overlay.test.ts
git commit -m "feat: add debug overlay with hitboxes, readout and slow motion"
```

---

### Task 16: Wire it all together in `main.ts`

**Files:**
- Modify: `src/main.ts` (replace the placeholder entirely)

- [ ] **Step 1: Replace `src/main.ts`**

```ts
import { Camera } from './core/camera';
import { MAX_FRAME_DT, STEP, VIEW_H, VIEW_W } from './core/constants';
import { type InputFrame, InputTracker, readPad, withoutPresses } from './core/input';
import { FixedStep } from './core/loop';
import { DebugOverlay } from './debug/overlay';
import { createPlayer, type StepEvents, stepPlayer } from './physics/player';
import { Afterimages, Particles, Squash, squashScale } from './render/effects';
import { drawAfterimages, drawParticles } from './render/effects-draw';
import { drawPlayer } from './render/player-draw';
import { drawBackground, drawSolids } from './render/room-draw';
import { TEST_ROOM } from './stages/test-room';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Fit the 960×540 logical view into the window, crisp on high-DPI screens.
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  canvas.width = Math.round(VIEW_W * scale * dpr);
  canvas.height = Math.round(VIEW_H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

const room = TEST_ROOM;
const player = createPlayer(room.spawn.x, room.spawn.y);
const camera = new Camera(VIEW_W, VIEW_H, room.width, room.height);
const loop = new FixedStep(STEP, MAX_FRAME_DT);
const input = new InputTracker();
const debug = new DebugOverlay();
const particles = new Particles();
const squash = new Squash();
const afterimages = new Afterimages();

let prevX = player.x;
let prevY = player.y;
let time = 0;
let lastMs = 0;
let stepsThisFrame = 0;

const DUST = '#cfe3a8';
const SPARK = '#ffe6b0';

function respawn(): void {
  Object.assign(player, createPlayer(room.spawn.x, room.spawn.y));
  prevX = player.x;
  prevY = player.y;
  camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
}

window.addEventListener('keydown', (e) => {
  if (debug.handleKey(e.code)) return;
  if (e.code === 'KeyR') {
    respawn();
    return;
  }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  input.keyDown(e.code, e.repeat);
});
window.addEventListener('keyup', (e) => {
  input.keyUp(e.code);
  // macOS drops keyup for other keys while Cmd is held; release everything so nothing sticks.
  if (e.code.startsWith('Meta')) input.releaseAll();
});
window.addEventListener('blur', () => input.releaseAll());
document.addEventListener('visibilitychange', () => {
  lastMs = 0; // avoid a huge catch-up frame when the tab comes back
});

function onEvents(e: StepEvents): void {
  const footX = player.x + player.w / 2;
  const footY = player.y + player.h;
  if (e.jumped) {
    squash.set(0.75, 1.3);
    particles.burst(footX, footY, { count: 8, speed: 120, color: DUST, size: 3, life: 0.35, spread: Math.PI });
  }
  if (e.wallJumped) {
    squash.set(0.8, 1.25);
    const wallX = player.vx > 0 ? player.x : player.x + player.w;
    const away = player.vx > 0 ? 0 : Math.PI;
    particles.burst(wallX, player.y + player.h / 2, {
      count: 8, speed: 140, color: DUST, size: 3, life: 0.35, angle: away, spread: Math.PI * 0.8,
    });
  }
  if (e.dashed) {
    camera.shake(4, 0.12);
    particles.burst(footX, player.y + player.h / 2, { count: 12, speed: 220, color: SPARK, size: 2.5, life: 0.3 });
  }
  if (e.landed > 250) {
    const s = squashScale(e.landed);
    squash.set(s.sx, s.sy);
    particles.burst(footX, footY, {
      count: Math.round(e.landed / 80), speed: e.landed * 0.25, color: DUST, size: 3, life: 0.4, spread: Math.PI * 0.9,
    });
    if (e.landed > 1000) camera.shake(3, 0.1);
  }
}

function update(frameDt: number): void {
  const dt = frameDt * debug.timeScale;
  stepsThisFrame = loop.advance(dt);
  if (stepsThisFrame > 0) {
    // Sample only when physics will run, so a press is never consumed by a zero-step frame.
    const pad = readPad(navigator.getGamepads?.()?.find((g) => g !== null) ?? null);
    const sampled: InputFrame = input.sample(pad);
    for (let i = 0; i < stepsThisFrame; i++) {
      prevX = player.x;
      prevY = player.y;
      const facingBefore = player.facing;
      onEvents(stepPlayer(player, i === 0 ? sampled : withoutPresses(sampled), room.solids));
      if (player.onGround && player.facing !== facingBefore && Math.abs(player.vx) > 150) {
        // Turn-around skid puff
        particles.burst(player.x + player.w / 2, player.y + player.h, {
          count: 5, speed: 90, color: DUST, size: 2.5, life: 0.3, angle: player.facing === 1 ? Math.PI : 0, spread: 1.2,
        });
      }
      if (player.dashTimer > 0 && i % 2 === 0) afterimages.add(player.x, player.y);
      time += STEP;
    }
  }

  const rx = prevX + (player.x - prevX) * loop.alpha;
  const ry = prevY + (player.y - prevY) * loop.alpha;
  camera.follow(rx + player.w / 2, ry + player.h / 2, player.vy, dt);
  camera.updateShake(dt);
  particles.update(dt, 400);
  squash.update(dt);
  afterimages.update(dt);
  render(rx, ry);
}

function render(rx: number, ry: number): void {
  const camX = camera.x + camera.offsetX;
  const camY = camera.y + camera.offsetY;
  drawBackground(ctx, camX, camY, time);
  drawSolids(ctx, room.solids, camX, camY);
  drawAfterimages(ctx, afterimages, player.w, player.h, camX, camY);
  drawPlayer(ctx, { ...player, x: rx, y: ry }, squash, camX, camY, time);
  drawParticles(ctx, particles, camX, camY);
  debug.draw(ctx, player, room.solids, camX, camY, stepsThisFrame);
}

function frame(nowMs: number): void {
  const frameDt = lastMs === 0 ? 0 : (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  debug.recordFrame(nowMs);
  update(frameDt);
  requestAnimationFrame(frame);
}

camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
requestAnimationFrame(frame);
```

- [ ] **Step 2: Run the full test suite, typecheck and build**

Run: `npm test`
Expected: PASS — every test file (constants, collision, loop, input, player-move, player-jump, player-wall, player-dash, camera, effects, test-room, overlay).

Run: `npm run build`
Expected: exits 0; `dist/` is created.

- [ ] **Step 3: Play-test in the browser**

Run: `npm run dev` and open the printed URL (default `http://localhost:5173`).

Check each item; if one fails, fix it before committing (for physics bugs, add a failing test first):

- [ ] The room renders: gradient sky, two parallax layers that scroll at different speeds, drifting spores, platforms with a glowing top edge and moss.
- [ ] Arrow keys / WASD run; starting and stopping feel snappy, not floaty.
- [ ] Tapping Space gives a small hop; holding it gives a full jump. The cube stretches on takeoff and squashes on landing.
- [ ] Running off a ledge and pressing jump a moment late still jumps (coyote time).
- [ ] Pressing jump just before landing jumps immediately on touchdown (jump buffer).
- [ ] Holding toward a wall while falling slows you to a slide; jumping pushes you off it. You can climb the right-hand shaft by wall-jumping between the pillar and the wall.
- [ ] Shift / X dashes in all 8 directions with afterimages, sparks and a small shake. With no direction held, it dashes the way the cube faces.
- [ ] Only one dash in the air; the cube dims until you land or wall-slide.
- [ ] The 240-unit gap between the shaft exit and the next platform needs a dash.
- [ ] Jumping up so your head just clips the edge of the overhang slides you around it.
- [ ] The camera follows smoothly, shows more below when falling fast, and never shows outside the room.
- [ ] `` ` `` shows hitboxes, FPS and state; T toggles slow motion; R respawns.
- [ ] Resizing the window keeps the 16:9 view centered and crisp.
- [ ] A connected gamepad works (stick/d-pad move, A jumps, X or RB dashes).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up playable movement test room"
```

---

## Out of scope for this plan (later milestones)

Each gets its own plan, per spec §11:
- **M2:** Stage 1 (Moss Ruins): stage/section data format, entity interface and activation, checkpoints, Normal and Hard mode rules, HUD, stage banner, debug noclip and stage/section warp.
- **M3:** Menus, save data, settings (rebinding, shake toggle, reduced effects), Web Audio sound.
- **M4:** Stages 2–10 with their signature entities.
- **M5:** Difficulty balancing, performance pass, win screen and records.
