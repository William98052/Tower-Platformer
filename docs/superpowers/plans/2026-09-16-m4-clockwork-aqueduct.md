# Clockwork Hall and Sunken Aqueduct Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the game into one continuous three-stage tower and add complete seven-section Clockwork Hall and Sunken Aqueduct stages with deterministic machinery, water movement, persistent saves, themed presentation, and verified routes.

**Architecture:** Introduce `TowerDef` and flatten its ordered stages into globally indexed world sections carrying stage metadata. Expand entities into explicit dynamic-solid, push/hazard, and field-volume interactions, then build Clockwork and Aqueduct mechanics on those reusable contracts. Store stage-relative run positions in version 2 saves so future stages can be added above without invalidating runs.

**Tech Stack:** TypeScript 5.9, Canvas 2D, Web Audio API, Vite 8, Vitest 5, browser localStorage.

**Spec:** `docs/superpowers/specs/2026-09-16-m4-clockwork-aqueduct-design.md`

## Global Constraints

- The playable view remains exactly 960 × 540 logical units.
- The tower is continuous: no portals, loading screens, or stage selection between Moss, Clockwork, and Aqueduct.
- Each stage contains exactly seven fixed, hand-built sections ordered bottom-to-top.
- Every section starts on a broad flat checkpoint runway, has one classified main route, and contains no decorative collision platforms or dead ends.
- Normal saves at each checkpoint; Hard has no checkpoints and permits continuous falls through all built stages.
- Periodic entities derive state from run elapsed time; leaving the activation range cannot desynchronize them.
- Only camera-visible sections ±1 are updated, drawn, and collided.
- Reduced Effects changes presentation only, never collision or timing.
- No external runtime dependency or audio file is added.
- All gameplay logic uses red-green-refactor TDD; rendering and final layouts receive browser QA.
- Each verified task is committed and pushed directly to `main` with `Co-Authored-By: OpenAI Codex <noreply@openai.com>`.

---

### Task 1: Continuous tower data and global section identity

**Files:**
- Modify: `src/stages/types.ts`
- Modify: `src/stages/world.ts`
- Create: `src/stages/tower.ts`
- Modify: `tests/stages/world.test.ts`
- Create: `tests/stages/tower.test.ts`

**Interfaces:**
- Consumes: existing `StageDef`, `SectionDef`, `SolidDef`, and `EntityDef`.
- Produces: `TowerDef`, `TOWER`, `buildWorld(tower: TowerDef): World`, `stageAtSection(world, globalIndex)`, and globally unique `WorldSection.globalIndex`.

- [ ] **Step 1: Write failing stacking and identity tests**

```ts
const tower: TowerDef = { stages: [stage(1, 2), stage(2, 2)] };
const world = buildWorld(tower);
expect(world.sections.map((s) => [s.globalIndex, s.stageId, s.localSection]))
  .toEqual([[0, 1, 0], [1, 1, 1], [2, 2, 0], [3, 2, 1]]);
expect(world.sections[0].bottom).toBe(world.height);
expect(world.sections[3].top).toBe(0);
expect(stageAtSection(world, 2).id).toBe(2);
```

Also assert `validateTower` rejects duplicate stage IDs, unordered IDs, a stage without seven sections, and duplicate local section IDs.

- [ ] **Step 2: Run the new tests to verify RED**

Run: `npx vitest run tests/stages/world.test.ts tests/stages/tower.test.ts`

Expected: FAIL because `TowerDef`, `buildWorld(TowerDef)`, and global stage metadata do not exist.

- [ ] **Step 3: Implement tower types and deterministic stacking**

```ts
export interface TowerDef { stages: StageDef[] }

export interface WorldSection {
  globalIndex: number;
  stageId: number;
  stageName: string;
  localSection: number;
  theme: ThemeDef;
  top: number;
  bottom: number;
  height: number;
  checkpoint: Point;
  solids: SolidDef[];
  entities: EntityDef[];
}

export interface World {
  width: number;
  height: number;
  tower: TowerDef;
  sections: WorldSection[];
  solids: SolidDef[];
}
```

Flatten stages in declared order, then translate from a bottom-origin accumulated height into the existing top-origin canvas coordinates. Assign `globalIndex` from the flattened array index and preserve `localSection` from `SectionDef.id`.

Create `TOWER` with `[STAGE_01_MOSS]` initially so the game stays playable before Stages 2 and 3 land.

- [ ] **Step 4: Preserve active-section behavior and validate GREEN**

Update `activeSections` to slice by array position, not local IDs. Run:

```bash
npx vitest run tests/stages/world.test.ts tests/stages/tower.test.ts tests/stages/stage01-moss.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/stages/types.ts src/stages/world.ts src/stages/tower.ts tests/stages/world.test.ts tests/stages/tower.test.ts
git commit -m "feat: add continuous tower world model" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 2: Version 2 stage-relative saves and migration

**Files:**
- Modify: `src/core/save.ts`
- Modify: `src/game/run-snapshot.ts`
- Modify: `tests/core/save.test.ts`
- Modify: `tests/game/game-save.test.ts`

**Interfaces:**
- Consumes: `TowerDef`, stage heights, existing version 1 save shape.
- Produces: `SAVE_KEY_V2`, `SaveDataV2`, `RunLocation`, `validateRunSaveV2`, `migrateV1`, and floor-relative `bestHeight`.

- [ ] **Step 1: Write failing version 2 validation tests**

```ts
const hard: HardRunSaveV2 = {
  kind: 'hard', stageId: 2, localSection: 4,
  x: 440, stageY: 2100, vx: 80, vy: -30,
  elapsed: 90, falls: 3, bestHeight: 6300,
};
expect(validateRunSaveV2(hard, 'hard')).toEqual(hard);
expect(validateRunSaveV2({ ...hard, stageY: NaN }, 'hard')).toBeNull();
```

Normal snapshots contain `stageId`, `localSection`, `elapsed`, `falls`, and `bestHeight`. Hard snapshots add `x`, `stageY`, `vx`, and `vy`.

- [ ] **Step 2: Write failing migration and write-order tests**

Seed memory storage with a valid version 1 document containing both modes. Assert that loading version 2:

```ts
expect(save.version).toBe(2);
expect(save.runs.normal).toMatchObject({ stageId: 1, localSection: 3 });
expect(save.runs.hard).toMatchObject({ stageId: 1, stageY: expect.any(Number) });
expect(storage.getItem(SAVE_KEY_V1)).toBeNull();
expect(storage.getItem(SAVE_KEY_V2)).not.toBeNull();
```

Add a storage adapter whose V2 `setItem` throws. Assert the V1 key remains and the migrated in-memory document is still returned with the standard unavailable-saving notice.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/core/save.test.ts tests/game/game-save.test.ts`

Expected: FAIL because version 2 types and migration are absent.

- [ ] **Step 4: Implement the version 2 document and safe migration**

```ts
export interface RunLocation {
  stageId: number;
  localSection: number;
}

export interface NormalRunSaveV2 extends RunLocation {
  kind: 'normal';
  elapsed: number;
  falls: number;
  bestHeight: number;
}

export interface HardRunSaveV2 extends RunLocation {
  kind: 'hard';
  x: number;
  stageY: number;
  vx: number;
  vy: number;
  elapsed: number;
  falls: number;
  bestHeight: number;
}

export const SAVE_KEY_V1 = 'tower-platformer.save.v1';
export const SAVE_KEY_V2 = 'tower-platformer.save.v2';

export interface SaveDataV2 {
  version: 2;
  settings: Settings;
  completedPrompts: PromptId[];
  runs: Record<Mode, RunSaveV2 | null>;
  records: Record<Mode, Records>;
}
```

Read V2 first. If absent, read V1, validate fields using the existing defensive rules, translate Stage 1 coordinates using Moss Ruins height, write V2, and remove V1 only after the write succeeds. Convert `bestY` with `bestHeight = STAGE_01_MOSS.sections.reduce((n, s) => n + s.height, 0) - bestY`.

- [ ] **Step 5: Verify round trips, partial corruption, and migration GREEN**

Run: `npx vitest run tests/core/save.test.ts tests/game/game-save.test.ts`

Expected: PASS, including corrupt one-mode isolation and unavailable storage.

- [ ] **Step 6: Commit and push**

```bash
git add src/core/save.ts src/game/run-snapshot.ts tests/core/save.test.ts tests/game/game-save.test.ts
git commit -m "feat: migrate saves to stage-relative locations" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 3: Multi-stage game state, banners, checkpoints, HUD, and debug warp

**Files:**
- Modify: `src/game/game.ts`
- Modify: `src/modes/run-state.ts`
- Modify: `src/modes/rules.ts`
- Modify: `src/render/entity-draw.ts`
- Modify: `src/ui/hud.ts`
- Modify: `src/debug/overlay.ts`
- Modify: `src/app/controller.ts`
- Modify: `tests/game/game.test.ts`
- Modify: `tests/game/game-save.test.ts`
- Modify: `tests/modes/modes.test.ts`
- Modify: `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: `TOWER`, global world sections, version 2 snapshots.
- Produces: `Game.currentStage`, `Game.currentSection` as a global index, `Game.warp(globalIndex)`, and `Checkpoint.globalSection`.

- [ ] **Step 1: Write failing cross-stage state tests**

```ts
const game = new Game('normal', threeStageTower);
game.warp(7);
expect(game.currentStage.id).toBe(2);
expect(game.world.sections[game.currentSection].localSection).toBe(0);
expect(game.banner.label()).toMatchObject({ stage: 2, name: 'Clockwork Hall' });
```

Test that moving from global section 6 to 7 enters Stage 2 once, staying within Stage 2 does not re-enter the banner, and moving down from section 7 to 6 re-enters Stage 1.

- [ ] **Step 2: Write failing checkpoint and restore tests**

Activate Stage 2 local section 3 and assert `run.checkpoint.globalSection === 10`. Snapshot and restore both modes; assert stage/local identity, elapsed machinery phase, and floor-relative best height survive.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/game/game.test.ts tests/game/game-save.test.ts tests/modes/modes.test.ts tests/ui/hud.test.ts`

Expected: FAIL on missing global stage state and version 2 restoration.

- [ ] **Step 4: Implement global checkpoint and stage transition logic**

```ts
export interface Checkpoint extends Point {
  globalSection: number;
  stageId: number;
  localSection: number;
}

get currentStage(): StageDef {
  return this.world.tower.stages.find((s) => s.id === this.world.sections[this.currentSection].stageId)!;
}
```

Use array indices everywhere activation or progression is global. Set `game.time = snapshot.elapsed` during restore. Convert Hard `stageY` to world Y using the current stage's bottom edge; convert `bestHeight` back to runtime `bestY` only inside `Game`.

- [ ] **Step 5: Update presentation consumers**

Draw checkpoint lighting using `globalSection <= active.globalSection`. HUD stage label reads `game.currentStage.name`; the ten-tick progress bar places the dot within the current stage's tick using local height. Debug `[` and `]` warp global sections and the overlay shows `Stage X / Section Y`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npx vitest run tests/game tests/modes tests/ui/hud.test.ts tests/debug
npm run typecheck
```

Expected: PASS.

```bash
git add src/game src/modes src/render/entity-draw.ts src/ui/hud.ts src/debug/overlay.ts src/app/controller.ts tests/game tests/modes tests/ui/hud.test.ts tests/debug
git commit -m "feat: run gameplay across stage boundaries" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 4: Dynamic-solid, shove, hazard, and field interaction foundation

**Files:**
- Modify: `src/entities/entity.ts`
- Modify: `src/entities/factory.ts`
- Create: `src/entities/interactions.ts`
- Modify: `src/game/game.ts`
- Modify: `src/physics/collision.ts`
- Create: `tests/entities/interactions.test.ts`
- Modify: `tests/game/game.test.ts`
- Modify: `tests/physics/collision.test.ts`

**Interfaces:**
- Consumes: `Player`, `CollisionSolid`, `STEP`, active entity list.
- Produces: `DynamicSolid`, `FieldEffect`, `EntityContact`, `carryStandingPlayer`, and `pushOutPlayer`.

- [ ] **Step 1: Write failing moving-solid carry tests**

```ts
const solid: DynamicSolid = {
  box: { x: 100, y: 200, w: 120, h: 20 },
  delta: { x: 3, y: -2 },
  surface: 'normal',
};
const player = createPlayer(130, 172);
expect(carryStandingPlayer(player, solid)).toBe(true);
expect({ x: player.x, y: player.y }).toEqual({ x: 133, y: 170 });
```

Cover horizontal, vertical, non-standing, and blocked carry cases.

- [ ] **Step 2: Write failing shove and field aggregation tests**

Assert `pushOutPlayer` selects the smallest clear translation, never leaves overlap, and reports failure if all four axes are blocked. Assert overlapping fields sum current acceleration while water parameters use the strongest drag/gravity reduction only once.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/entities/interactions.test.ts tests/physics/collision.test.ts tests/game/game.test.ts`

Expected: FAIL because interaction contracts and helpers are absent.

- [ ] **Step 4: Implement explicit interaction contracts**

```ts
export interface DynamicSolid {
  box: CollisionSolid;
  delta: Point;
}

export interface FieldEffect {
  water?: { gravityScale: number; maxFall: number; dragPerStep: number; strokeSpeed: number; strokeCooldown: number };
  accelerationX: number;
  accelerationY: number;
}

export type EntityContact =
  | { kind: 'none' }
  | { kind: 'launch'; velocityY: number }
  | { kind: 'prompt'; id: PromptId }
  | { kind: 'push'; dx: number; dy: number }
  | { kind: 'hazard'; centerX: number };

export interface Entity {
  bounds(): AABB;
  update(t: number, dt: number): void;
  dynamicSolids(): readonly DynamicSolid[];
  field(player: Player): FieldEffect | null;
  collide(player: Player): EntityContact;
  draw(ctx: CanvasRenderingContext2D, t: number, alpha: number): void;
  reset(): void;
}
```

Existing mushroom and prompt entities return empty arrays/null for the new methods.

- [ ] **Step 5: Apply the ordered game update pipeline**

Update entities first, gather dynamic solids/fields, carry a standing player, call `stepPlayer` with static plus dynamic collision boxes and a resolved environment, then process contacts. A failed push-out routes through existing mode-specific hazard handling.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npx vitest run tests/entities tests/physics tests/game
npm run typecheck
```

Expected: PASS.

```bash
git add src/entities src/game/game.ts src/physics/collision.ts tests/entities tests/game/game.test.ts tests/physics/collision.test.ts
git commit -m "feat: add reusable world interactions" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 5: Conveyor surfaces and Clockwork machinery entities

**Files:**
- Modify: `src/stages/types.ts`
- Modify: `src/physics/player.ts`
- Modify: `src/entities/factory.ts`
- Create: `src/entities/gear.ts`
- Create: `src/entities/piston.ts`
- Create: `src/entities/timed-door.ts`
- Create: `tests/physics/conveyor.test.ts`
- Create: `tests/entities/clockwork.test.ts`

**Interfaces:**
- Consumes: Task 4 interaction contracts.
- Produces: `conveyorLeft`, `conveyorRight`, `GearEntity`, `PistonEntity`, and `TimedDoorEntity`.

- [ ] **Step 1: Write failing conveyor tests**

Assert a grounded player on `conveyorRight` receives +90 units/second of support velocity, can run against it, and receives no belt velocity in the air. Assert a fast conveyor uses the speed stored on its solid definition, not a hidden global.

- [ ] **Step 2: Implement conveyors minimally**

```ts
export type SurfaceType = ExistingSurfaceType | 'conveyorLeft' | 'conveyorRight';
export interface SolidDef extends AABB {
  surface: SurfaceType;
  conveyorSpeed?: number;
  role?: SolidRole;
}
```

During grounded resolution, add signed conveyor speed to the player's support displacement while preserving player acceleration and speed limits relative to the belt.

- [ ] **Step 3: Write failing deterministic machinery tests**

For each entity, construct from a definition and call `update(t, STEP)` at exact times:

```ts
expect(gearAt(0).dynamicSolids()[0].box).toMatchObject({ x: 300, y: 200 });
expect(gearAt(1).dynamicSolids()[0].box.x).toBeCloseTo(300 + radius);
expect(pistonAt(1.45).phase).toBe('warning');
expect(pistonAt(1.79).phase).toBe('extended');
expect(doorAt(0).dynamicSolids()).toEqual([]);
expect(doorAt(1.8).dynamicSolids()).toHaveLength(1);
```

Also assert a piston contact returns `push`, not `hazard`, and every entity resets to its deterministic time-zero geometry.

- [ ] **Step 4: Implement machinery with exact spec timing**

Add discriminated `EntityDef` variants:

```ts
| { type: 'gear'; x: number; y: number; radius: number; period: 4 | 6; phase: number; paddleW: number }
| { type: 'piston'; x: number; y: number; w: number; h: number; axis: 'x' | 'y'; travel: number; phase: number }
| { type: 'timedDoor'; x: number; y: number; w: number; h: number; phase: number }
```

Use pure phase functions with the exact cycles from the spec. Store previous and current boxes so `delta` is accurate for carry.

- [ ] **Step 5: Validate parameters and run GREEN tests**

Reject non-positive radii/travel, phases outside `[0, 1)`, unsupported periods, and doors thinner than `MIN_SOLID_THICKNESS` in `validateStage`.

Run: `npx vitest run tests/physics/conveyor.test.ts tests/entities/clockwork.test.ts tests/stages/world.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/stages/types.ts src/physics/player.ts src/entities tests/physics/conveyor.test.ts tests/entities/clockwork.test.ts tests/stages/world.test.ts
git commit -m "feat: add clockwork obstacle mechanics" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 6: Complete Clockwork Hall stage data and route validation

**Files:**
- Create: `src/stages/stage02-clockwork.ts`
- Modify: `src/stages/tower.ts`
- Create: `tests/stages/stage02-clockwork.test.ts`

**Interfaces:**
- Consumes: conveyor surfaces and Clockwork entity definitions.
- Produces: `STAGE_02_CLOCKWORK` with seven sections and theme metadata.

- [ ] **Step 1: Write failing stage-shape and route tests**

Assert:

```ts
expect(STAGE_02_CLOCKWORK.id).toBe(2);
expect(STAGE_02_CLOCKWORK.sections).toHaveLength(7);
expect(validateStage(STAGE_02_CLOCKWORK)).toEqual([]);
expect(STAGE_02_CLOCKWORK.sections.map(signature)).toEqual([
  ['conveyor'], ['conveyor'], ['gear'], ['piston'], ['timedDoor'], ['conveyor', 'gear', 'piston'], ['conveyor', 'gear', 'piston', 'timedDoor'],
]);
```

For every section, assert a clear checkpoint spawn, one `main` platform route, zero unclassified platforms, at most one `recovery` platform, a flat checkpoint runway at least 280 units wide, and a direct final handoff. Assert all moving paths stay within the 24–936 shell and timed-door waiting floors do not intersect closed doors.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run tests/stages/stage02-clockwork.test.ts`

Expected: FAIL because the stage does not exist.

- [ ] **Step 3: Implement Sections 1–3**

Use 700-unit sections and the shared `platform`, `section`, and shell helpers extracted into `src/stages/builders.ts`:

1. two 90-unit/second conveyors with broad recovery floors;
2. alternating 90/160-unit/second conveyors and wide landings;
3. two 6-second gears connecting three fixed platforms.

Keep vertical ordinary jumps between 90 and 140 units and horizontal air gaps within the verified movement envelope.

- [ ] **Step 4: Implement Sections 4–7**

4. one horizontal and one vertical piston with a recovery floor;
5. three phase-offset doors and safe wait floors;
6. conveyor → two 4-second gears → short piston climb;
7. 160-unit/second conveyor → large gear → two pistons → one final door.

Use exact entity counts from the spec and no collision platform that is absent from the main/recovery route.

- [ ] **Step 5: Add the stage to `TOWER` and verify**

```ts
export const TOWER: TowerDef = { stages: [STAGE_01_MOSS, STAGE_02_CLOCKWORK] };
```

Run:

```bash
npx vitest run tests/stages/stage01-moss.test.ts tests/stages/stage02-clockwork.test.ts tests/stages/tower.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/stages tests/stages
git commit -m "feat: build Clockwork Hall routes" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 7: Clockwork rendering, sound events, and browser walkthrough

**Files:**
- Create: `src/render/themes.ts`
- Create: `src/render/clockwork-draw.ts`
- Modify: `src/render/room-draw.ts`
- Modify: `src/entities/gear.ts`
- Modify: `src/entities/piston.ts`
- Modify: `src/entities/timed-door.ts`
- Modify: `src/audio/audio.ts`
- Modify: `src/main.ts`
- Create: `tests/render/themes.test.ts`
- Modify: `tests/audio/audio.test.ts`

**Interfaces:**
- Consumes: current stage/theme, Clockwork entities, `AudioManager`.
- Produces: `ThemeBlend`, `themeBlendAt(world, cameraY)`, Clockwork background/platform rendering, `machineWarning`, `piston`, and `door` sound events.

- [ ] **Step 1: Write failing theme selection and audio dispatch tests**

Assert the camera below the 600-unit boundary returns pure Moss, halfway returns a 0.5 Moss/Clockwork blend, and above returns pure Clockwork. Assert warning and movement sound events respect master/SFX mute and backend failure behavior.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run tests/render/themes.test.ts tests/audio/audio.test.ts`

Expected: FAIL on missing theme blending and sound events.

- [ ] **Step 3: Implement theme-aware rendering**

```ts
export interface ThemeBlend {
  lower: StageDef;
  upper: StageDef;
  mix: number; // clamped 0..1; 0 is lower, 1 is upper
}
```

Move Moss constants behind `ThemeRenderer`. Add a Clockwork renderer with iron arches, brass clock faces, shafts, amber haze, dust, chevrons, rivets, and red warning lamps. `drawBackground` and `drawSolids` receive the active `ThemeBlend`; draw both backgrounds with complementary alpha in the 600-unit zone.

- [ ] **Step 4: Implement Clockwork entity visuals and audio**

Draw complete gear paths and axles, piston travel rails, and door cycle arcs before drawing moving bodies. Warning state changes color independently of glow. Add synthesized click, low piston thump, and door slide voices; do not add audio assets.

- [ ] **Step 5: Browser-check all seven sections**

Warp through global sections 7–13 in Normal and Hard. For each, record pass/fail for route readability, telegraphs, no soft lock, sensible recovery, transition presentation, and console errors. Fix presentation-only defects directly; use TDD for behavior defects.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: PASS.

```bash
git add src/render src/entities src/audio/audio.ts src/main.ts tests/render tests/audio
git commit -m "feat: present and score Clockwork Hall" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 8: Water movement and current fields

**Files:**
- Modify: `src/stages/types.ts`
- Modify: `src/entities/factory.ts`
- Create: `src/entities/water.ts`
- Modify: `src/physics/player.ts`
- Create: `tests/physics/water.test.ts`
- Create: `tests/entities/water.test.ts`

**Interfaces:**
- Consumes: `FieldEffect`, player input, `STEP`.
- Produces: `WaterEntity`, resolved `PlayerEnvironment`, press-to-stroke swimming, and current acceleration.

- [ ] **Step 1: Write failing swim physics tests**

Test dry and submerged players from identical initial state. Assert submerged gravity is exactly `GRAVITY * 0.45`, downward speed caps at 220, horizontal velocity receives 0.96 per-step drag, and a fresh Jump press sets `vy` to `min(currentVy, -420)`.

Assert holding Jump for 60 steps creates one stroke, releasing and pressing after 0.22 seconds creates another, and leaving water preserves velocity capped to the normal player limits.

- [ ] **Step 2: Write failing current aggregation tests**

```ts
const field = new WaterEntity({ type: 'water', x: 0, y: 100, w: 500, h: 300, currentX: 260, currentY: -100 });
expect(field.field(submergedPlayer)).toMatchObject({ accelerationX: 260, accelerationY: -100 });
expect(field.field(dryPlayer)).toBeNull();
```

Assert overlapping currents sum and clamp each axis to 420 units/second squared.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/physics/water.test.ts tests/entities/water.test.ts`

Expected: FAIL because water and environment-aware stepping are absent.

- [ ] **Step 4: Implement water definitions and environment-aware movement**

```ts
| { type: 'water'; x: number; y: number; w: number; h: number; currentX: number; currentY: number }

export interface PlayerEnvironment {
  gravityScale: number;
  maxFall: number;
  dragPerStep: number;
  strokeSpeed: number;
  strokeCooldown: number;
  accelerationX: number;
  accelerationY: number;
}
```

Extend player state with `strokeCooldown`. Apply water drag/acceleration before collision and consume `jumpPressed` for strokes only while submerged; ordinary coyote/jump behavior remains unchanged when dry.

- [ ] **Step 5: Validate water bounds/currents and run GREEN**

Reject water smaller than 24 × 24 and current components above 420 in `validateStage`. Run:

```bash
npx vitest run tests/physics tests/entities/water.test.ts tests/stages/world.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/stages/types.ts src/entities src/physics/player.ts tests/physics tests/entities/water.test.ts tests/stages/world.test.ts
git commit -m "feat: add swimming and readable currents" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 9: Sinking crates and rideable water wheels

**Files:**
- Modify: `src/stages/types.ts`
- Modify: `src/entities/factory.ts`
- Create: `src/entities/sinking-crate.ts`
- Create: `src/entities/water-wheel.ts`
- Create: `tests/entities/aqueduct.test.ts`

**Interfaces:**
- Consumes: dynamic-solid carry foundation and deterministic global time.
- Produces: `SinkingCrateEntity` and `WaterWheelEntity`.

- [ ] **Step 1: Write failing crate state tests**

Assert the crate remains at rest for 0.35 seconds of continuous standing contact, sinks at 70 units/second afterward, stops at configured `sinkDistance`, rises at 50 units/second after contact ends, and returns immediately on `reset()`.

Drive standing state through a real player/solid contact helper, not a test-only setter.

- [ ] **Step 2: Write failing water-wheel tests**

At `t = 0`, `1.25`, `2.5`, and `3.75`, assert four paddle boxes occupy the expected quarter-turn positions for a five-second period. Assert each paddle reports frame delta and carries a standing player.

- [ ] **Step 3: Run tests to verify RED**

Run: `npx vitest run tests/entities/aqueduct.test.ts`

Expected: FAIL because both entities are absent.

- [ ] **Step 4: Implement exact state and definitions**

```ts
| { type: 'sinkingCrate'; x: number; y: number; w: number; h: number; sinkDistance: number }
| { type: 'waterWheel'; x: number; y: number; radius: number; phase: number; paddleW: number; paddleH: number }
```

Crates use accumulated stood-on time and `dt`; wheels use pure elapsed-time phase. Both expose `DynamicSolid[]`. Clamp crate position to `[startY, startY + sinkDistance]`.

- [ ] **Step 5: Validate, verify, and commit**

Validate positive sink distance, wheel radius, and paddle dimensions. Run:

```bash
npx vitest run tests/entities/aqueduct.test.ts tests/entities/interactions.test.ts tests/stages/world.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add src/stages/types.ts src/entities tests/entities/aqueduct.test.ts tests/stages/world.test.ts
git commit -m "feat: add aqueduct ride mechanics" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 10: Complete Sunken Aqueduct stage data and route validation

**Files:**
- Create: `src/stages/stage03-aqueduct.ts`
- Modify: `src/stages/tower.ts`
- Create: `tests/stages/stage03-aqueduct.test.ts`

**Interfaces:**
- Consumes: water, currents, sinking crates, water wheels, normal solids.
- Produces: `STAGE_03_AQUEDUCT` and final three-stage `TOWER`.

- [ ] **Step 1: Write failing stage and mechanic progression tests**

```ts
expect(STAGE_03_AQUEDUCT.id).toBe(3);
expect(STAGE_03_AQUEDUCT.sections).toHaveLength(7);
expect(validateStage(STAGE_03_AQUEDUCT)).toEqual([]);
expect(STAGE_03_AQUEDUCT.sections.map(signature)).toEqual([
  ['water'], ['water'], ['sinkingCrate'], ['waterWheel'], ['water', 'sinkingCrate'], ['water'], ['water', 'sinkingCrate', 'waterWheel'],
]);
```

Assert one main route, zero unclassified collision platforms, at most one recovery platform, checkpoint runways ≥280 units, water exits ≥160 units wide, currents never point into a sealed wall, crates never block the only exit, wheel dismount arcs overlap fixed landings by ≥80 units, and all section/stage handoffs are reachable.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run tests/stages/stage03-aqueduct.test.ts`

Expected: FAIL because the stage does not exist.

- [ ] **Step 3: Implement Sections 1–4**

1. shallow no-current pool with a visible 240-unit-wide exit;
2. one +260 assisting current followed by one -260 opposing current;
3. three crates with ≤130-unit horizontal transfers over a recoverable pool;
4. one five-second wheel whose safe paddle arc overlaps both landings.

- [ ] **Step 4: Implement Sections 5–7**

5. -420 vertical current plus two crates and side exits;
6. two swim channels alternating with dry dash landings at least 180 units wide;
7. readable +420 current, two crates, one wheel, and a -420 vertical exit jet leading directly into the final checkpoint.

Use a broad flat checkpoint runway in every section and no wall-jump shaft.

- [ ] **Step 5: Build the final batch tower and verify**

```ts
export const TOWER: TowerDef = { stages: [STAGE_01_MOSS, STAGE_02_CLOCKWORK, STAGE_03_AQUEDUCT] };
```

Run:

```bash
npx vitest run tests/stages tests/entities/aqueduct.test.ts tests/physics/water.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/stages tests/stages
git commit -m "feat: build Sunken Aqueduct routes" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 11: Aqueduct rendering, ambience, effects, and audio

**Files:**
- Create: `src/render/aqueduct-draw.ts`
- Modify: `src/render/themes.ts`
- Modify: `src/render/room-draw.ts`
- Modify: `src/entities/water.ts`
- Modify: `src/entities/sinking-crate.ts`
- Modify: `src/entities/water-wheel.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/audio/audio.ts`
- Modify: `src/main.ts`
- Modify: `tests/render/themes.test.ts`
- Modify: `tests/audio/audio.test.ts`

**Interfaces:**
- Consumes: theme blending, Aqueduct entities, Reduced Effects.
- Produces: Aqueduct background/solid/entity drawing, water tint/reflection, `splash`, `swimStroke`, `crate`, and `wheel` sounds, and `aqueduct` ambience.

- [ ] **Step 1: Write failing Stage 2→3 blend and audio tests**

Assert exact blend weights at the bottom, midpoint, and top of the 600-unit transition. Assert Aqueduct ambience replaces Clockwork above the blend and both receive equal gain at midpoint. Verify new sound events respect mute and manager failure isolation.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run tests/render/themes.test.ts tests/audio/audio.test.ts`

Expected: FAIL because Aqueduct presentation is absent.

- [ ] **Step 3: Implement Aqueduct theme and water presentation**

Draw teal stone arches, oxidized trim, light shafts, plant silhouettes, bubbles, waterfalls, and mist. Water draws an animated surface line, translucent tint, directional bubbles, and clipped contents. Reduced Effects halves bubbles/mist and removes reflection glow without changing water bounds.

- [ ] **Step 4: Draw entities and synthesize audio**

Draw crates with a visible waterline and sink trail; draw complete wheel circles and all paddles. Add short filtered-noise splash/stroke voices, a wood creak for crates, and a low wheel pulse. Aqueduct ambience combines filtered water noise, sparse drips, and a quiet low sine bed.

- [ ] **Step 5: Integrate stage-sensitive effects**

Choose dust/spark/splash particle palettes from `game.currentStage.id`. Crossfade ambience from `themeBlendAt`; pause applies the existing duck to every active ambience layer. Entry/exit splashes emit only on water-state edges.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npx vitest run tests/render tests/audio tests/entities/water.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

```bash
git add src/render src/entities src/audio/audio.ts src/main.ts tests/render tests/audio
git commit -m "feat: present and score Sunken Aqueduct" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
```

---

### Task 12: Full integration, browser playtest, documentation, and batch closeout

**Files:**
- Modify: `src/main.ts`
- Modify: `src/app/controller.ts`
- Modify: `HANDOFF.md`
- Modify: `docs/superpowers/plans/2026-09-16-m4-clockwork-aqueduct.md`
- Add or modify tests beside any defect found.

**Interfaces:**
- Consumes: the complete three-stage tower and every subsystem from Tasks 1–11.
- Produces: a verified, documented, continuously playable Milestone 4 batch.

- [ ] **Step 1: Run fresh automated verification**

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Record exact file/test totals in `HANDOFF.md` only after all commands exit 0.

- [ ] **Step 2: Verify save and menu flows in the browser**

Check a fresh Normal run, Stage 2 checkpoint Continue, Stage 3 checkpoint Continue, Hard autosave in each stage, reload at moving machinery phase, pause timer gating, quit/continue visibility, V1 migration, corrupt V2 fallback, and unavailable-storage notice.

- [ ] **Step 3: Playtest all Clockwork sections in both modes**

Warp to global sections 7–13 and complete each route. Record: reachable, telegraph readable, no soft lock, sensible fall recovery, no useless collision platform. Verify conveyor control, gear carry, piston shove, door waiting areas, and the Moss→Clockwork transition.

- [ ] **Step 4: Playtest all Aqueduct sections in both modes**

Warp to global sections 14–20 and complete each route. Record the same five checks. Verify strokes require presses, currents are visible, crates recover, wheels carry, dry/wet exits are clean, and the Clockwork→Aqueduct transition works.

- [ ] **Step 5: Check presentation, audio, and performance**

Inspect all three themes and both blend zones at normal and Reduced Effects settings. Listen to each implemented movement, machinery, water, checkpoint, and ambience event; verify mute and live volume. Confirm no browser console errors and steady ≥60 fps in Clockwork Section 7 and Aqueduct Section 7.

- [ ] **Step 6: Fix every discovered defect with the correct evidence loop**

For logic/physics/save defects: add the smallest failing Vitest case, run it RED, implement one fix, run it GREEN, then run the affected suite. For rendering/audio-only defects: capture the reproduction, make one scoped change, repeat the browser check, and include the reproduction in the commit message body.

- [ ] **Step 7: Update handoff and checkboxes**

Document continuous-tower architecture, save V2 migration, Stage 2/3 mechanics and controls, exact test totals, browser evidence, remaining subjective playtest items, and the next batch (Stages 4–5). Mark plan checkboxes only after their evidence exists.

- [ ] **Step 8: Final verification and commit**

Run:

```bash
npm test && npm run typecheck && npm run build && git diff --check && git status --short --branch
```

Expected: every command exits 0 and only intended documentation changes remain.

```bash
git add HANDOFF.md docs/superpowers/plans/2026-09-16-m4-clockwork-aqueduct.md
git commit -m "docs: record Clockwork and Aqueduct completion" -m "Co-Authored-By: OpenAI Codex <noreply@openai.com>"
git push origin main
git status --short --branch
```

Expected final status: `main...origin/main` with no changed files. Leave `http://127.0.0.1:5173/` running for user playtesting.
