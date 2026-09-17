import { overlaps } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { EntityDef } from '../stages/types';
import type { DynamicSolid, Entity, EntityContact, FieldEffect } from './entity';

type PistonDef = Extract<EntityDef, { type: 'piston' }>;
export type PistonPhase = 'resting' | 'warning' | 'extended' | 'retracting';

const REST = 1.2;
const WARNING = 0.5;
const EXTEND = 0.18;
const HOLD = 0.3;
const RETRACT = 0.25;
const CYCLE = REST + WARNING + EXTEND + HOLD + RETRACT;

interface PistonState {
  phase: PistonPhase;
  extension: number;
}

function cycleTime(t: number, phase: number, cycle: number): number {
  const shifted = t + phase * cycle;
  return ((shifted % cycle) + cycle) % cycle;
}

export function pistonStateAt(t: number, phase: number): PistonState {
  const time = cycleTime(t, phase, CYCLE);
  if (time < REST) return { phase: 'resting', extension: 0 };
  if (time < REST + WARNING) return { phase: 'warning', extension: 0 };
  if (time < REST + WARNING + EXTEND) {
    return { phase: 'extended', extension: (time - REST - WARNING) / EXTEND };
  }
  if (time < REST + WARNING + EXTEND + HOLD) return { phase: 'extended', extension: 1 };
  return {
    phase: 'retracting',
    extension: 1 - (time - REST - WARNING - EXTEND - HOLD) / RETRACT,
  };
}

function pistonBox(def: PistonDef, extension: number) {
  return {
    x: def.x + (def.axis === 'x' ? def.travel * extension : 0),
    y: def.y + (def.axis === 'y' ? def.travel * extension : 0),
    w: def.w,
    h: def.h,
    surface: 'normal' as const,
  };
}

export class PistonEntity implements Entity {
  phase: PistonPhase = 'resting';
  private current: ReturnType<typeof pistonBox>;
  private previous: ReturnType<typeof pistonBox>;

  constructor(readonly def: PistonDef) {
    const state = pistonStateAt(0, def.phase);
    this.phase = state.phase;
    this.current = pistonBox(def, state.extension);
    this.previous = { ...this.current };
  }

  bounds() { return this.current; }

  update(t: number, dt: number): void {
    const currentTime = Math.max(0, t);
    this.previous = pistonBox(this.def, pistonStateAt(Math.max(0, currentTime - dt), this.def.phase).extension);
    const state = pistonStateAt(currentTime, this.def.phase);
    this.phase = state.phase;
    this.current = pistonBox(this.def, state.extension);
  }

  dynamicSolids(): readonly DynamicSolid[] {
    return [{
      box: this.current,
      delta: { x: this.current.x - this.previous.x, y: this.current.y - this.previous.y },
    }];
  }

  field(): FieldEffect | null { return null; }
  draw(ctx: CanvasRenderingContext2D, _t: number, alpha: number): void {
    const x = this.previous.x + (this.current.x - this.previous.x) * alpha;
    const y = this.previous.y + (this.current.y - this.previous.y) * alpha;
    const endX = this.def.x + (this.def.axis === 'x' ? this.def.travel : 0);
    const endY = this.def.y + (this.def.axis === 'y' ? this.def.travel : 0);
    const warning = this.phase === 'warning';
    ctx.save();
    ctx.strokeStyle = warning ? '#f15a32' : '#756744';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(this.def.x + this.def.w / 2, this.def.y + this.def.h / 2);
    ctx.lineTo(endX + this.def.w / 2, endY + this.def.h / 2);
    ctx.stroke();
    ctx.strokeStyle = '#342f28';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = warning ? '#e6522f' : '#3b3935';
    ctx.fillRect(x, y, this.def.w, this.def.h);
    ctx.fillStyle = warning ? '#ffd07a' : '#d0a34b';
    ctx.fillRect(x, y, this.def.w, 4);
    ctx.fillStyle = warning ? '#ff6a3c' : '#76623a';
    ctx.beginPath();
    ctx.arc(this.def.x + this.def.w / 2, this.def.y + this.def.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  collide(player: Player): EntityContact {
    if (!overlaps(player, this.current)) return { kind: 'none' };
    const distance = Math.max(0, this.def.axis === 'x'
      ? this.current.x - this.previous.x
      : this.current.y - this.previous.y);
    return this.def.axis === 'x'
      ? { kind: 'push', dx: distance, dy: 0 }
      : { kind: 'push', dx: 0, dy: distance };
  }

  reset(): void {
    const state = pistonStateAt(0, this.def.phase);
    this.phase = state.phase;
    this.current = pistonBox(this.def, state.extension);
    this.previous = { ...this.current };
  }
}
