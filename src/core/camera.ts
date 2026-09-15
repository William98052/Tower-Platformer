export const CAMERA_STIFFNESS = 8;
export const TARGET_SCREEN_Y = 0.55;
export const LOOK_AHEAD_TIME = 0.12;
export const MAX_LOOK_AHEAD = 80;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export class Camera {
  /** Top-left corner of the view in world units. */
  x = 0;
  y = 0;
  /** Shake offset added at draw time only. */
  offsetX = 0;
  offsetY = 0;
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;

  constructor(
    readonly viewW: number,
    readonly viewH: number,
    public worldW: number,
    public worldH: number,
  ) {}

  /** Where the camera wants to be for a target center point and vertical speed. */
  desired(targetX: number, targetY: number, targetVy: number): { x: number; y: number } {
    const lookAhead = clamp(targetVy * LOOK_AHEAD_TIME, -MAX_LOOK_AHEAD, MAX_LOOK_AHEAD);
    return {
      x: clamp(targetX - this.viewW / 2, 0, Math.max(0, this.worldW - this.viewW)),
      y: clamp(targetY - this.viewH * TARGET_SCREEN_Y + lookAhead, 0, Math.max(0, this.worldH - this.viewH)),
    };
  }

  follow(targetX: number, targetY: number, targetVy: number, dt: number): void {
    const d = this.desired(targetX, targetY, targetVy);
    const k = 1 - Math.exp(-CAMERA_STIFFNESS * dt);
    this.x += (d.x - this.x) * k;
    this.y += (d.y - this.y) * k;
  }

  snapTo(targetX: number, targetY: number): void {
    const d = this.desired(targetX, targetY, 0);
    this.x = d.x;
    this.y = d.y;
  }

  shake(magnitude: number, duration: number): void {
    if (magnitude < this.currentMagnitude()) return;
    this.shakeMagnitude = magnitude;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  updateShake(dt: number, random: () => number = Math.random): void {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    const m = this.currentMagnitude();
    this.offsetX = m === 0 ? 0 : (random() * 2 - 1) * m;
    this.offsetY = m === 0 ? 0 : (random() * 2 - 1) * m;
  }

  private currentMagnitude(): number {
    return this.shakeTime > 0 ? this.shakeMagnitude * (this.shakeTime / this.shakeDuration) : 0;
  }
}
