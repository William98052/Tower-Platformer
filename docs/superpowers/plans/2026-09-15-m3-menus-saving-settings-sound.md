# Milestone 3 Game Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete title/mode/pause/settings shell, resilient local saves, two-key rebinding, effect preferences, and synthesized Moss Ruins audio around the existing playable stage.

**Architecture:** Keep physics and stage logic inside `Game`; add pure snapshot, settings, save-validation, and screen-transition modules around it. A small application controller owns the active screen and game lifecycle, semantic HTML renders menus above the canvas, and an event-driven Web Audio manager consumes game/UI events without entering the physics layer.

**Tech Stack:** TypeScript 5.9, Vite 8, Vitest 5, Canvas 2D, semantic HTML/CSS, browser localStorage, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-09-15-m3-menus-saving-settings-sound-design.md`

## Global Constraints

- Use red-green-refactor TDD for save data, state transitions, settings, input, and game snapshot logic.
- Keep exactly two keyboard bindings per gameplay action; gamepad mappings and menu keys remain fixed.
- Never let storage or audio failure prevent booting or gameplay.
- Advance physics and the run timer only while the screen is `playing`.
- Normal saves write on checkpoint/pause/quit; Hard saves every 5 seconds and on pause/quit.
- Use Web Audio synthesis only; add no media files or runtime dependencies.
- Defer the Records UI and win screen to Milestone 5 and stages 2–10 to Milestone 4.
- Commit and push each reviewed task directly to `main`, preserving the required attribution trailer.

---

## Planned file structure

- `src/core/settings.ts`: settings defaults, validation, key conflict swapping, and presentation policy.
- `src/core/save.ts`: versioned save schema, validation, resilient storage adapter, and per-slice update helpers.
- `src/game/run-snapshot.ts`: Normal/Hard runtime snapshot types and validation independent of browser storage.
- `src/app/controller.ts`: screen state, game lifecycle, pause/restart/quit, Continue availability, and autosave scheduling.
- `src/ui/menu.ts`: semantic DOM construction, focus, action dispatch, settings controls, and notices.
- `src/ui/menu.css`: responsive overlay presentation.
- `src/audio/audio.ts`: lazy Web Audio graph, gameplay/UI sounds, ambience, live gains, and silent fallback.
- `src/main.ts`: browser integration only—controller, loop gating, menus, saves, audio events, and rendering.

---

### Task 1: Settings model and live input bindings

**Files:**
- Create: `src/core/settings.ts`
- Modify: `src/core/input.ts`
- Test: `tests/core/settings.test.ts`
- Modify: `tests/core/input.test.ts`

**Interfaces:**
- Produces: `Settings`, `DEFAULT_SETTINGS`, `validateSettings(value): Settings`, `replaceBinding(settings, action, slot, code): Settings`, and `effectsPolicy(settings)`.
- Modifies: `InputTracker.setBindings(bindings: Bindings): void` to release held input and use new bindings.

- [x] **Step 1: Write failing tests for defaults and validation**

```ts
expect(DEFAULT_SETTINGS.masterVolume).toBe(0.8);
expect(DEFAULT_SETTINGS.sfxVolume).toBe(1);
expect(DEFAULT_SETTINGS.bindings.left).toEqual(['ArrowLeft', 'KeyA']);
expect(validateSettings({ ...DEFAULT_SETTINGS, masterVolume: 4 }).masterVolume).toBe(1);
expect(validateSettings({ ...DEFAULT_SETTINGS, reducedEffects: 'yes' })).toEqual(DEFAULT_SETTINGS);
```

- [x] **Step 2: Run the focused suite and verify RED**

Run: `npx vitest run tests/core/settings.test.ts`

Expected: FAIL because `src/core/settings.ts` does not exist.

- [x] **Step 3: Implement the settings model**

```ts
export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  bindings: Record<Action, readonly [string, string]>;
  screenShake: boolean;
  reducedEffects: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 1,
  bindings: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyC'], dash: ['ShiftLeft', 'KeyX'],
  },
  screenShake: true,
  reducedEffects: false,
};
```

Validation clamps volumes to `[0, 1]`, accepts only booleans for toggles, requires all six actions with two non-empty codes, and returns a deep copy of defaults when the object is malformed.

- [x] **Step 4: Write failing tests for swaps and live rebinding**

```ts
const changed = replaceBinding(DEFAULT_SETTINGS, 'jump', 0, 'KeyA');
expect(changed.bindings.jump[0]).toBe('KeyA');
expect(changed.bindings.left[1]).toBe('Space');

const input = new InputTracker();
input.keyDown('KeyA');
input.setBindings(changed.bindings);
expect(input.sample().moveX).toBe(0);
```

- [x] **Step 5: Implement conflict swapping and `InputTracker.setBindings`**

`replaceBinding` finds an existing occurrence of the new code and puts the replaced code in that slot. It never mutates its input. `InputTracker` stores mutable current bindings, calls `releaseAll()`, and resets previous gamepad edges when bindings change.

- [x] **Step 6: Verify and commit**

Run: `npx vitest run tests/core/settings.test.ts tests/core/input.test.ts`

Expected: PASS.

Commit: `feat: add persistent game settings model`

---

### Task 2: Versioned save document and resilient storage

**Files:**
- Create: `src/game/run-snapshot.ts`
- Create: `src/core/save.ts`
- Test: `tests/core/save.test.ts`

**Interfaces:**
- Produces discriminated `NormalRunSave` and `HardRunSave` types.
- Produces `SaveDataV1`, `DEFAULT_SAVE`, `StorageLike`, and `SaveStore` with `load()`, `write(data)`, `update(mutator)`, `available`, and `notice`.
- Consumes `Settings`, `DEFAULT_SETTINGS`, `validateSettings`, `Mode`, and `PromptId`.

- [x] **Step 1: Write failing round-trip and default tests**

```ts
const storage = memoryStorage();
const store = new SaveStore(storage);
expect(store.load()).toEqual(DEFAULT_SAVE);
const save = { ...DEFAULT_SAVE, completedPrompts: ['jump'] as const };
expect(store.write(save)).toBe(true);
expect(new SaveStore(storage).load().completedPrompts).toEqual(['jump']);
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run tests/core/save.test.ts`

Expected: FAIL because the save module does not exist.

- [x] **Step 3: Implement schema and serialization**

```ts
export interface SaveDataV1 {
  version: 1;
  settings: Settings;
  completedPrompts: PromptId[];
  runs: Record<Mode, RunSave | null>;
  records: Record<Mode, { bestHeight: number; bestTime: number | null; fewestFalls: number | null }>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

Use the key `tower-platformer.save.v1`. Parse unknown data field-by-field; deduplicate known prompt IDs; validate finite numeric values and the snapshot discriminator. Unknown versions and invalid top-level data return a fresh deep default.

- [x] **Step 4: Write failing corruption and unavailable-storage tests**

Cover invalid JSON, version `99`, a corrupt Normal run beside a valid Hard run, `getItem` throwing, and `setItem` throwing. Assert that only the invalid run is cleared where possible, `available` becomes false after an exception, and `notice` contains one stable user-facing message.

- [x] **Step 5: Implement safe partial validation and failure isolation**

All adapter access stays inside `try/catch`. `load()` caches its validated document; `update()` clones it, applies one synchronous mutator, validates, and attempts one full-document write. A write failure preserves the in-memory update.

- [x] **Step 6: Verify and commit**

Run: `npx vitest run tests/core/save.test.ts tests/core/settings.test.ts`

Expected: PASS.

Commit: `feat: add resilient versioned saves`

---

### Task 3: Game snapshots, prompt restoration, and resume safety

**Files:**
- Modify: `src/game/game.ts`
- Modify: `src/ui/prompts.ts`
- Modify: `src/game/run-snapshot.ts`
- Test: `tests/game/game-save.test.ts`
- Modify: `tests/ui/prompts.test.ts`

**Interfaces:**
- Produces `Game.snapshot(): RunSave`.
- Produces `Game.restore(stage: StageDef, snapshot: RunSave, completedPrompts: Iterable<PromptId>): Game | null`.
- Produces `Game.completedPrompts(): PromptId[]` and constructor support for pre-completed prompts.

- [ ] **Step 1: Write failing Normal and Hard snapshot tests**

```ts
const normal = new Game('normal');
normal.run.elapsed = 12.5;
normal.run.falls = 3;
normal.run.checkpoint = { ...normal.world.sections[2].checkpoint, section: 2 };
expect(normal.snapshot()).toMatchObject({ kind: 'normal', stageId: 1, section: 2, elapsed: 12.5, falls: 3 });

const hard = new Game('hard');
hard.player.x = 420; hard.player.y = 900; hard.player.vx = 50; hard.player.vy = -20;
expect(hard.snapshot()).toMatchObject({ kind: 'hard', x: 420, y: 900, vx: 50, vy: -20 });
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/game/game-save.test.ts`

Expected: FAIL because snapshot methods are absent.

- [ ] **Step 3: Implement snapshot creation and restoration**

Normal restoration creates a new game and warps to the saved checkpoint section, then restores elapsed, falls, and best height. Hard restoration restores position, velocity, elapsed, falls, best height, and derives `currentSection` from the player position.

Before accepting Hard coordinates, create the player's AABB and reject the snapshot if it is outside world bounds or overlaps any solid in the active section neighborhood. Reject a mismatched stage ID or invalid section.

- [ ] **Step 4: Write failing prompt restoration tests**

```ts
const game = new Game('normal', STAGE_01_MOSS, ['jump']);
expect(game.completedPrompts()).toEqual(['jump']);
expect(showPrompt(game.prompts, 'jump')).toBe(false);
```

- [ ] **Step 5: Implement prompt initialization and stable export**

Pass completed prompts into `createPromptState`. Export a sorted array in stage prompt order (`jump`, `wallJump`, `dash`) so save output is deterministic.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run tests/game/game-save.test.ts tests/game/game.test.ts tests/ui/prompts.test.ts`

Expected: PASS.

Commit: `feat: snapshot and restore tower runs`

---

### Task 4: Application controller and autosave policy

**Files:**
- Create: `src/app/controller.ts`
- Test: `tests/app/controller.test.ts`

**Interfaces:**
- Produces `Screen`, `SettingsOrigin`, `AppNotice`, and `AppController`.
- Consumes `SaveStore`, `Game`, `RunSave`, `Mode`, and `Settings`.
- Key methods: `openModeSelect()`, `newRun(mode)`, `continueRun(mode)`, `pause(reason)`, `resume()`, `restart()`, `quitToTitle()`, `openSettings()`, `closeSettings()`, `afterStep(result)`, and `advanceRealTime(dt)`.

- [ ] **Step 1: Write failing screen-transition tests**

```ts
const app = makeController();
expect(app.screen).toBe('title');
app.openModeSelect();
app.newRun('normal');
expect(app.screen).toBe('playing');
app.pause('escape');
expect(app.screen).toBe('paused');
app.openSettings();
app.closeSettings();
expect(app.screen).toBe('paused');
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/app/controller.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement state transitions and confirmations as intents**

The controller exposes `pendingConfirmation: null | { kind: 'newRun' | 'restart'; mode: Mode }` plus `confirm()` and `cancelConfirmation()`. This keeps confirm UI out of controller logic. Settings remember whether they opened from Title or Pause.

- [ ] **Step 4: Write failing save-policy tests**

Test that:

- a newly activated Normal checkpoint writes immediately;
- a Hard run writes at 5.0 seconds but not 4.99 seconds;
- pause and quit write either mode;
- prompt completion and best height update their save slices;
- `continueAvailable(mode)` reflects validated snapshots;
- invalid Continue restoration clears only that run and returns to Mode Select with a notice.

- [ ] **Step 5: Implement save policy**

`advanceRealTime(dt)` accumulates only while playing a Hard run and performs one snapshot write whenever the accumulator reaches five seconds, retaining fractional remainder. `afterStep` compares checkpoint section and completed prompts against last persisted values before writing.

- [ ] **Step 6: Write failing auto-pause and timer-freeze tests**

Verify blur/hidden pause only from Playing, repeated pause is idempotent, and `controller.step(input, cameraY)` returns no game step while not Playing.

- [ ] **Step 7: Implement gated stepping and auto-pause**

Expose `step(input, cameraY)` as the only caller of `Game.step`. It returns `null` in menus, ensuring physics and run elapsed time freeze.

- [ ] **Step 8: Verify and commit**

Run: `npx vitest run tests/app/controller.test.ts tests/core/save.test.ts tests/game/game-save.test.ts`

Expected: PASS.

Commit: `feat: add menu and run lifecycle controller`

---

### Task 5: Semantic menu overlay and settings controls

**Files:**
- Modify: `index.html`
- Create: `src/ui/menu.ts`
- Create: `src/ui/menu.css`
- Test: `tests/ui/menu.test.ts`

**Interfaces:**
- Produces `MenuView` with `render(model)`, `showNotice(message)`, `beginBindingCapture(action, slot)`, and `destroy()`.
- Consumes a serializable `MenuModel` from `AppController` and emits a discriminated `MenuAction` callback.

- [ ] **Step 1: Write failing DOM-structure and action tests**

Use a minimal fake document rather than adding jsdom. Test pure helpers first:

```ts
expect(menuButtons({ screen: 'title', ...model })).toEqual(['play', 'settings']);
expect(menuButtons({ screen: 'modeSelect', canContinueNormal: true, ...model })).toContain('continue-normal');
expect(settingsRows(DEFAULT_SETTINGS)).toHaveLength(10);
```

Test action parsing for Play, Back, Continue, New Run, Pause actions, sliders, toggles, reset, confirmation, and binding slots.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/ui/menu.test.ts`

Expected: FAIL because menu helpers do not exist.

- [ ] **Step 3: Implement pure menu models and semantic DOM rendering**

Add `<div id="menus"></div>` and `<div id="notice" role="status" aria-live="polite"></div>` beside the canvas. `MenuView` renders headings, labeled buttons, range inputs, checkboxes, and binding buttons. It restores focus to the first enabled control after screen changes and traps focus within an open overlay.

- [ ] **Step 4: Implement key capture**

Capture listens only while a binding button is armed. Modifier-only keys are ignored, `Escape` cancels, blur cancels, and any accepted `KeyboardEvent.code` emits `{ type: 'replaceBinding', action, slot, code }`.

- [ ] **Step 5: Style the responsive overlays**

Use a centered `.menu-panel` with translucent `#0d1714`, `#c4dea0` borders, cream text, and `clamp()` sizing. Define clear `:focus-visible`, disabled, capture, card, slider, toggle, confirmation, and notice states. On narrow screens, stack mode cards and allow the settings panel to scroll internally.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run tests/ui/menu.test.ts && npm run typecheck && npm run build`

Expected: all commands PASS.

Commit: `feat: add title pause and settings menus`

---

### Task 6: Integrate screen flow with the browser loop

**Files:**
- Modify: `src/main.ts`
- Modify: `src/core/camera.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/room-draw.ts`
- Test: `tests/core/camera.test.ts`
- Modify: `tests/render/effects.test.ts`

**Interfaces:**
- Consumes `AppController`, `MenuView`, and `Settings`.
- Produces `Camera.setShakeEnabled(enabled)` and reduced-effect burst helpers.

- [ ] **Step 1: Write failing presentation-policy tests**

```ts
const camera = new Camera(960, 540, 960, 4900);
camera.setShakeEnabled(false);
camera.shake(8, 1);
camera.updateShake(0.1);
expect(camera.offsetX).toBe(0);

expect(effectiveBurstCount(9, true)).toBe(4);
expect(effectiveParticleLimit(true)).toBe(200);
```

- [ ] **Step 2: Verify RED, then implement effect policy**

Run: `npx vitest run tests/core/camera.test.ts tests/render/effects.test.ts`

Expected before implementation: FAIL for missing APIs. After implementation: PASS.

- [ ] **Step 3: Replace direct `Game` ownership in `main.ts`**

Create `SaveStore(window.localStorage)`, `AppController`, `MenuView`, and an `InputTracker` from saved bindings. Route menu actions to controller methods and settings updates. Rebind `player`, camera bounds, and interpolation state whenever the active game changes.

- [ ] **Step 4: Gate the fixed-step loop and input**

Sample gameplay input and call controller steps only when `screen === 'playing'`. Reset `lastMs`, the fixed-step accumulator, interpolation coordinates, and held inputs whenever entering or leaving Playing. `Escape` is reserved for pause/back/cancel capture before debug or gameplay handling.

- [ ] **Step 5: Add presentation camera rendering**

When no game is active or a title/menu is open, render Moss Ruins with a deterministic slow vertical camera drift and ambient particles, but do not call `Game.step`. Hide gameplay HUD, player, prompts, and debug overlay outside Playing/Pause as appropriate.

- [ ] **Step 6: Wire browser auto-pause**

Blur and hidden-tab handlers release input and call `app.pause('visibility')`. They preserve Title, Mode Select, Settings, and existing Pause. Resume always snaps the camera and clears frame time.

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`

Expected: PASS, with the application booting to Title instead of immediately simulating.

Commit: `feat: integrate paused application shell`

---

### Task 7: Synthesized audio and Moss Ruins ambience

**Files:**
- Create: `src/audio/audio.ts`
- Test: `tests/audio/audio.test.ts`

**Interfaces:**
- Produces `AudioBackend` abstraction and `AudioManager` methods `unlock()`, `setVolumes(master, sfx)`, `play(event, detail?)`, `setAmbience(state)`, and `dispose()`.
- Events: `'uiMove' | 'uiConfirm' | 'jump' | 'wallJump' | 'dash' | 'land' | 'checkpoint'`.
- Ambience states: `'off' | 'paused' | 'moss'`.

- [ ] **Step 1: Write failing lifecycle and routing tests with a fake backend**

```ts
const audio = new AudioManager(fakeBackend());
expect(audio.play('jump')).toBe(false);
await audio.unlock();
expect(audio.play('jump')).toBe(true);
audio.setVolumes(0.5, 0.25);
expect(backend.masterGain).toBe(0.5);
expect(backend.sfxGain).toBe(0.25);
```

Also assert unlock failure stays silent, repeated unlock is idempotent, master zero suppresses voices, landing detail changes synthesis parameters, and ambience state changes create/fade/stop exactly one loop.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/audio/audio.test.ts`

Expected: FAIL because the audio module does not exist.

- [ ] **Step 3: Implement the backend abstraction and silent-safe manager**

The browser backend wraps `AudioContext`, gain nodes, oscillators, buffer sources, and automation. The manager catches construction, resume, and voice errors once and becomes a no-op afterward.

- [ ] **Step 4: Implement synthesized voices**

- Jump: short rising sine.
- Wall jump: rising triangle plus a quiet noise tick.
- Dash: fast filtered noise sweep.
- Land: low sine/noise thump with gain based on clamped impact speed.
- Checkpoint: two gentle ascending sine notes.
- UI move/confirm: very short soft ticks.
- Moss ambience: looping generated noise through a low-pass filter plus a low oscillator, both below SFX level.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/audio/audio.test.ts && npm run typecheck`

Expected: PASS.

Commit: `feat: add synthesized game audio`

---

### Task 8: Connect saves, settings, prompts, and audio to live play

**Files:**
- Modify: `src/main.ts`
- Modify: `src/app/controller.ts`
- Modify: `src/game/game.ts`
- Modify: `tests/app/controller.test.ts`
- Modify: `tests/game/game-save.test.ts`

**Interfaces:**
- Consumes all earlier modules.
- Produces one integrated browser flow with no new public subsystem.

- [ ] **Step 1: Write failing integration tests for persistent events**

Test controller behavior for a real `Game` and in-memory store:

- checkpoint activation writes a Normal snapshot;
- performing the active prompt writes completed prompts once;
- a Hard snapshot resumes exact velocity;
- settings updates immediately change saved settings and controller model;
- best height only improves, never regresses.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/app/controller.test.ts tests/game/game-save.test.ts`

Expected: FAIL on unconnected persistence events.

- [ ] **Step 3: Connect gameplay events to controller persistence**

Extend `GameStepResult` with `promptCompleted: PromptId | null`. Compare the run's `bestY` and checkpoint after each step. Keep write deduplication inside the controller so ordinary frames do not touch storage.

- [ ] **Step 4: Connect audio and live preferences in `main.ts`**

Call `audio.unlock()` from the first menu/game user gesture. Map `StepEvents`, checkpoint activation, and menu actions to audio events. Set ambience to Moss while Playing, duck it while Paused, and turn it off on Title/Mode Select. Apply volume, shake, bindings, and reduced effects immediately when settings change.

- [ ] **Step 5: Add the one-time persistence notice**

Render `SaveStore.notice` through the ARIA status notice once per session. Do not repeatedly surface the same storage or audio failure.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run build && git diff --check`

Expected: all commands PASS.

Commit: `feat: connect persistent menus and audio`

---

### Task 9: Browser walkthrough, documentation, and milestone closeout

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/superpowers/plans/2026-09-15-m3-menus-saving-settings-sound.md`

**Interfaces:**
- No new code interfaces; this task validates the complete milestone.

- [ ] **Step 1: Run fresh automated verification**

Run each command from a clean shell and record exact totals:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

- [ ] **Step 2: Complete the browser walkthrough**

Verify in order:

1. Fresh load opens Title over a moving tower backdrop.
2. Play opens Mode Select; both New Run actions work.
3. A Normal checkpoint survives reload and Continue resumes there.
4. A Hard position/velocity survives a five-second autosave and reload.
5. `Escape`, blur, and hidden tab pause without advancing the timer.
6. Restart confirmation, Quit to Menu, and Continue visibility are correct.
7. Settings persist both bindings per action, conflict swaps, volumes, shake, and reduced effects.
8. Keyboard focus is visible and every menu works without a mouse.
9. Every implemented sound plays, volume changes are live, mute is silent, and Pause ducks ambience.
10. Corrupt localStorage is discarded with one notice and the game still starts.

- [ ] **Step 3: Fix any walkthrough defects with their own red-green cycle**

For each logic defect, add the smallest failing Vitest case before changing production code. For rendering/audio-only defects, record the reproduction in the commit message and re-run the affected walkthrough step after the change.

- [ ] **Step 4: Update project handoff and plan checkboxes**

Document Milestone 3 status, controls, save semantics, settings, audio behavior, exact test count, and the remaining Milestone 4/5 work. Mark completed plan steps only after their evidence exists.

- [ ] **Step 5: Final verification and commit**

Run: `npm test && npm run typecheck && npm run build && git diff --check && git status --short --branch`

Expected: all verification commands PASS; only intended documentation changes remain before commit.

Commit: `docs: record milestone 3 completion`

Push `main`, confirm `git status --short --branch` reports `main...origin/main`, and leave the local preview running for user playtesting.
