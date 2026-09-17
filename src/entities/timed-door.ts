import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';

type TimedDoorDef = Extract<EntityDef, { type: 'timedDoor' }>;
export type TimedDoorPhase = 'open' | 'closing' | 'closed' | 'opening';

const OPEN = 1.4;
const TRANSITION = 0.2;
const CLOSED = 1.2;
const CYCLE = OPEN + TRANSITION + CLOSED + TRANSITION;

interface TimedDoorState {
  phase: TimedDoorPhase;
  closedAmount: number;
}

export function timedDoorStateAt(t: number, phase: number): TimedDoorState {
  const shifted = t + phase * CYCLE;
  const time = ((shifted % CYCLE) + CYCLE) % CYCLE;
  if (time < OPEN) return { phase: 'open', closedAmount: 0 };
  if (time < OPEN + TRANSITION) {
    return { phase: 'closing', closedAmount: (time - OPEN) / TRANSITION };
  }
  if (time < OPEN + TRANSITION + CLOSED) return { phase: 'closed', closedAmount: 1 };
  return {
    phase: 'opening',
    closedAmount: 1 - (time - OPEN - TRANSITION - CLOSED) / TRANSITION,
  };
}

function doorBox(def: TimedDoorDef, closedAmount: number) {
  return {
    x: def.x,
    y: def.y - def.h * (1 - closedAmount),
    w: def.w,
    h: def.h,
    surface: 'normal' as const,
  };
}

export class TimedDoorEntity implements Entity {
  phase: TimedDoorPhase = 'open';
  private closedAmount = 0;
  private current: ReturnType<typeof doorBox>;
  private previous: ReturnType<typeof doorBox>;

  constructor(readonly def: TimedDoorDef) {
    const state = timedDoorStateAt(0, def.phase);
    this.phase = state.phase;
    this.closedAmount = state.closedAmount;
    this.current = doorBox(def, state.closedAmount);
    this.previous = { ...this.current };
  }

  bounds() { return this.current; }

  update(t: number, dt: number): void {
    const currentTime = Math.max(0, t);
    const previousState = timedDoorStateAt(Math.max(0, currentTime - dt), this.def.phase);
    this.previous = doorBox(this.def, previousState.closedAmount);
    this.setState(timedDoorStateAt(currentTime, this.def.phase));
  }

  dynamicSolids(): readonly DynamicSolid[] {
    if (this.closedAmount <= 0) return [];
    return [{
      box: this.current,
      delta: { x: this.current.x - this.previous.x, y: this.current.y - this.previous.y },
    }];
  }

  field(): FieldEffect | null { return null; }
  draw(): void {}
  collide(_player: Player): EntityContact { return { kind: 'none' }; }

  reset(): void {
    this.setState(timedDoorStateAt(0, this.def.phase));
    this.previous = { ...this.current };
  }

  private setState(state: TimedDoorState): void {
    this.phase = state.phase;
    this.closedAmount = state.closedAmount;
    this.current = doorBox(this.def, state.closedAmount);
  }
}
