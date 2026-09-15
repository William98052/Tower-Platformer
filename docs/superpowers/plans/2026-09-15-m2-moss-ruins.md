# Milestone 2 — Moss Ruins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the movement test room with a complete, hand-built seven-section Moss Ruins stage featuring Stage 1 surfaces and entities, checkpoints, Normal and Hard rules, HUD, stage banner, first-time move prompts, and debug navigation.

**Architecture:** Keep `stepPlayer` as the movement core. A data-only `StageDef` is validated and stacked into a `World`, while small pure modules own entity activation, mode rules, run statistics, prompts, and banner timing. `main.ts` orchestrates those modules and Canvas renderers without placing game rules in the browser loop.

**Tech Stack:** TypeScript 5.9, Vite 8, Vitest 5, HTML5 Canvas 2D. Node 25.

**Spec:** `docs/superpowers/specs/2026-09-14-tower-platformer-design.md` (§4, §5 Stage 1, §6, §7, §8, §10, §11 step 2).

## Global Constraints

- Physics remains fixed at 120 Hz with a 0.25 s frame clamp.
- Logical view remains 960 × 540 units with y increasing downward.
- Stage 1 contains exactly seven fixed, hand-built sections; no randomizer.
- Normal uses section checkpoints and respawns after hazards or falling 540 units below the checkpoint.
- Hard has no checkpoints; hazards apply 400 u/s horizontal knockback, 300 u/s upward knockback, 0.4 s stun, and 0.6 s invulnerability.
- Logic changes follow failing-test-first TDD; Canvas rendering is verified visually.
- Stamina, saving, menus, settings, sound, later stages, and the win screen remain deferred.

---

### Task 1: Stage data contracts, stacking, validation, and activation

**Files:**
- Create: `src/stages/types.ts`
- Create: `src/stages/world.ts`
- Test: `tests/stages/world.test.ts`

**Interfaces:**
- Produces: `SurfaceType`, `SolidDef`, `EntityDef`, `SectionDef`, `ThemeDef`, `StageDef`, `WorldSection`, `World`, `buildWorld(stage)`, `validateStage(stage)`, `activeSections(world, cameraY, viewHeight)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { activeSections, buildWorld, validateStage } from '../../src/stages/world';
import type { StageDef } from '../../src/stages/types';

const stage: StageDef = {
  id: 1, name: 'Test', theme: { skyTop: '#000', skyBottom: '#111', platform: '#222', edge: '#fff', accent: '#0f0' },
  sections: [0, 1, 2].map((id) => ({ id, height: 600, checkpoint: { x: 40, y: 540 }, solids: [{ x: 0, y: 580, w: 960, h: 20, surface: 'normal' }], entities: [] })),
};

describe('buildWorld', () => {
  it('stacks local sections bottom to top in y-down world space', () => {
    const world = buildWorld(stage);
    expect(world.height).toBe(1800);
    expect(world.sections.map((s) => s.top)).toEqual([1200, 600, 0]);
    expect(world.sections[1].checkpoint).toEqual({ x: 40, y: 1140 });
  });
});

describe('validateStage', () => {
  it('accepts a valid stage and rejects invalid checkpoints and thin solids', () => {
    expect(validateStage(stage)).toEqual([]);
    const broken = structuredClone(stage);
    broken.sections[0].checkpoint.y = 700;
    broken.sections[1].solids[0].h = 4;
    expect(validateStage(broken)).toEqual(expect.arrayContaining([expect.stringContaining('checkpoint'), expect.stringContaining('12 units')]));
  });
});

describe('activeSections', () => {
  it('includes visible sections plus one neighbour on each side', () => {
    const world = buildWorld(stage);
    expect(activeSections(world, 630, 540).map((s) => s.id)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run `npx vitest run tests/stages/world.test.ts` and verify module-resolution failure.**

- [ ] **Step 3: Implement the contracts and world builder**

```ts
export type SurfaceType = 'normal' | 'oneWay' | 'vine' | 'bouncy' | 'slopeUp' | 'slopeDown';
export interface Point { x: number; y: number }
export interface SolidDef { x: number; y: number; w: number; h: number; surface: SurfaceType }
export type EntityDef = { type: 'mushroom'; x: number; y: number; w: number; h: number; launch: number }
  | { type: 'prompt'; x: number; y: number; w: number; h: number; prompt: 'jump' | 'wallJump' | 'dash' };
export interface SectionDef { id: number; height: number; checkpoint: Point; solids: SolidDef[]; entities: EntityDef[] }
export interface ThemeDef { skyTop: string; skyBottom: string; platform: string; edge: string; accent: string }
export interface StageDef { id: number; name: string; theme: ThemeDef; sections: SectionDef[] }
```

`buildWorld` computes each section top as `totalHeight - cumulativeHeight`, translates checkpoints, solids, and entities once, and returns a flat collision list plus section bounds. `activeSections` selects camera-overlapping section indices and expands the minimum/maximum by one. `validateStage` checks seven sections for production stages, positive heights, checkpoints inside local bounds, integer solids at least 12 units thick, and entity-specific ranges (`launch` 700–1300).

- [ ] **Step 4: Run the test and `npm run typecheck`; expect PASS.**
- [ ] **Step 5: Commit with `feat: add stacked stage data model`.**

---

### Task 2: Surface-aware collision and Stage 1 surface behavior

**Files:**
- Modify: `src/physics/collision.ts`
- Modify: `src/physics/player.ts`
- Modify: `src/core/constants.ts`
- Test: `tests/physics/surfaces.test.ts`

**Interfaces:**
- Consumes: `SolidDef`, `SurfaceType`.
- Produces: `collisionSolidsFor(player, solids, dy)`, `applySurfaceEffects(player, solids, input)`; `stepPlayer` accepts `readonly SolidDef[]` while remaining structurally compatible with existing AABBs.

- [ ] **Step 1: Write failing tests proving:** one-way platforms stop a descending player but not a rising player; vine contact caps downward speed while holding toward it; bouncy surfaces launch at `BOUNCE_VELOCITY`; each slope returns a floor height that changes linearly across its width.
- [ ] **Step 2: Run `npx vitest run tests/physics/surfaces.test.ts`; expect missing exports.**
- [ ] **Step 3: Implement** `surfaceAtX(solid, playerCenterX)` and filter one-way solids unless the player's previous bottom is at or above the platform top and `dy >= 0`. Treat vine rectangles as wall contacts, bouncy rectangles as normal collision followed by `vy = -BOUNCE_VELOCITY`, and resolve slopes by placing the player's bottom on the sampled ramp height only while descending.
- [ ] **Step 4: Run all physics tests; expect the existing movement suite plus new surface tests to pass.**
- [ ] **Step 5: Commit with `feat: add Moss Ruins surface physics`.**

---

### Task 3: Entities, activation, and mushroom launch

**Files:**
- Create: `src/entities/entity.ts`
- Create: `src/entities/mushroom.ts`
- Create: `src/entities/factory.ts`
- Test: `tests/entities/entities.test.ts`

**Interfaces:**
- Produces: `CollisionResult = { kind: 'none' } | { kind: 'launch'; velocityY: number } | { kind: 'prompt'; id: PromptId }`; `Entity` with `bounds`, `update`, `draw`, `collide`, `reset`; `createEntities(section)`.

- [ ] **Step 1: Write failing tests** that a mushroom launches only when the player overlaps its cap while descending, that `reset()` restores its compression, and that prompt triggers return their ID without becoming solid.
- [ ] **Step 2: Run `npx vitest run tests/entities/entities.test.ts`; expect missing modules.**
- [ ] **Step 3: Implement a periodic mushroom squash animation from global `t`, collision using AABB overlap, and stateless prompt trigger entities.**
- [ ] **Step 4: Run the entity and world suites; expect PASS.**
- [ ] **Step 5: Commit with `feat: add activated Moss Ruins entities`.**

---

### Task 4: Normal and Hard run rules

**Files:**
- Create: `src/modes/run-state.ts`
- Create: `src/modes/rules.ts`
- Test: `tests/modes/rules.test.ts`

**Interfaces:**
- Produces: `Mode = 'normal' | 'hard'`; `RunState` containing checkpoint, falls, elapsed, bestY, peakSinceLanding, stun, invulnerability; `createRunState`; `stepRunTimers`; `activateCheckpoint`; `shouldRespawnForFall`; `hitHazard`; `recordLanding`.

- [ ] **Step 1: Write failing tests** for Normal checkpoint activation and 540-unit fall respawn, Normal hazard respawn, Hard hazard knockback/stun/invulnerability, ignored repeated Hard hits during invulnerability, timer advancement, best-height tracking, and one fall counted after a 400-unit descent.
- [ ] **Step 2: Run `npx vitest run tests/modes/rules.test.ts`; expect missing modules.**
- [ ] **Step 3: Implement pure transitions.** `hitHazard` returns `{ respawn: true }` in Normal; in Hard it mutates velocity away from the hazard center, sets `vy = -300`, `stun = 0.4`, `invulnerability = 0.6`, and increments falls once. `recordLanding` compares landing y against `peakSinceLanding + 400` before resetting the peak.
- [ ] **Step 4: Run the mode suite; expect PASS.**
- [ ] **Step 5: Commit with `feat: add Normal and Hard run rules`.**

---

### Task 5: First-time prompts and stage banner state

**Files:**
- Create: `src/ui/prompts.ts`
- Create: `src/ui/banner.ts`
- Test: `tests/ui/prompts.test.ts`
- Test: `tests/ui/banner.test.ts`

**Interfaces:**
- Produces: `PromptId`, `PromptState`, `showPrompt`, `completePromptsFromEvents`, `promptCopy`; `StageBanner` with `enter`, `update`, `offsetX`, `visible`.

- [ ] **Step 1: Write failing tests** proving a prompt shows once, completes on the matching movement event, cannot reappear during the run, and maps to exact copy: `Jump — Space / C`, `Wall jump — Hold toward wall + Space / C`, `Dash — Shift / X`. Test banner re-entry, 0.35 s slide-in, 2.5 s hold, 0.35 s slide-out, and hidden end state.
- [ ] **Step 2: Run both UI tests; expect missing modules.**
- [ ] **Step 3: Implement pure prompt and banner state machines with eased offsets.**
- [ ] **Step 4: Run the UI suites; expect PASS.**
- [ ] **Step 5: Commit with `feat: add move prompts and stage banner state`.**

---

### Task 6: Hand-built Moss Ruins stage

**Files:**
- Create: `src/stages/stage01-moss.ts`
- Test: `tests/stages/stage01-moss.test.ts`

**Interfaces:**
- Produces: `STAGE_01_MOSS: StageDef` with seven 640–760-unit sections.

- [ ] **Step 1: Write failing tests** for exactly seven sections, valid data, at least one signature mechanic per section, all checkpoints clear of solids, a continuous shell, integer coordinates, and escalating route bounds. Add reachability envelopes: ordinary vertical gaps ≤170, dash gaps ≤290, and wall-jump shafts 70–150 units wide.
- [ ] **Step 2: Run `npx vitest run tests/stages/stage01-moss.test.ts`; expect missing module.**
- [ ] **Step 3: Author these routes:**
  1. broken stair ascent teaching jump, with safe mushroom introduction;
  2. two-wall vine shaft teaching wall jump;
  3. one-way canopy switchbacks;
  4. slope-and-mushroom zigzag;
  5. first required horizontal dash gap with a safe catch floor;
  6. combined vine shaft, one-way landings, and diagonal dash;
  7. finale chaining mushroom launch, wall jump, slope, and dash to the exit platform.
- [ ] **Step 4: Run the stage tests and typecheck; expect PASS.**
- [ ] **Step 5: Commit with `feat: build all seven Moss Ruins sections`.**

---

### Task 7: Moss Ruins rendering, HUD, prompts, and banner

**Files:**
- Modify: `src/render/room-draw.ts`
- Create: `src/render/entity-draw.ts`
- Create: `src/ui/hud.ts`
- Create: `src/ui/overlay-draw.ts`
- Test: `tests/render/room-draw.test.ts`
- Test: `tests/ui/hud.test.ts`

**Interfaces:**
- Produces: `formatTime(seconds)`, `progressRatio(playerY, worldHeight)`, and Canvas draw functions for world surfaces, checkpoint flags, entities, HUD, prompt cards, and banner.

- [ ] **Step 1: Write failing pure tests** for timer formatting (`0 → 00:00.000`, `65.432 → 01:05.432`), progress clamping, and deterministic moss detail. Extend room-draw tests for every surface palette lookup.
- [ ] **Step 2: Run the render/UI tests; expect missing exports.**
- [ ] **Step 3: Implement rendering** with three Moss Ruins parallax layers, surface-specific readable decoration, glowing checkpoint flags, animated mushrooms, a left tower bar with stage tick/player dot, timer/falls top-right, stage name bottom-left, centered prompt card, and side-sliding banner.
- [ ] **Step 4: Run render/UI tests and typecheck; expect PASS.**
- [ ] **Step 5: Commit with `feat: render Moss Ruins and gameplay HUD`.**

---

### Task 8: Debug noclip, mode toggle, and section warp

**Files:**
- Modify: `src/debug/overlay.ts`
- Test: `tests/debug/overlay.test.ts`

**Interfaces:**
- Produces: `DebugCommand = { type: 'toggleNoclip' } | { type: 'toggleMode' } | { type: 'warp'; delta: -1 | 1 }`; `takeCommand()`.

- [ ] **Step 1: Add failing tests** for `N` noclip, `M` mode toggle, `[` previous section, `]` next section, edge-triggered command consumption, and overlay labels for mode/section/noclip.
- [ ] **Step 2: Run `npx vitest run tests/debug/overlay.test.ts`; expect failures.**
- [ ] **Step 3: Implement command queueing without changing Backquote or T behavior.**
- [ ] **Step 4: Run debug and input suites; expect PASS.**
- [ ] **Step 5: Commit with `feat: add Milestone 2 debug navigation`.**

---

### Task 9: Game orchestration and playable integration

**Files:**
- Create: `src/game/game.ts`
- Modify: `src/main.ts`
- Test: `tests/game/game.test.ts`

**Interfaces:**
- Produces: `Game` owning `world`, `player`, `run`, active entities, prompt state, banner, and methods `step(input)`, `respawn()`, `warp(section)`, `toggleMode()`, `toggleNoclip()`.

- [ ] **Step 1: Write failing integration tests** for spawning at section 1, touching checkpoints in Normal, ignoring checkpoints in Hard, Normal fall respawn, Hard hazard response, entity activation limited to camera ±1 section, mushroom launch, prompt completion from `StepEvents`, section warp, and mode toggle reset.
- [ ] **Step 2: Run `npx vitest run tests/game/game.test.ts`; expect missing module.**
- [ ] **Step 3: Implement `Game`** and reduce `main.ts` to DOM input, fixed-step invocation, camera/effects event handling, debug command dispatch, interpolation, and ordered world/UI drawing. While stunned, call `stepPlayer` with empty input; while noclip is enabled, move directly at 600 u/s and skip collisions.
- [ ] **Step 4: Run the integration test, full suite, typecheck, and build; expect PASS.**
- [ ] **Step 5: Commit with `feat: integrate playable Moss Ruins milestone`.**

---

### Task 10: Visual playtest and milestone documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-09-15-m2-moss-ruins.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run `npm run dev` and play from section 1 through section 7 in Normal, checking each checkpoint, prompt, HUD element, and stage banner.**
- [ ] **Step 2: Warp through every section in Hard and verify hazards knock back rather than respawn, catches are sensible, and no section is soft-locked.**
- [ ] **Step 3: Check 960×540 and a high-DPI resized window, plus the debug overlay, noclip, warp, and slow motion.**
- [ ] **Step 4: Run `npm test`, `npm run typecheck`, and `npm run build` from a clean process; record exact totals in `HANDOFF.md`.**
- [ ] **Step 5: Mark completed plan checkboxes, update the handoff with Milestone 2 status and controls, then commit with `docs: record Moss Ruins milestone completion`.**

---

## Self-review

- Spec coverage: stage/section data, activation, Stage 1 surfaces/entities, seven sections, checkpoints, both modes, HUD, banner, move prompts, noclip, warp, art, and tests are each assigned to a task.
- Deferred by design: persistence of prompt completion and checkpoints belongs to Milestone 3 save data; prompt state is kept for the current run in Milestone 2.
- Type consistency: all later tasks consume the contracts introduced in Tasks 1, 3, 4, and 5.
- No randomizer, menus, audio, later stages, or unrelated refactors are included.
