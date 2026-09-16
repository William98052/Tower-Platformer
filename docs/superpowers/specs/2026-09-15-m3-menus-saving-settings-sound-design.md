# Milestone 3: Menus, Saving, Settings, and Sound

## Goal

Turn the current immediately-playing Moss Ruins build into a complete browser-game shell. The player can start or continue either difficulty mode, pause safely, change persistent settings, rebind both keyboard alternatives for each action, hear synthesized effects and ambience, and recover gracefully when browser storage or audio is unavailable.

Milestone 3 stores record data but does not add a Records screen or win screen. Those remain Milestone 5. Stages 2–10 remain Milestone 4.

## Screen flow

The application owns one explicit screen state:

```ts
type Screen = 'title' | 'modeSelect' | 'playing' | 'paused' | 'settings';
```

- **Title:** the Moss Ruins tower drifts slowly behind the logo. Buttons: Play and Settings.
- **Mode select:** Normal and Hard cards. Each card has New Run. Continue appears only when that mode has a valid saved run. Back returns to Title.
- **Playing:** the existing game, HUD, prompts, banner, and debug tools.
- **Paused:** Resume, Restart, Settings, and Quit to Menu. `Esc` toggles pause and resume.
- **Settings:** master volume, SFX volume, two keyboard bindings per action, screen shake, reduced effects, and Reset Defaults. Settings opened from Pause return to Pause; settings opened from Title return to Title.

Restart creates a fresh run in the selected mode after a confirmation. Quit saves the current run and returns to Title. New Run replaces that mode's existing run after a confirmation when a save exists.

The simulation and run timer advance only in `playing`. Opening a menu releases held input and resets frame timing, so resuming cannot create a large physics step. Window blur or a hidden tab changes `playing` to `paused`; it does nothing when already in a menu. A disconnected gamepad falls back to keyboard without pausing.

## UI approach

Menus are semantic HTML overlays above the existing canvas. The canvas remains the visual backdrop and continues rendering a presentation camera while on Title or Mode Select, but gameplay simulation is stopped. HTML is used because sliders, buttons, focus, labels, and key capture are more reliable and accessible than custom canvas controls.

The overlay follows the game's moody flat style: dark translucent stone panels, moss-green edges, warm cream text, and restrained glow. It supports mouse and keyboard navigation. Focus is visibly outlined, `Enter`/`Space` activate buttons, and `Escape` backs out or pauses. The layout remains usable at narrow window sizes without changing the 960×540 logical game view.

## Application boundaries

Milestone 3 introduces four focused modules and keeps physics independent:

- `AppController` owns screen transitions, new/continue/restart/quit, auto-pause, and the active `Game` instance.
- `SaveStore` validates, loads, migrates, and writes versioned local data through an injected storage adapter.
- `SettingsStore` exposes validated settings and updates the live input, effects, and audio systems.
- `AudioManager` lazily creates a Web Audio graph after a user gesture and turns gameplay/UI events into synthesized sound.

`main.ts` remains browser wiring. It samples input only while playing, tells the controller about browser visibility and menu actions, advances autosave time, and renders either the presentation camera or active run. `Game` gains explicit snapshot/restore methods rather than knowing about `localStorage`.

## Save data

One versioned document is stored under a single namespaced localStorage key:

```ts
interface SaveDataV1 {
  version: 1;
  settings: Settings;
  completedPrompts: PromptId[];
  runs: {
    normal: NormalRunSave | null;
    hard: HardRunSave | null;
  };
  records: Record<Mode, {
    bestHeight: number;
    bestTime: number | null;
    fewestFalls: number | null;
  }>;
}
```

Normal saves contain the selected stage, last checkpoint section, elapsed time, and falls. Continue restores the player at that checkpoint. A Normal run saves immediately when a new checkpoint activates and on pause or quit.

Hard saves contain stage, player position and velocity, elapsed time, falls, and best height. Hard saves every five seconds while playing and on pause or quit. Continue restores the exact valid position and velocity. Coordinates, numeric values, mode, stage, and section references are range-checked before restoration.

Completed move prompts save immediately when a prompt is completed and are shared across modes. Settings save when changed. Best height updates per mode during play. Best time and fewest falls remain nullable until Milestone 5 supplies tower completion.

Writes replace the full small document. A failed write marks persistence unavailable for the session and shows one unobtrusive notice; play continues in memory. Missing storage starts with defaults. Invalid JSON, an unknown future version, or invalid fields are discarded safely and replaced with defaults. No storage error may prevent booting or pause gameplay.

## Settings and input rebinding

Settings defaults are:

- Master volume: 80%
- SFX volume: 100%
- Two keyboard bindings per action, matching the current Arrow/WASD and Space/C defaults
- Screen shake: on
- Reduced effects: off

Each action keeps exactly two keyboard codes. Selecting a binding enters capture mode; the next non-modifier key replaces that slot. `Escape` cancels capture. If the key is already bound elsewhere, the UI swaps the two bindings so one key never triggers conflicting actions. Reset Defaults restores every setting after confirmation.

`InputTracker` receives the current bindings and releases held keys whenever bindings or screen state change. Gamepad mappings remain fixed. Menu controls are separate from gameplay bindings so the player cannot make the menus unusable.

Screen shake off suppresses camera shake requests. Reduced effects disables shadow blur and halves particle burst counts and maximum live particles. These flags affect presentation only and never physics.

## Audio

Audio uses the Web Audio API with no media files. `AudioManager` creates its `AudioContext` only after the first user gesture, then routes sources through SFX and master gain nodes.

Milestone 3 includes short synthesized sounds for:

- jump
- wall jump
- dash
- landing, scaled gently by impact speed
- checkpoint activation
- pause/menu navigation and confirmation

Moss Ruins ambience is a quiet filtered noise and low oscillator bed. It fades in during play, lowers while paused, and stops on Title. The interface leaves a stage-ambience hook for Milestone 4 crossfades. Hazard, crumble, and win sounds are deferred until those events exist.

Audio failure is non-fatal. If Web Audio is unavailable or context startup fails, the game remains fully playable. Volume changes update live gain values. A master volume of zero avoids creating new audible voices.

## Error handling

- Storage unavailable or corrupt: use defaults/in-memory state and show one small notice.
- Invalid run snapshot: discard only that mode's run, preserving settings and the other mode.
- Audio unavailable: stay silent without repeated errors.
- Key capture loses focus: cancel capture and preserve the old binding.
- Tab hidden or window blurred during key capture: cancel capture, release input, and pause only if gameplay was active.
- Continue restoration intersects a solid after stage data changes: discard that run and return to Mode Select with a notice.

## Testing and verification

Game logic follows red-green-refactor TDD.

Automated tests cover:

- save/load round trips for Normal and Hard
- checkpoint-triggered Normal writes and five-second Hard autosaves
- corrupt JSON, unknown versions, invalid fields, unavailable storage, and isolated invalid-run removal
- snapshot restoration and solid-intersection rejection
- screen transitions, auto-pause, timer freezing, restart, quit, and Continue visibility
- settings defaults, validation, persistence, reset, and live effect flags
- two bindings per action, conflict swaps, capture cancellation, and input release
- completed prompt persistence and per-mode best-height persistence

Rendering and audio are verified manually:

- mouse and keyboard navigation through every screen
- visible focus and responsive layout
- menu background motion while gameplay remains paused
- every sound event, both volume sliders, mute, pause ducking, and unavailable-audio fallback
- screen-shake and reduced-effects toggles
- Normal and Hard continue flows after reload

Before completion, run the full Vitest suite, typecheck, production build, and a fresh browser walkthrough.

## Out of scope

- Records screen and win screen (Milestone 5)
- Stages 2–10 and multi-stage ambience crossfades (Milestone 4)
- Cloud saves, accounts, analytics, touch controls, localization, and controller rebinding
- Music or external audio assets
