# Milestone 4 Batch 1: Clockwork Hall and Sunken Aqueduct Design

**Status:** Approved in conversation on 2026-09-16  
**Scope:** Continuous-tower foundation plus complete Stages 2 and 3  
**Source of truth:** This document refines Stage 2 and Stage 3 from `2026-09-14-tower-platformer-design.md`.

## 1. Goal

Extend the game from one isolated stage into one continuous three-stage tower and add two complete seven-section stages:

- Stage 2, **Clockwork Hall**: conveyors, rotating gear rides, shoving pistons, and timed doors.
- Stage 3, **Sunken Aqueduct**: swimmable water, visible currents, sinking crates, and rideable water wheels.

The result remains one uninterrupted climb. There are no portals, loading screens, or stage-select interruptions. A Hard-mode player can fall from Aqueduct through Clockwork and into Moss Ruins.

This batch does not build Stages 4–10, the final win flow, or records UI. It does establish reusable moving-solid, field-volume, stage-transition, rendering, audio, and save foundations for later stages.

## 2. Continuous tower model

Add a `TowerDef` containing ordered `StageDef[]`. `buildWorld` consumes the tower and stacks every stage and section bottom-to-top. Moss Ruins remains Stage 1 at the bottom, Clockwork Hall is Stage 2, and Sunken Aqueduct is Stage 3.

Each `WorldSection` records:

- `globalIndex`: unique bottom-to-top checkpoint and activation index.
- `stageId`, `stageName`, and the stage theme.
- `localSection`: `0..6` within its stage.
- translated solids, entities, checkpoint, top, and bottom.

Gameplay uses `globalIndex` for activation, respawning, debug warping, and checkpoint comparisons. Presentation uses the stage metadata. Stage-local section IDs are never treated as globally unique.

The player's current stage is derived from the current world section. Crossing into a different stage triggers that stage's banner. Falling back into a lower stage in Hard mode triggers its banner again.

## 3. Saves and migration

Save storage advances from document version 1 to version 2 under a new storage key. Version 2 run snapshots identify a location with `stageId` and `localSection`; Hard snapshots additionally keep position and velocity in coordinates relative to the bottom of their stage. Run snapshots store `bestHeight` as distance climbed from the tower floor instead of a top-origin `bestY`. These choices keep saves stable when later stages are added above the current tower.

On first load, a valid version 1 save is migrated:

- Settings, completed prompts, and records are preserved.
- Normal Moss Ruins checkpoints become Stage 1 plus the saved local section.
- Hard Moss Ruins `x`, `y`, `vx`, and `vy` are translated into Stage 1-relative coordinates, `bestY` becomes floor-relative `bestHeight`, and the result is validated against the new world.
- Invalid individual runs are cleared without discarding valid settings or the other mode.
- The version 1 key is removed only after the version 2 document is written successfully. If that write fails, the in-memory migrated save remains available for the session.

Run restoration rejects unknown stages, invalid local sections, out-of-bounds positions, and positions overlapping a solid or active dynamic solid.

## 4. Reusable interaction model

The current entity contract grows into three explicit interaction sources while retaining `bounds`, `update`, `draw`, and `reset`:

1. **Dynamic solids** provide their current collision rectangle and frame displacement. They participate in player collision before static resolution and carry a standing player.
2. **Hazard/push contacts** report either a normal hazard hit or a non-damaging shove vector. Pistons use shove; later lethal mechanics can use hazard.
3. **Field volumes** modify the player's environment while overlapped. Water and currents use this path.

The game update order becomes:

1. Update active entities from the deterministic global clock.
2. Gather active static and dynamic solids plus field volumes.
3. Apply standing-platform carry.
4. Sample environment effects and step the player.
5. Resolve dynamic contacts, shoves, launches, prompts, checkpoints, and hazards.
6. Update run state, particles, audio events, and saves.

Periodic machinery derives its transform from run elapsed time so leaving and re-entering a section cannot desynchronize it. Continue restores the same elapsed time and therefore the same machinery phase. Stateful crates reset when their section resets or moves outside the active range.

## 5. Stage 2 — Clockwork Hall

### 5.1 Look and sound

Clockwork Hall uses near-black iron, muted brass, warm amber edges, red-orange warning lamps, tall clock faces, rotating shafts, and drifting dust. Foreground sparks are sparse. Platforms show rivets and inset metal seams rather than Moss decoration.

The ambient loop adds a low mechanical drone, distant ticks, and soft gear pulses. Pistons and doors use a warning click before movement. Conveyor, gear, piston, and door states remain readable with audio muted.

### 5.2 Mechanics

**Conveyors**

- New solid surfaces: `conveyorLeft` and `conveyorRight`.
- A grounded player receives belt velocity without losing normal movement control.
- Intro belts move at 90 units/second; later belts use 160 units/second.
- Belt direction is shown by animated chevrons on the platform top.

**Rotating gear rides**

- A gear entity exposes broad rideable teeth/paddles around a marked axle.
- Its angle is a pure function of global time; introductory gears use a 6-second period and later gears use a 4-second period.
- The visible ring shows the entire path before the player commits.
- The ride carries a standing player using frame displacement.

**Pistons**

- Pistons rest for 1.2 seconds, warn for 0.5 seconds, extend over 0.18 seconds, hold for 0.3 seconds, and retract over 0.25 seconds.
- Contact shoves the player along the piston axis; it is not an instant hazard in Stage 2.
- A blocked player is pushed out along the shortest valid axis rather than embedded in geometry.

**Timed doors**

- Doors are dynamic solids that alternate between fully open and fully closed.
- Doors use a 3-second cycle: open for 1.4 seconds, transition for 0.2 seconds, closed for 1.2 seconds, and transition open for 0.2 seconds. A clock arc or row of lamps displays the cycle continuously.
- Every door sequence has a flat waiting area before it. No required landing occupies a door's closing space.

### 5.3 Seven-section route

Every section starts on a broad flat checkpoint runway and has one main route with no decorative collision platforms or dead ends.

1. **Conveyor introduction:** two slow belts and broad recovery floors teach belt momentum safely.
2. **Conveyor switchback:** alternating belt directions create readable left-right jumps with wide landings.
3. **Gear gallery:** two slow, large gear rides connect three fixed landings; their full paths are visible.
4. **Piston passage:** one horizontal and one vertical piston introduce warning and shove behavior with safe recovery below.
5. **Timed gate:** three doors share a readable phase sequence, with a safe waiting floor before each pair.
6. **Machine climb:** a conveyor feeds two gears and a short piston climb; at most two mechanics demand attention simultaneously.
7. **Clockwork finale:** fast conveyor launch, one large gear, two telegraphed pistons, and a final timed door form one continuous route.

## 6. Stage 3 — Sunken Aqueduct

### 6.1 Look and sound

Sunken Aqueduct uses deep teal stone, oxidized bronze, cyan water edges, broken arches, reflected light shafts, drifting plants, bubbles, and waterfall mist. Dry and submerged areas are visually distinct before entry.

The ambient loop crossfades to low water rumble, filtered drips, and bubbles. Entering water applies a brief filtered splash; strokes, currents, crates, and wheels receive quiet synthesized cues.

### 6.2 Mechanics

**Water volumes**

- Water is a visible rectangular field with an animated surface line and underwater tint.
- Gravity is reduced to 45%, downward speed is capped at 220 units/second, and horizontal velocity is multiplied by 0.96 per physics step before swim acceleration.
- Pressing Jump sets upward velocity to at least 420 units/second. Holding Jump does not repeatedly stroke; each press has a 0.22-second cooldown.
- Leaving water preserves capped exit velocity so surface exits are predictable.
- Water has no breath meter and cannot drown the player.

**Currents**

- A water volume may add a steady horizontal or vertical acceleration, capped at 260 units/second squared in introductory sections and 420 units/second squared in later sections.
- Bubbles, plants, and small debris move in the force direction, making it readable before entry.
- Intro currents lead toward safety. Later currents may oppose the route but never pin the player against a wall.

**Sinking crates**

- A crate is a stateful dynamic solid that begins floating.
- Standing on it starts a 0.35-second delay, followed by a 70-unit/second sink.
- It rises at 50 units/second after the player leaves or resets immediately with the section.
- A player can always swim away; crates cannot seal the only exit or create a soft lock.

**Water wheels**

- A wheel rotates with a 5-second period and exposes four broad rideable paddles.
- Paddles carry the player like Clockwork gear rides.
- The full circle remains visible, and adjacent stone landings overlap the safe dismount arc.

### 6.3 Seven-section route

1. **Swimming introduction:** a shallow pool teaches reduced gravity and press-to-stroke, with a large visible exit.
2. **Current channel:** two bubble-marked currents first assist, then gently oppose the route.
3. **Floating crates:** three crates introduce delayed sinking over a recoverable pool.
4. **Water-wheel chamber:** one large wheel and two broad paddles connect dry stone landings.
5. **Vertical aqueduct:** an upward current and two sinking crates create a controlled climb without a wall-jump shaft.
6. **Wet/dry switchback:** swimming channels alternate with dry dash platforms; transitions use broad flat landings.
7. **Aqueduct finale:** a strong readable current, two sinking crates, a water-wheel ride, and a final upward water jet lead directly to the checkpoint.

## 7. Stage transitions and presentation

The top 600 units of each stage form a visual blend into the next theme. Rendering samples the two nearest stage themes from camera position and interpolates colors, background opacity, particle mix, and ambience gains. Collision geometry does not change during a blend.

The HUD displays the current stage name and a ten-tick full-tower progress bar. The progress dot uses global height across the planned ten-stage tower; unbuilt stages remain empty ticks without inventing playable height. Stage banners use the current stage ID and name.

Dynamic solids and themed entities draw only in active sections. Reduced Effects halves ambient particles, removes expensive glow, and simplifies water reflections without changing obstacle timing or collision.

## 8. Checkpoints, modes, and failure behavior

- Normal mode activates each global section checkpoint and saves its stage plus local section immediately.
- Normal hazards respawn at the last checkpoint and reset stateful entities in that global section.
- Hard mode keeps no checkpoints; falls remain continuous through all three stages.
- Non-lethal piston and current pushes do not increment falls. Existing fall-distance rules still do.
- Dynamic-solid penetration is resolved before hazard logic. If no valid push-out exists, Normal respawns and Hard applies the existing knockback/invulnerability response.
- Every section entry and stage handoff uses a flat runway. Every final handoff is a single reachable jump or clearly powered mechanic, never a hidden filler platform.

## 9. Testing and acceptance

All gameplay logic follows red-green-refactor TDD.

Automated coverage includes:

- three-stage stacking, unique global indices, stage lookup, activation, and cross-stage debug warp;
- version 1 to version 2 save migration and partial-corruption isolation;
- Normal restore by stage/local section and Hard stage-relative coordinate restoration;
- deterministic conveyor, gear, piston, door, current, crate, and wheel behavior;
- moving-solid carry, shove resolution, water gravity/drag/strokes, and no-soft-lock recovery;
- all 14 new sections validating checkpoints, bounds, route classification, handoffs, and entity parameters;
- stage banner, HUD label, theme selection, ambience selection, and pause behavior across stage boundaries.

Browser playtesting checks every section in Normal and Hard for:

- one obvious route and no useless collision platforms;
- reachable jumps and powered transfers;
- clear telegraphs and visible motion paths;
- safe checkpoint areas and sensible fall recovery;
- stable Continue after reload in all three stages;
- smooth theme and ambience transitions;
- no console errors and steady 60 fps with Reduced Effects off.

The batch is complete only after the full automated suite, typecheck, production build, visual walkthrough, and per-section playtest checklist pass.
