# Handoff: Clockwork Hall + Sunken Aqueduct

Read this file first, then continue the active Milestone 4 plan. The user asked for continuous autonomous progress and prefers short, plain-language updates.

## Repository and workflow

- Repo: `/Users/william/p/Tower_Platformer`
- Branch: `main`
- Remote: `git@github.com:William98052/Tower-Platformer.git`
- Work directly in this checkout. Repository instructions authorize commits and pushes directly to `main`; do not open a PR or create a worktree.
- Use TDD for behavior and physics. Rendering-only changes require browser evidence.
- Commit messages need a co-author trailer for the agent that made them. Tasks 1–10 `bdc583f` used `Co-Authored-By: OpenAI Codex <noreply@openai.com>`; `c133030` (Claude) used `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Subagent usage limits have interrupted work several times. If an agent dies mid-task, check `git status` to see what actually landed before re-dispatching.
- Preview should remain available at `http://127.0.0.1:5173/` for the user.
- Node 25 prints a Vitest engine warning, but the suite works.

Authoritative files:

- Plan: `docs/superpowers/plans/2026-09-16-m4-clockwork-aqueduct.md`
- Design: `docs/superpowers/specs/2026-09-16-m4-clockwork-aqueduct-design.md`
- SDD ledger: `.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/progress.md`
- SDD workspace: `.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/`

The active workflow is `superpowers:subagent-driven-development`. For each task: make an explicit task brief, use a fresh implementer, create a review package, use an independent reviewer, send findings back to the original implementer for up to five fix rounds, then push only after Critical/Important findings are closed. Do not fix reviewer findings in the controller. The skill scripts are not executable directly, so invoke them with `bash` and pass explicit output paths.

## Exact current state (updated 2026-09-18)

Tasks 1–9 are complete, independently reviewed, and pushed to `origin/main`.

Task 10, the seven-section Sunken Aqueduct layout, is **still open**: it is committed locally but has not been accepted or pushed. Git state: `main...origin/main [ahead 2]`, plus this uncommitted `HANDOFF.md` edit.

- `bdc583f` `feat: build Sunken Aqueduct routes`: the original implementation.
- `c133030` `fix: make Sunken Aqueduct routes traversable`: fix round 1. Full suite 39 files / 423 tests passed; typecheck, build, and `git diff --check` were clean.
- Brief: `.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/task-10-brief.md`
- Report (includes "Fix round 1"): `.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/task-10-report.md`
- Reviewer probe scripts, which run real `Game.step`/`stepPlayer` bypass searches: `.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/task-10-probes/`. Run them with `npx vitest run --config .superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/task-10-probes/vitest.probe.config.mjs <name>`. They append results to `*.out` files in that folder.

### Task 10 review history

**Review 1** of `bdc583f` gave CHANGES REQUIRED. All of these are now fixed in `c133030` and were confirmed fixed by the re-review:

- C1: the Section 2→3 handoff was sealed, so the game could not be finished.
- I1: water volumes had no floor, so an idle player sank into lower sections and even into Clockwork.
- I2: the Section 5→6 handoff needed a precise dash.
- I2b: checkpoint runways were mostly under water.
- Minor: filler ledges, stacked Section 4 ledges, 17 units of wheel headroom, and fragment-only tests.

**Section 3 ruling (final): accepted.** The signature stays exactly `['sinkingCrate']`, and the section uses a collision recovery floor instead of a `WaterEntity`. Task 11 may draw a non-colliding decorative water surface there to honour the "pool" wording.

**Re-review of `c133030`:** CHANGES REQUIRED. No Critical findings remain; every handoff works, idle swimmers stay in their section, dry runways are 280 units or wider, and nothing is filler. Three **Important** findings are open.

The controller ruling for the Aqueduct: each section's defining mechanic must not be skippable by jump + air dash, or by jump + dash + wall-jump. Ordinary-jump-only gating is not enough.

1. **The Section 4 wheel can be skipped with a wall-jump.** The bank `platform(80, 345, 310)` in `src/stages/stage03-aqueduct.ts` (~line 69) leaves a 56-unit column at the left wall. From the floor at the wall: jump, up-dash at frame 12, wall-jump at frame 44, steer right. The player lands on the bank at y345 in both Normal and Hard. The comment at ~line 66 ("no jump or dash can reach") is wrong. The gate test (`tests/stages/stage03-aqueduct.test.ts` ~:484) never tries wall-jumps. Probes: `wall.probe.ts`, `gamewall.probe.ts`.
2. **Water sections can be skipped completely dry with jump + dash.**
   - Section 1: dry floor → bank at y460 (~lines 26-32).
   - Section 2: both canals: runway → (760,660), and (100,70) → (640,70) (~lines 49-50).
   - Section 6: both pools: → (190,480), and (610,380) → (610,200).

   The swim-requirement test (~:598) only tries ordinary jumps. Section 6's plan text is "swim channels alternating with dash landings": dash landings must be reachable from the water exits, but a dash must not replace the swim. Probes: `dashskip.probe.ts`, `dashskip2.probe.ts`.
3. **The Section 7 current and both crates can be skipped** with jump + up-dash from x=500 onto the bank `platform(360, 490, 200)` (~line 104), which overhangs the dry floor at x500–560. The reviewer's suggested fix is to gate it sideways by moving the bank over the water. Also remove the exemption comment in the test (~:495-498). Probes: `crate*.probe.ts`, `bypass.probe.ts`.

- **Minor:** the Section 1 bank at y460 (x400–640) hangs 156 units above the checkpoint spawn, so a jump at spawn bonks it. Nothing should hang over a checkpoint within jump height.
- **Ruled fine:** the crate sink delay measured 0.358 s, which matches the spec's 0.35 s plus one frame.

**Fix round 2 was dispatched but never started.** The implementer hit a weekly usage limit before changing any file, so the working tree has no gameplay changes.

Keep everything already passing: handoff searches, idle-sink safety, dry runways ≥280 with spawn ≥80 units from water, 52 units of wheel headroom across the full cycle, no filler, chained checkpoint→next-runway routes replayed through `Game.step`, and the exact section names, signatures, currents (±260, −420, +420), crate counts, and wheel counts. Change stage data and tests only, never physics constants or entity behaviour.

`HANDOFF.md` is modified by this user-requested handoff update. Preserve it; it will be finalized and committed during Task 12 unless the user asks to commit it earlier.

## Immediate next action

1. Run `git status --short --branch`. Expect `ahead 2` (`bdc583f`, `c133030`) plus the `HANDOFF.md` edit.
2. Dispatch a fresh implementer for **Task 10 fix round 2** with the three Important findings and the Minor finding above. Include the controller ruling and the "keep everything already passing" list. Require TDD: extend the gate and swim-requirement searches to jump + 8-direction dash at several timings, plus wall-jump chains from any wall next to a platform below each gate, and confirm they fail before changing the data. Commit title: `fix: gate Sunken Aqueduct mechanics against dash skips`. Append "Fix round 2" to the report.
3. Re-review only those findings with an independent reviewer, rerunning the probes in `task-10-probes/`. Allow at most five fix rounds in total; this would be round 2.
4. When no Critical or Important findings remain:
   - append the Task 10 review and fix results to the SDD ledger;
   - push `bdc583f..HEAD` to `origin/main`;
   - keep the handoff edit out of gameplay commits.
5. Continue Task 11 and Task 12 without pausing unless blocked.

Earlier Task 10 review package, for reference only; generate a new one for later ranges:


```bash
bash /Users/william/.codex/plugins/cache/openai-curated-remote/superpowers/6.3.0/skills/subagent-driven-development/scripts/review-package \
  /Users/william/p/Tower_Platformer/docs/superpowers/plans/2026-09-16-m4-clockwork-aqueduct.md \
  d8e503b bdc583f \
  /Users/william/p/Tower_Platformer/.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/review-d8e503b..bdc583f.diff
```

## Completed Milestone 4 work

### Task 1 — Continuous tower model

- Commit `b11286d`
- Introduced the continuous ordered tower/world representation.
- 261 tests passed; reviewed and pushed.

### Task 2 — Stage-relative V2 saves

- Commits `73688e8`, `d82c603`
- Migrated saves atomically so Continue remained usable.
- 268 tests passed; reviewed and pushed.

### Task 3 — Cross-stage game state/UI

- Commit `93dfc1b`
- Added global stage/section state, banners, checkpoint behavior, HUD, and debug support.
- 282 tests passed; reviewed and pushed.

### Task 4 — Reusable world interactions

- Commits `5d19220`, `17e5da2`
- Added dynamic solids, carry/push/hazard contracts, and field sampling.
- Important ordering: moving-platform carry now precedes environment sampling.
- 296 tests passed; reviewed and pushed.

### Task 5 — Clockwork mechanics

- Commits `1faa5b9`, `d1d74ce`
- Added conveyors, gears, pistons, and timed doors with deterministic `t`/`t-dt` deltas and finite validation.
- 320 tests passed; reviewed and pushed.

### Task 6 — Clockwork Hall layouts

- Commits `e11ae4c`, `43888e0`, `11f22b1`, `8396fec`
- Seven continuous sections with real production-physics traversal tests.
- Fixed all shortcut and impossible-transfer findings. The first Machine Climb gate is 25.5 units above the measured jump apex, and a broad reachability search reproduces/rejects the former bypass.
- 333 tests passed; reviewed and pushed.

### Task 7 — Clockwork presentation/audio

- Commits `71ed8cf`, `b6da59c`
- Added exact 600-unit Moss→Clockwork theme blending, Clockwork rendering, animated belts, machinery telegraphs, warning lamps, synthesized SFX, and gain-based ambience crossfade.
- Fixed ghost-prone compositing and made door warning occur 0.2 seconds before motion.
- 348 tests passed; all sections 7–13 were browser-checked in Normal/Hard, with a post-fix Section 7 spot check at 145 FPS and no console issue.
- One accepted Minor: semi-transparent recovery/boundary solids can be slightly more opaque at the blend midpoint. Main-route solids/backgrounds are exact.
- Reviewed and pushed.

### Task 8 — Water movement/currents

- Commits `f626e26`, `6f1893e`
- Added water fields, exact submerged gravity/drag/fall cap, fresh-press strokes, overlap/current aggregation, and safe dry/wet exits.
- Fixed ordering so platform carry occurs before water sampling and water drag applies before control acceleration.
- 370 tests passed; reviewed and pushed.

### Task 9 — Crates/water wheels

- Commits `3e9b718`, `d8e503b`
- Added deterministic sinking crates and four-paddle rideable water wheels.
- Coverage includes all four paddle deltas/carry directions, integrated `Game.step` rider behavior, blockers, resets, and finite normalized wheel phase validation.
- 393 tests passed; reviewed and pushed.

## Remaining Task 11

Task 11 is Aqueduct rendering, ambience, effects, and audio. Generate its brief with:

```bash
bash /Users/william/.codex/plugins/cache/openai-curated-remote/superpowers/6.3.0/skills/subagent-driven-development/scripts/task-brief \
  /Users/william/p/Tower_Platformer/docs/superpowers/plans/2026-09-16-m4-clockwork-aqueduct.md \
  11 \
  /Users/william/p/Tower_Platformer/.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct/task-11-brief.md
```

Required Task 11 results:

- exact Clockwork→Aqueduct blend weights at bottom/midpoint/top of the 600-unit zone;
- equal Clockwork/Aqueduct ambience gain at midpoint and full replacement above it;
- teal arches, oxidized trim, light shafts, plants, bubbles, waterfalls, and mist;
- animated water surface/tint/reflection, directional bubbles, and clipped contents;
- Reduced Effects changes visuals only, never water collision bounds;
- crate waterline/sink trail and complete wheel/paddle rendering;
- synthesized `splash`, `swimStroke`, `crate`, and `wheel` sounds plus Aqueduct ambience;
- stage-sensitive particle palettes;
- splash events only on water-state edges;
- mute/live gain/pause ducking/backend-failure tests;
- browser inspection and independent review before push.

Expected commit title: `feat: present and score Sunken Aqueduct`.

## Remaining Task 12 and final closeout

Task 12 is the complete three-stage integration/browser QA/documentation pass. It must verify:

- fresh Normal run;
- Stage 2 and Stage 3 checkpoint Continue;
- Hard autosaves in all stages;
- reload around moving machinery;
- pause timer gating and quit/continue visibility;
- V1 migration, corrupt V2 fallback, and unavailable-storage notice;
- every Clockwork section (global 7–13) in both modes;
- every Aqueduct section (global 14–20) in both modes;
- no useless collision platforms, soft locks, unreadable telegraphs, or impossible jumps;
- strokes require presses, currents are visible, crates recover, wheels carry, and water exits are clean;
- all three themes, both blends, Reduced Effects, mute/live volume, and no browser console errors;
- at least 60 FPS in Clockwork 7 and Aqueduct 7.

Use TDD for any logic defect. For rendering/audio-only defects, record the reproduction and repeat the browser check. Subjective audio timbre/listening is the one declared user check the agent cannot complete reliably.

After Task 12 implementation:

1. Run fresh full verification and record exact totals only after all commands exit 0.
2. Update this handoff and mark plan checkboxes only where evidence exists.
3. Run one final whole-branch review using `superpowers:requesting-code-review` from merge base `73ec1a9` to final HEAD. Use the best available reviewer; earlier `gpt-6-astra` workers hit usage limits, so `gpt-5.6-sol` high is an acceptable fallback.
4. Allow at most one final fix wave, then scoped re-review.
5. Use `superpowers:verification-before-completion` and `superpowers:finishing-a-development-branch`. Adapt the latter to the repository's explicit direct-`main` workflow.
6. Delete only this plan's `.superpowers/sdd/2026-09-16-m4-clockwork-aqueduct` workspace after final review/recording.
7. Push final docs and leave `main...origin/main` clean.

Expected final documentation commit title: `docs: record Clockwork and Aqueduct completion`.

## User's level-design priorities

Treat these as acceptance criteria, not suggestions:

- No impossible wall jumps or machinery transfers.
- Keep wall-jump shafts short and ordinary.
- No platforms underneath checkpoints unless they serve a clear recovery purpose.
- No useless jumps, filler platforms, dead paths, or branches leading nowhere.
- Platforms should meet cleanly and should not look shoved into each other.
- Checkpoints belong on broad, flat, safe areas.
- Routes should read continuously from bottom to top.
- The two new stages should feel continuous with Moss Ruins, without portals or loading screens.

Do not request or use Apple Music, Spotify, or any unrelated plugin. A prior accidental access request confused the user; this project uses synthesized Web Audio only.

## Run and control reference

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
git diff --check
```

Controls:

- Move: arrows or WASD
- Jump / swim stroke: Space or C
- Dash: Shift or X
- Pause: Escape
- Respawn: R
- Debug overlay: backquote
- Slow motion: T
- Noclip: N
- Toggle Normal/Hard: M
- Previous/next section: `[` / `]`

The in-app browser currently has the local preview open. During the last spot check, the saved Normal run resumed in Clockwork Section 7 and the debug overlay was enabled; no save was replaced.
