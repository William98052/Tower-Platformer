import { MAX_FALL } from '../core/constants';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface BurstOptions {
  count: number;
  speed: number;
  color: string;
  size: number;
  life: number;
  /** Center direction in radians (0 = right, -PI/2 = up). Default: up. */
  angle?: number;
  /** Total cone width in radians. Default: full circle. */
  spread?: number;
}

export class Particles {
  readonly list: Particle[] = [];

  constructor(private readonly max = 400) {}

  burst(x: number, y: number, o: BurstOptions, random: () => number = Math.random): void {
    if (o.count <= 0 || o.life <= 0) return;
    for (let i = 0; i < o.count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const angle = (o.angle ?? -Math.PI / 2) + (random() - 0.5) * (o.spread ?? Math.PI * 2);
      const speed = o.speed * (0.4 + random() * 0.6);
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: o.life,
        maxLife: o.life,
        size: o.size,
        color: o.color,
      });
    }
  }

  update(dt: number, gravity = 0, drag = 3): void {
    dt = Math.max(dt, 0);
    const friction = Math.exp(-drag * dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += gravity * dt;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}

/** Landing squash: wider and flatter the harder the impact. */
export function squashScale(impactSpeed: number): { sx: number; sy: number } {
  const t = Math.min(Math.max(impactSpeed / MAX_FALL, 0), 1);
  return { sx: 1 + 0.35 * t, sy: 1 - 0.35 * t };
}

export class Squash {
  sx = 1;
  sy = 1;

  set(sx: number, sy: number): void {
    this.sx = sx;
    this.sy = sy;
  }

  update(dt: number, recover = 14): void {
    dt = Math.max(dt, 0);
    const k = 1 - Math.exp(-recover * dt);
    this.sx += (1 - this.sx) * k;
    this.sy += (1 - this.sy) * k;
  }
}

export class Afterimages {
  readonly items: { x: number; y: number; life: number }[] = [];

  constructor(readonly lifetime = 0.18) {}

  add(x: number, y: number): void {
    this.items.push({ x, y, life: this.lifetime });
  }

  update(dt: number): void {
    dt = Math.max(dt, 0);
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].life -= dt;
      if (this.items[i].life <= 0) this.items.splice(i, 1);
    }
  }
}
