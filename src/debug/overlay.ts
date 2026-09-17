import type { AABB } from '../physics/aabb';
import type { Player } from '../physics/player';
import type { Mode } from '../modes/run-state';

export const SLOW_MOTION_SCALE = 0.25;

export type DebugCommand =
  | { type: 'toggleNoclip' }
  | { type: 'toggleMode' }
  | { type: 'warp'; delta: -1 | 1 };

export interface DebugStatus {
  mode: Mode;
  stageId: number;
  localSection: number;
  noclip: boolean;
}

export class DebugOverlay {
  visible = false;
  slowMotion = false;
  private frameTimes: number[] = [];
  private commands: DebugCommand[] = [];

  /** Returns true if the key was a debug key and should not reach gameplay input. */
  handleKey(code: string): boolean {
    if (code === 'Backquote') {
      this.visible = !this.visible;
      return true;
    }
    if (code === 'KeyT') {
      this.slowMotion = !this.slowMotion;
      return true;
    }
    if (code === 'KeyN') {
      this.commands.push({ type: 'toggleNoclip' });
      return true;
    }
    if (code === 'KeyM') {
      this.commands.push({ type: 'toggleMode' });
      return true;
    }
    if (code === 'BracketLeft' || code === 'BracketRight') {
      this.commands.push({ type: 'warp', delta: code === 'BracketLeft' ? -1 : 1 });
      return true;
    }
    return false;
  }

  takeCommand(): DebugCommand | null {
    return this.commands.shift() ?? null;
  }

  get timeScale(): number {
    return this.slowMotion ? SLOW_MOTION_SCALE : 1;
  }

  recordFrame(nowMs: number): void {
    this.frameTimes.push(nowMs);
    while (this.frameTimes.length > 0 && nowMs - this.frameTimes[0] >= 1000) this.frameTimes.shift();
  }

  get fps(): number {
    return this.frameTimes.length;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    solids: readonly AABB[],
    camX: number,
    camY: number,
    stepsThisFrame: number,
    status?: DebugStatus,
  ): void {
    if (!this.visible) {
      // Slow motion must never be active invisibly.
      if (this.slowMotion) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(8, 8, 76, 22);
        ctx.fillStyle = '#ffd36e';
        ctx.font = '12px ui-monospace, Menlo, monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('SLOW-MO', 16, 13);
        ctx.restore();
      }
      return;
    }
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.6)';
    for (const s of solids) ctx.strokeRect(s.x - camX + 0.5, s.y - camY + 0.5, s.w - 1, s.h - 1);
    ctx.strokeStyle = '#ff4d6d';
    ctx.strokeRect(player.x - camX + 0.5, player.y - camY + 0.5, player.w - 1, player.h - 1);

    const lines = [
      `fps ${this.fps}  steps ${stepsThisFrame}${this.slowMotion ? '  SLOW-MO' : ''}`,
      `pos ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `vel ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)}`,
      `ground ${player.onGround}  wall ${player.wallDir}`,
      `dash ${player.dashCharges}  timer ${player.dashTimer.toFixed(2)}  cd ${player.dashCooldown.toFixed(2)}`,
      `wjLock ${player.wallJumpLock.toFixed(2)}  lastWJ ${player.lastWallJumpDir}  lastRefill ${player.lastWallRefillDir}`,
      `coyote ${player.coyote.toFixed(2)}  buffer ${player.jumpBuffer.toFixed(2)}`,
    ];
    if (status) {
      lines.push(`mode ${status.mode}  noclip ${status.noclip}`);
      lines.push(`Stage ${status.stageId} / Section ${status.localSection + 1}`);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(8, 8, 320, 12 + lines.length * 16);
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, 16, 14 + i * 16));
    ctx.restore();
  }
}
