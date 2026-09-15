# Tower Platformer — Design

**Date:** 2026-09-14
**Status:** Approved in brainstorming, pending spec review

A 2D, minimalist, "Tower of Hell"-style vertical platformer for the browser. The player climbs one long continuous tower of 10 themed stages that get harder the higher you go. Two difficulty modes: **Normal** (checkpoints) and **Hard** (no checkpoints, falls are real all the way to the ground).

---

## 1. Goals and non-goals

### Goals
- Movement that feels tight, responsive and smooth (the #1 priority).
- Flat, moody, atmospheric visuals with rich detail: parallax layers, glow, particles, animated hazards (see §6).
- 10 stages × 7 hand-built sections = **70 fixed sections**, each stage with its own signature obstacles; no repetitive flat-platform runs.
- Difficulty rises steadily with height.
- Target completion time: **~60–90 min** first clear on Normal, ~30–40 min experienced, ~15–20 min speedrun.

### Non-goals (explicitly later / out of scope)
- Section randomizer (the data format is designed so it can be added later — see §4.3).
- Touch / mobile controls.
- Online leaderboards, accounts, multiplayer.
- Composed music tracks (only generated SFX + ambient hum).

---

## 2. Tech and structure

- **Language / build:** TypeScript, bundled with **Vite**. No game engine.
- **Rendering:** HTML5 Canvas 2D.
- **Testing:** Vitest for logic (physics, collision, modes, save data).
- **Hosting:** static files (any static host / GitHub Pages).

### 2.1 Folder layout

```
src/
  main.ts            boot, canvas setup, scene switching
  core/              game loop, input (keyboard + gamepad), camera, save data, audio
  physics/           player controller, AABB collision, moving-platform riding
  entities/          one file per obstacle type
  stages/            stage01-moss.ts … stage10-eclipse.ts (layout data + theme)
  render/            backgrounds/parallax, particles, glow, player drawing, theme blending
  ui/                title, mode select, HUD, stage banner, pause, settings, records, win
  modes/             normal.ts, hard.ts (death/fall rules)
  debug/             debug overlay and cheats (dev builds only)
tests/               Vitest unit tests
```

### 2.2 Game loop

- **Fixed physics step at 120 Hz**, rendering every animation frame with interpolation between the last two physics states. Movement is identical on 60 / 120 / 144 Hz screens.
- Frame delta is clamped to 0.25 s to avoid a "spiral of death" after tab switches.
- The game auto-pauses when the tab is hidden.

### 2.3 View and world

- **Logical view: 960 × 540 units**, scaled to fit the window while keeping the aspect ratio. Letterbox bars are filled with the current theme's background color. The playable width is always 960, so every player sees the same layout.
- The world is **one continuous vertical tower**. Canvas coordinates use y-down; the displayed height is `groundY − playerY`.
- Tower height is approximately **45,000 units**: 70 sections averaging ~640 units tall.
- **Camera:** follows the player with smooth easing and a small look-ahead in the direction of vertical movement. It is clamped horizontally to the tower width.

---

## 3. Player movement

All numbers are **starting values to tune by feel**. Units: world units and seconds. Player hitbox: 28 × 28.

| Property | Value |
|---|---|
| Gravity | 2600 u/s² |
| Max fall speed | 1200 u/s (top-to-bottom fall ≈ 35–40 s) |
| Run max speed | 300 u/s |
| Ground accel / decel | 3000 / 3600 u/s² |
| Air accel | 2000 u/s² |
| Jump velocity | 900 u/s upward (≈155 u apex) |
| Variable jump | releasing jump while rising multiplies vy by 0.45 |
| Coyote time | 0.10 s |
| Jump buffer | 0.12 s |
| Wall slide max speed | 160 u/s |
| Wall jump | 330 u/s away from wall, 820 u/s upward, 0.15 s of reduced air control |
| Corner correction | up to 6 u nudge around ceiling and ledge corners |

### 3.1 Dash (8-directional)

- **Aiming:** arrow keys / WASD pick one of 8 directions. With no direction held, the dash goes the way the player is facing.
- **Dash:** 720 u/s for 0.15 s, with diagonals normalized. Gravity is off during the dash. When it ends, the player keeps 60% of the dash velocity.
- **Air dash:** 1 charge. It refills when the player lands on the ground, grabs a wall, or touches a **dash-refill crystal**.
- **Ground dash:** 0.4 s cooldown.
- **Visual feedback:** afterimage trail, speed lines, a small screen nudge (respects the screen-shake setting), and the player's color dims while no charge is left.

### 3.2 Feel and juice

- Squash on landing (scaled by fall speed), stretch on jump.
- Dust puffs on land, jump, wall jump and turn-around.
- The cube has an eye that blinks and looks in the movement direction, plus a scarf that trails with velocity.

### 3.3 Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / aim | Arrows or WASD | Left stick / D-pad |
| Jump | Space (also W / Up) | A |
| Dash | Shift or X | X or RB |
| Pause | Esc | Start |

All keyboard keys can be rebound in Settings.

---

## 4. World data and entities

### 4.1 Stage and section data

Levels are **data, not code**:

```ts
interface StageDef {
  id: number;                 // 1..10
  name: string;               // "Ember Forge"
  theme: ThemeDef;            // palette, parallax layers, particles, ambient sound
  sections: SectionDef[];     // 7, bottom → top
}

interface SectionDef {
  height: number;             // world units
  checkpoint: { x: number; y: number };   // local coords; used by Normal only
  solids: SolidDef[];         // static platforms / walls (with a surface type)
  entities: EntityDef[];      // { type: 'pendulum', x, y, ...params }
}
```

- Section coordinates are local to the section. At load time, sections are stacked bottom to top into world space.
- **Surface types** on solids: `normal`, `ice` (low friction), `oneWay` (jump up through), `vine` (climbable), `bouncy`.

### 4.2 Entity interface

Every obstacle implements:

```ts
interface Entity {
  bounds(): AABB;                          // for activation and culling
  update(t: number, dt: number): void;
  draw(ctx: CanvasRenderingContext2D, t: number, alpha: number): void;
  collide(player: Player): CollisionResult; // solid / hazard / trigger / carry
  reset(): void;                            // back to initial state
}
```

- **Periodic movers** (pendulums, moving platforms, lasers, blinkers) compute their state as a pure function of the global clock `t`. Being skipped while off-screen has no effect, and they are always in the right place when they come into view.
- **Stateful entities** (crumbling platforms, sinking crates, seesaws, snowballs) call `reset()` when they move more than one section away from the camera.
- **Moving platforms carry the player:** the platform's frame delta is applied to a player standing on it before the player's own movement is resolved.

### 4.3 Activation (performance)

- Only sections overlapping the camera view, **±1 section**, are updated, drawn and collided. Everything else is idle.
- Cost is therefore constant regardless of tower height or fall distance.
- Randomizer hook (later): a generator only has to output `SectionDef`s. No engine changes are needed.

---

## 5. Stages

Each stage has **7 sections**:
- **Section 1** introduces the stage's signature obstacle safely.
- **Sections 2–6** combine it with earlier obstacles and escalate.
- **Section 7** is a harder finale.

| # | Stage | Signature obstacles | Difficulty |
|---|---|---|---|
| 1 | **Moss Ruins** | Bouncy mushrooms, slopes, climbable vines, one-way platforms; teaches jump, wall jump and dash | ★☆☆☆☆ |
| 2 | **Clockwork Hall** | Conveyor belts, rotating gear platforms you ride, pistons that shove, timed doors | ★★☆☆☆ |
| 3 | **Sunken Aqueduct** | Water volumes (swim: reduced gravity, jump to stroke up) with currents, crates that sink when stood on, turning water wheels | ★★☆☆☆ |
| 4 | **Ember Forge** | Swinging chain crushers, toggling fire jets, steam vents that launch upward, lava pools (hazard) | ★★★☆☆ |
| 5 | **Crystal Caverns** | Platforms that blink on a beat, timed laser beams, dash-refill crystals, dark rooms lit only around the player and crystals | ★★★☆☆ |
| 6 | **Wind Spire** (outside) | Wind zones that push, tilting seesaws, grabbable swinging ropes, barrel cannons that launch the player | ★★★★☆ |
| 7 | **Frost Peaks** | Ice surfaces, crumbling ice, icicles that fall when the player passes below, rolling snowballs | ★★★★☆ |
| 8 | **Storm Engine** | Toggling electric rails, magnet platforms (pull the player), saw blades on tracks, lightning strikes with a warning glow | ★★★★★ |
| 9 | **Void Observatory** | Gravity-flip fields, linked portals (velocity preserved), invisible platforms revealed by a periodic pulse, orbiting platforms | ★★★★★ |
| 10 | **Eclipse Summit** | Remix of all mechanics; from section 4 onward a **rising darkness** chases the player; the crown at the top ends the run | ★★★★★+ |

### 5.1 Difficulty levers (applied more with height)

- Narrower platforms and wider gaps.
- Faster hazards and tighter timing windows.
- More simultaneous mechanics (1 in Stage 1, 3–4 by Stage 9).
- Chained movement required (jump → wall jump → dash).
- Fewer safe rest spots.

### 5.2 Section design rules

- No section is only flat horizontal platforms. Every section uses at least one of: a wall-jump shaft, a moving ride, a dash gap through hazards, or a switchback route.
- Every hazard is readable before it is dangerous: warning glow, telegraph animation, or a visible motion path.
- Every section must be beatable on both modes (verified by the playtest checklist, §9).

### 5.3 Theme transitions

Between stages there is a ~600-unit blend zone where the palette, parallax layers, particles and ambient sound crossfade. There are no loading screens.

---

## 6. Visual style

**Reference:** the two user-provided screenshots (ember forge, frost mountains): flat, muted, atmospheric, a glowing cream cube hero. The approved detail level is the animated `visual-style-v3` mockup, which pushes further than the references.

- **3+ parallax layers per stage:** far silhouettes, mid-ground structures, and foreground particles.
- **Platforms:** themed bodies with a lit top edge, surface detail (rivets, snow bumps, icicles, cracks), and a soft fade into darkness below.
- **Lighting:** glow on hazards, checkpoints, the player and crystals; ambient gradient light from lava / sky.
- **Particles:** embers, snow, dust, water droplets, sparks; wind streaks.
- **Hazards animate constantly,** so they read as dangerous at a glance.
- **Performance:** static parallax layers are pre-rendered to offscreen canvases per theme. A **Reduced effects** setting disables shadow blur and halves particle counts.

---

## 7. Difficulty modes

### 7.1 Normal

- Every section starts with a **checkpoint flag** that lights up when touched and is saved immediately.
- Touching a hazard → instant respawn at the last lit flag, with a short burst effect and fade.
- Falling more than **one screen height (540 u) below the last lit flag** → respawn at that flag.
- Stateful entities in the current section reset on respawn. The rising darkness in Stage 10 resets to below the flag.

### 7.2 Hard

- **No checkpoints.** The whole tower is one continuous drop to the ground at the very bottom, which is the only safety floor.
- Touching a hazard → **knockback** (velocity away from the hazard: 400 u/s horizontal, 300 u/s up), **0.4 s stun** (no input) and **0.6 s invulnerability**. Usually this causes a fall.
- Lava and the Stage 10 darkness are hazards like any other: knockback, not respawn.

### 7.3 Shared stats

- **Timer:** runs only during gameplay.
- **Falls:** incremented on every hazard hit and every drop of 400+ units before landing.
- **Best height:** a faint line drawn on the tower wall at the highest point reached in this mode.

---

## 8. Screens, HUD and audio

- **Title:** the tower slowly scrolls behind the logo with ambient particles. Buttons: Play · Settings · Records.
- **Mode select:** Normal and Hard cards. A **Continue** button appears if a save exists for that mode.
- **HUD** (minimal):
  - Left edge: a thin vertical tower progress bar with 10 stage ticks and a player dot.
  - Top right: timer and falls.
  - Bottom left: a small persistent label with the current stage name.
- **Stage banner:** when the player enters a new stage for the first time in a run (or re-enters after falling into a lower one on Hard), the stage number and name **slide in from the side of the screen**. It holds for ~2.5 s, then slides out. Example: `STAGE 4` on one line, `EMBER FORGE` large beneath it.
- **Pause (Esc):** Resume · Restart · Settings · Quit to menu.
- **Win screen:** reaching the crown triggers a flash and particle burst, then shows time, falls, mode, and "New best!" when applicable.
- **Settings:** master / SFX volume, key rebinding, screen shake on/off, reduced effects.
- **Records:** best time, fewest falls and best height, per mode.
- **Audio:** sound effects synthesized with the Web Audio API (jump, land, dash, wall jump, checkpoint chime, hazard hit, crumble, win). There is also a quiet per-stage ambient loop, crossfaded in the blend zones. No audio files.

### 8.1 Save data (localStorage)

- **Settings:** volume, key bindings, shake, reduced effects.
- **Records:** per mode.
- **Normal run:** last lit checkpoint (stage, section), elapsed time, falls.
- **Hard run:** player position and velocity, elapsed time, falls. Saved every 5 s and on pause/quit.
- If localStorage is unavailable or corrupt, the game runs without saving and shows a small notice. Corrupt data is discarded, never crashes the game.

---

## 9. Error handling and edge cases

- **Tab hidden / window blur:** auto-pause.
- **Huge frame gaps:** delta is clamped (§2.2).
- **Window resize:** the canvas rescales, and the logical view stays 960 × 540.
- **Gamepad disconnect:** falls back to keyboard, no pause.
- **Player stuck inside a solid** (e.g. crushed by a piston): on Normal this counts as a hazard (respawn); on Hard the player is pushed out along the shortest axis, plus knockback.
- **Portal / gravity-flip edge cases:** velocity is preserved and remapped to the exit orientation, and there is a 0.1 s re-entry lockout.

---

## 10. Testing

- **Approach: test-driven development.** For all game logic (physics, collision, entities, modes, save data, stage data validation), the failing test is written first, then the minimal code to pass, then a refactor. Rendering and audio are verified visually and by ear, not unit-tested.
- **Stage data validation tests:** every `SectionDef` has a checkpoint inside its bounds, no overlapping solids at spawn, and entity params within allowed ranges.
- **Unit tests (Vitest):**
  - Jump apex height, variable jump, coyote time and jump buffer.
  - Wall jump, dash direction, dash refill rules.
  - AABB collision resolution, corner correction, moving-platform carry.
  - Normal respawn rules and Hard knockback rules.
  - Save / load round-trip and corrupt-save handling.
  - Periodic entity state as a function of `t`.
- **Debug mode** (dev builds):
  - Hitbox overlay, FPS / physics-step counter.
  - Free-fly noclip, warp to any stage / section, toggle modes.
  - Slow-motion time scale.
- **Playtest checklist** per section: beatable on Normal, beatable on Hard, hazards readable, no soft-locks, falls land somewhere sensible. Each item is ticked before a stage is considered done.
- **Performance check:** a steady 60 fps (target 120+) on a mid-range laptop at the busiest section of each stage, with Reduced effects off.

---

## 11. Build order (each step is playable)

1. **Movement feel:** test room with run, variable jump, wall slide / jump, 8-way dash, game feel and debug overlay.
2. **Stage 1 complete:** Moss Ruins art, parallax, all 7 sections, checkpoints, HUD, stage banner, both modes.
3. **Menus, saving, settings, sound.**
4. **Stages 2–10**, two at a time, each with its signature entities and a checked playtest checklist.
5. **Polish:** difficulty balancing across the full climb, performance pass, win screen and records.
