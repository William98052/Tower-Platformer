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
