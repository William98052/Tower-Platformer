# Handoff: Tower Platformer

A note for the next agent picking up this project. Read this first, then the design spec.

## What this is

A 2D, minimalist, "Tower of Hell"-style vertical platformer that runs in the browser. The player climbs one long, continuous tower of 10 themed stages that get harder the higher you go.

It has two difficulty modes:
- **Normal:** checkpoints.
- **Hard:** no checkpoints, and a fall can drop you all the way to the ground.

- **Repo:** `git@github.com:William98052/Tower-Platformer.git`, branch `main`.
- **Design spec (source of truth):** `docs/superpowers/specs/2026-09-14-tower-platformer-design.md`
- **Milestone 1 plan (done):** `docs/superpowers/plans/2026-09-14-m1-movement-feel.md`. Its end has "Implementation notes: agreed deviations" and a "Deferred" list.
- **Milestone 2 plan (implemented):** `docs/superpowers/plans/2026-09-15-m2-moss-ruins.md`.

## Current status

**Milestone 2 (Moss Ruins) is implemented on `main`.** Automated and visual QA are complete; the remaining check is the user's end-to-end feel playtest of the full seven-section climb.

The game now boots into the real **Moss Ruins** stage with:
- all 7 fixed, hand-built sections
- normal, one-way, vine, bouncy, and slope surfaces
- animated bouncy mushrooms and section-limited entity activation
- Normal checkpoints and fall respawns
- Hard mode knockback, stun, and invulnerability rules
- timer, falls, tower progress, stage label, stage banner, and move prompts
- debug noclip, mode toggle, slow motion, and section warp
- the complete Milestone 1 movement set:
  - run and a variable-height jump
  - wall slide and wall jump
  - an 8-direction dash
  - camera follow with fall lead and shake
  - particles, squash and afterimages
  - debug overlay

It's tested: **211 Vitest tests pass**, the typecheck is clean, and `npm run build` works. Visual inspection covered the bottom, middle, and finale sections; prompts, banner, checkpoints, Normal/Hard display, noclip, mode toggle, and section warp worked.

Recent changes driven by the user:
- **The vine shafts now use clean edge-to-edge joins.** The checkpoint floor runs directly into each pair of vine walls, exit ledges start at the outside wall edge, and the redundant ledge before the first wall-jump checkpoint was removed.
- **Moss Ruins was visually and structurally revised.** The seven sections now have one classified main route with aligned section handoffs; the only recovery ledge is dimmed and reconnects to the route. The awkward triangular slope solids were removed in favor of stepped stone platforms. The background now uses larger arches, columns, roots, light shafts, and mist for clearer depth.
- **Wall jumps were too hard.** The wall-jump pillar in the test room was widened and joined to the exit platform (`50b86a7`).
- **Stamina was built and then removed at the user's request**, because it made wall hops impossible. It lost the dash refill you get from sliding on a new wall.
  - The work is kept on the **local-only** branch `stamina-shelved` (commits `ef8869f` and `79b8d81`, not pushed).
  - The spec marks stamina as "deferred". If it comes back, keep the refill from sliding on a new wall.
- **Move prompts are implemented in-run.** Their completed state is deliberately not persisted yet because save data belongs to Milestone 3.

## Next up

1. Have the user play the full Moss Ruins climb in Normal and tune any jumps, gaps, checkpoint positions, or prompts that feel wrong.
2. After that feel pass, start **Milestone 3: menus, saving, settings, and sound**.

Milestone 3 should persist Normal/Hard runs, records, settings, and completed move prompts. The current prompt completion set only lives for the browser session.

Later milestones:
- **M3:** menus, saving, settings, sound
- **M4:** stages 2–10
- **M5:** balancing, performance and the win screen

A level randomizer is explicitly **later**. The user wants fixed, hand-built layouts first.

## How to run

```bash
npm install
npm run dev          # Vite dev server (the .claude/launch.json "dev" config uses port 5173)
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run build        # tsc --noEmit && vite build
```

- **Versions:** TypeScript 5.9, Vite 8, Vitest 5, Node 25. Vitest's engines field doesn't list Node 25, but it works.
- **Controls:**
  - Move: arrows or WASD
  - Jump: Space or C
  - Dash: Shift or X
  - Respawn: R
  - Debug overlay: `` ` ``
  - Slow motion: T (0.25×)
  - Noclip: N
  - Toggle Normal/Hard: M
  - Previous/next section: `[` / `]`

## Architecture in brief

- `src/core/`
  - `constants.ts`: every tuning number
  - `loop.ts`: `FixedStep`, a 120 Hz accumulator with a 0.25 s clamp
  - `input.ts`: `InputTracker` edge detection, gamepad support, `withoutPresses` for the second and later steps in a frame
  - `camera.ts`: exponential follow, eased fall lead, shake
- `src/physics/`
  - `aabb.ts` and `collision.ts`: axis-separated AABB (X then Y), ceiling corner nudge, one-way filtering, and slope sampling
  - `player.ts`: `stepPlayer`. Its order is:
    1. tickTimers
    2. dash start/update, otherwise horizontal movement + gravity
    3. tryJump
    4. jump cut
    5. moveAndResolve
    6. refillDash
- `src/stages/types.ts`, `world.ts`: data contracts, local-to-world stacking, validation, and camera ±1-section activation.
- `src/stages/stage01-moss.ts`: all seven Moss Ruins section definitions.
- `src/entities/`: entity interface, mushroom, prompt trigger, and factory.
- `src/modes/`: Normal/Hard run state and pure mode rules.
- `src/game/game.ts`: gameplay orchestrator for world, player, entities, checkpoints, modes, prompts, banner, warps, and noclip.
- `src/render/`: parallax, surface/entity/checkpoint drawing, player drawing, and effects. Canvas 2D with no engine.
- `src/ui/`: HUD formatting/drawing, move prompts, and stage banner.
- `src/debug/overlay.ts`: debug readout, slow-motion, noclip/mode/warp commands.
- `src/main.ts`: thin browser wiring for resize/DPR, input, fixed-step loop, camera/effects, interpolation, and draw order.
- `tests/`: mirrors `src/`; the old test-room route tests remain as movement-regression coverage.

**Coordinates:** the logical view is 960×540, y points down, scaled by `scale × devicePixelRatio`.

**Collision preconditions** (tests rely on these):
- the box starts clear of solids
- it moves less than its own size per step
- solids use integer coordinates and are at least 12 thick

## Movement rules worth knowing (spec §3)

- **Jump:** coyote time 0.1 s, jump buffer 0.12 s, releasing early cuts the jump (×0.45), apex about 160 units.
- **Wall slide:** only while holding toward the wall, capped at 160 u/s.
- **Wall jump:** 330 u/s away and 820 u/s up, with 0.15 s of reduced air control. The same wall side can't be wall-jumped again until you land.
- **Dash:** 720 u/s for exactly 18 physics steps with no gravity, keeping 60% of the speed at the end.
  - It has 1 charge. The charge refills on landing, and once per wall side per airtime while wall sliding.
  - A ground dash has a 0.4 s cooldown and ignores down-aim.
  - A neutral air dash against a wall goes away from the wall.
  - A jump cancels the dash.
- **Anti-exploit:** a single wall must never be climbable forever. There's a test for this. Keep it passing whenever you change dash or wall rules.

## How the user wants work done

- **TDD** for all game logic: failing test first, then code. Rendering is checked visually.
- **Commit and push directly to `main`.** No pull requests, no feature branches pushed.
- **Keep explanations simple.** The user once asked to "explain it simpler". Short, plain-language summaries.
- The user playtests by feel and gives direct feedback ("took me 8 tries", "just remove it"). Make tuning changes quickly, and shelve rather than delete work they reject.
- The visual style is a moody, flat look (ember forge, frost peaks, a glowing cube hero), more detailed than the reference and not copied. The spec's §6 covers it.
- End commit messages with the attribution trailer your harness gives you.

## Gotchas

- **Browser testing:** synthetic key presses from browser automation tools can arrive with an empty `e.code`, which the game ignores. Dispatch `KeyboardEvent`s with `code` set via JavaScript instead. Also release held keys between tests, or a "held" jump blocks the next press.
- **Hot reload:** the Vite dev server picks up local commits immediately. The user may be playtesting unpushed work.
- **Commit trailers:** some older commits carry a wrong model name. Fixing that needs a force-push to `main`; don't do it unless the user explicitly asks.

## Open offers (unanswered by the user; don't act without a yes)

- Delete the stale remote branch `origin/m1-movement-feel`, which is already merged.
- Fix the mis-attributed commit trailers (needs a force-push).
