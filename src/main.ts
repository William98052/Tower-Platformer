import { Camera } from './core/camera';
import { MAX_FRAME_DT, STEP, VIEW_H, VIEW_W } from './core/constants';
import { type InputFrame, InputTracker, readPad, withoutPresses } from './core/input';
import { FixedStep } from './core/loop';
import { DebugOverlay } from './debug/overlay';
import { Game } from './game/game';
import type { StepEvents } from './physics/player';
import { Afterimages, Particles, Squash, squashScale } from './render/effects';
import { drawAfterimages, drawParticles } from './render/effects-draw';
import { drawCheckpoints, drawEntities } from './render/entity-draw';
import { drawPlayer } from './render/player-draw';
import { drawBackground, drawSolids } from './render/room-draw';
import { drawHud, drawPrompt, drawStageBanner } from './ui/overlay-draw';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let blurScale = 1;

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

const game = new Game('normal');
const player = game.player;
const camera = new Camera(VIEW_W, VIEW_H, game.world.width, game.world.height);
const loop = new FixedStep(STEP, MAX_FRAME_DT);
const input = new InputTracker();
const debug = new DebugOverlay();
const particles = new Particles();
const squash = new Squash();
const afterimages = new Afterimages();

let prevX = player.x;
let prevY = player.y;
let lastMs = 0;
let stepsThisFrame = 0;
let stepCount = 0;

const DUST = '#cfe3a8';
const SPARK = '#ffe6b0';

function snapToPlayer(): void {
  prevX = player.x;
  prevY = player.y;
  camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
}

function respawn(): void {
  game.respawn();
  snapToPlayer();
}

function runDebugCommands(): void {
  for (let command = debug.takeCommand(); command !== null; command = debug.takeCommand()) {
    if (command.type === 'toggleNoclip') game.toggleNoclip();
    if (command.type === 'toggleMode') game.toggleMode();
    if (command.type === 'warp') game.warp(game.currentSection + command.delta);
    snapToPlayer();
  }
}

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (!event.repeat && debug.handleKey(event.code)) {
    runDebugCommands();
    return;
  }
  if (event.code === 'KeyR') {
    if (!event.repeat) respawn();
    return;
  }
  if (event.code.startsWith('Arrow') || event.code === 'Space' || event.code === 'Tab') event.preventDefault();
  input.keyDown(event.code, event.repeat);
});
window.addEventListener('keyup', (event) => {
  input.keyUp(event.code);
  if (event.code.startsWith('Meta')) input.releaseAll();
});
window.addEventListener('blur', () => input.releaseAll());
document.addEventListener('visibilitychange', () => {
  lastMs = 0;
  input.releaseAll();
});

function onEvents(events: StepEvents): void {
  const footX = player.x + player.w / 2;
  const footY = player.y + player.h;
  if (events.jumped) {
    squash.set(0.75, 1.3);
    particles.burst(footX, footY, { count: 8, speed: 120, color: DUST, size: 3, life: 0.35, spread: Math.PI });
  }
  if (events.wallJumped) {
    squash.set(0.8, 1.25);
    const wallX = player.facing === 1 ? player.x : player.x + player.w;
    const away = player.facing === 1 ? 0 : Math.PI;
    particles.burst(wallX, player.y + player.h / 2, {
      count: 8, speed: 140, color: DUST, size: 3, life: 0.35, angle: away, spread: Math.PI * 0.8,
    });
  }
  if (events.dashed) {
    camera.shake(4, 0.12);
    particles.burst(footX, player.y + player.h / 2, { count: 12, speed: 220, color: SPARK, size: 2.5, life: 0.3 });
  }
  if (events.landed > 250) {
    const scale = squashScale(events.landed);
    squash.set(scale.sx, scale.sy);
    particles.burst(footX, footY, {
      count: Math.round(events.landed / 80), speed: events.landed * 0.25, color: DUST,
      size: 3, life: 0.4, spread: Math.PI * 0.9,
    });
    if (events.landed > 1000) camera.shake(3, 0.1);
  }
}

function update(frameDt: number): void {
  const dt = frameDt * debug.timeScale;
  stepsThisFrame = loop.advance(dt);
  if (stepsThisFrame > 0) {
    const pad = readPad(navigator.getGamepads?.()?.find((item) => item !== null) ?? null);
    const sampled: InputFrame = input.sample(pad);
    for (let i = 0; i < stepsThisFrame; i++) {
      prevX = player.x;
      prevY = player.y;
      const facingBefore = player.facing;
      const events = game.step(i === 0 ? sampled : withoutPresses(sampled), camera.y);
      onEvents(events);
      if (events.respawned) snapToPlayer();
      if (player.onGround && player.facing !== facingBefore && Math.abs(player.vx) > 150) {
        particles.burst(player.x + player.w / 2, player.y + player.h, {
          count: 5, speed: 90, color: DUST, size: 2.5, life: 0.3,
          angle: player.facing === 1 ? Math.PI : 0, spread: 1.2,
        });
      }
      stepCount++;
      if (player.dashTimer > 0 && stepCount % 2 === 0) afterimages.add(prevX, prevY);
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
  drawBackground(ctx, camX, camY, game.time);
  drawSolids(ctx, game.world.solids, camX, camY, blurScale);
  drawCheckpoints(ctx, game.world.sections, game.run.checkpoint, game.run.mode, camX, camY, blurScale);
  drawEntities(ctx, game.activeEntities(camera.y), camX, camY, game.time, loop.alpha);
  drawAfterimages(ctx, afterimages, player.w, player.h, camX, camY);
  drawPlayer(ctx, { ...player, x: rx, y: ry }, squash, camX, camY, game.time, blurScale);
  drawParticles(ctx, particles, camX, camY);
  drawHud(ctx, game.run, ry, game.world.height, game.world.stage.name);
  drawPrompt(ctx, game.prompts);
  drawStageBanner(ctx, game.banner);
  debug.draw(ctx, { ...player, x: rx, y: ry }, game.world.solids, camX, camY, stepsThisFrame, {
    mode: game.run.mode,
    section: game.currentSection,
    noclip: game.noclip,
  });
}

function frame(nowMs: number): void {
  const frameDt = lastMs === 0 ? 0 : (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  debug.recordFrame(nowMs);
  update(frameDt);
  requestAnimationFrame(frame);
}

snapToPlayer();
requestAnimationFrame(frame);
