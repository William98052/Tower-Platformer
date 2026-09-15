import { Camera } from './core/camera';
import { MAX_FRAME_DT, STEP, VIEW_H, VIEW_W } from './core/constants';
import { type InputFrame, InputTracker, readPad, withoutPresses } from './core/input';
import { FixedStep } from './core/loop';
import { DebugOverlay } from './debug/overlay';
import { createPlayer, type StepEvents, stepPlayer } from './physics/player';
import { Afterimages, Particles, Squash, squashScale } from './render/effects';
import { drawAfterimages, drawParticles } from './render/effects-draw';
import { drawPlayer } from './render/player-draw';
import { drawBackground, drawSolids } from './render/room-draw';
import { TEST_ROOM } from './stages/test-room';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Canvas shadowBlur ignores the transform, so glow sizes are scaled by the device-pixel scale.
let blurScale = 1;

// Fit the 960×540 logical view into the window, crisp on high-DPI screens.
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  canvas.width = Math.round(VIEW_W * scale * dpr);
  canvas.height = Math.round(VIEW_H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  blurScale = scale * dpr;
}
resize();
window.addEventListener('resize', resize);

const room = TEST_ROOM;
const player = createPlayer(room.spawn.x, room.spawn.y);
const camera = new Camera(VIEW_W, VIEW_H, room.width, room.height);
const loop = new FixedStep(STEP, MAX_FRAME_DT);
const input = new InputTracker();
const debug = new DebugOverlay();
const particles = new Particles();
const squash = new Squash();
const afterimages = new Afterimages();

let prevX = player.x;
let prevY = player.y;
let time = 0;
let lastMs = 0;
let stepsThisFrame = 0;
let stepCount = 0;

const DUST = '#cfe3a8';
const SPARK = '#ffe6b0';

function respawn(): void {
  Object.assign(player, createPlayer(room.spawn.x, room.spawn.y));
  prevX = player.x;
  prevY = player.y;
  camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
}

window.addEventListener('keydown', (e) => {
  // Debug keys toggle once per physical press, not on key repeat.
  if (!e.repeat && debug.handleKey(e.code)) return;
  if (e.code === 'KeyR') {
    respawn();
    return;
  }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  input.keyDown(e.code, e.repeat);
});
window.addEventListener('keyup', (e) => {
  input.keyUp(e.code);
  // macOS drops keyup for other keys while Cmd is held; release everything so nothing sticks.
  if (e.code.startsWith('Meta')) input.releaseAll();
});
window.addEventListener('blur', () => input.releaseAll());
document.addEventListener('visibilitychange', () => {
  lastMs = 0; // avoid a huge catch-up frame when the tab comes back
});

function onEvents(e: StepEvents): void {
  const footX = player.x + player.w / 2;
  const footY = player.y + player.h;
  if (e.jumped) {
    squash.set(0.75, 1.3);
    particles.burst(footX, footY, { count: 8, speed: 120, color: DUST, size: 3, life: 0.35, spread: Math.PI });
  }
  if (e.wallJumped) {
    squash.set(0.8, 1.25);
    const wallX = player.vx > 0 ? player.x : player.x + player.w;
    const away = player.vx > 0 ? 0 : Math.PI;
    particles.burst(wallX, player.y + player.h / 2, {
      count: 8, speed: 140, color: DUST, size: 3, life: 0.35, angle: away, spread: Math.PI * 0.8,
    });
  }
  if (e.dashed) {
    camera.shake(4, 0.12);
    particles.burst(footX, player.y + player.h / 2, { count: 12, speed: 220, color: SPARK, size: 2.5, life: 0.3 });
  }
  if (e.landed > 250) {
    const s = squashScale(e.landed);
    squash.set(s.sx, s.sy);
    particles.burst(footX, footY, {
      count: Math.round(e.landed / 80), speed: e.landed * 0.25, color: DUST, size: 3, life: 0.4, spread: Math.PI * 0.9,
    });
    if (e.landed > 1000) camera.shake(3, 0.1);
  }
}

function update(frameDt: number): void {
  const dt = frameDt * debug.timeScale;
  stepsThisFrame = loop.advance(dt);
  if (stepsThisFrame > 0) {
    // Sample only when physics will run, so a press is never consumed by a zero-step frame.
    const pad = readPad(navigator.getGamepads?.()?.find((g) => g !== null) ?? null);
    const sampled: InputFrame = input.sample(pad);
    for (let i = 0; i < stepsThisFrame; i++) {
      prevX = player.x;
      prevY = player.y;
      const facingBefore = player.facing;
      onEvents(stepPlayer(player, i === 0 ? sampled : withoutPresses(sampled), room.solids));
      if (player.onGround && player.facing !== facingBefore && Math.abs(player.vx) > 150) {
        // Turn-around skid puff
        particles.burst(player.x + player.w / 2, player.y + player.h, {
          count: 5, speed: 90, color: DUST, size: 2.5, life: 0.3, angle: player.facing === 1 ? Math.PI : 0, spread: 1.2,
        });
      }
      stepCount++;
      // Global counter, not the per-frame index: keeps afterimage density the same at any refresh rate.
      if (player.dashTimer > 0 && stepCount % 2 === 0) afterimages.add(player.x, player.y);
      time += STEP;
    }
  }

  const rx = prevX + (player.x - prevX) * loop.alpha;
  const ry = prevY + (player.y - prevY) * loop.alpha;
  camera.follow(rx + player.w / 2, ry + player.h / 2, player.vy, dt);
  camera.updateShake(dt);
  particles.update(dt, 400);
  squash.update(dt);
  afterimages.update(dt);
  render(rx, ry);
}

function render(rx: number, ry: number): void {
  const camX = camera.x + camera.offsetX;
  const camY = camera.y + camera.offsetY;
  drawBackground(ctx, camX, camY, time);
  drawSolids(ctx, room.solids, camX, camY, blurScale);
  drawAfterimages(ctx, afterimages, player.w, player.h, camX, camY);
  drawPlayer(ctx, { ...player, x: rx, y: ry }, squash, camX, camY, time, blurScale);
  drawParticles(ctx, particles, camX, camY);
  debug.draw(ctx, player, room.solids, camX, camY, stepsThisFrame);
}

function frame(nowMs: number): void {
  const frameDt = lastMs === 0 ? 0 : (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  debug.recordFrame(nowMs);
  update(frameDt);
  requestAnimationFrame(frame);
}

camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
requestAnimationFrame(frame);
