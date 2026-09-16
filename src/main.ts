import { AppController } from './app/controller';
import { AudioManager } from './audio/audio';
import { Camera } from './core/camera';
import { MAX_FRAME_DT, STEP, VIEW_H, VIEW_W } from './core/constants';
import { type InputFrame, InputTracker, readPad, withoutPresses } from './core/input';
import { FixedStep } from './core/loop';
import { SaveStore, type StorageLike } from './core/save';
import { DEFAULT_SETTINGS, effectsPolicy, replaceBinding, type Settings } from './core/settings';
import { DebugOverlay } from './debug/overlay';
import { Game, type GameStepResult } from './game/game';
import { Afterimages, effectiveBurstCount, effectiveParticleLimit, Particles, Squash, squashScale } from './render/effects';
import { drawAfterimages, drawParticles } from './render/effects-draw';
import { drawCheckpoints, drawEntities } from './render/entity-draw';
import { drawPlayer } from './render/player-draw';
import { drawBackground, drawSolids } from './render/room-draw';
import { drawHud, drawPrompt, drawStageBanner } from './ui/overlay-draw';
import { MenuView, type MenuAction } from './ui/menu';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const menuRoot = document.getElementById('menus') as HTMLElement;
const noticeRoot = document.getElementById('notice') as HTMLElement;

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

let browserStorage: StorageLike | null = null;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const saves = new SaveStore(browserStorage);
const app = new AppController(saves);
const audio = new AudioManager();
const presentationGame = new Game('normal');
let settings: Settings = app.settings ?? DEFAULT_SETTINGS;
const input = new InputTracker(settings.bindings);
const debug = new DebugOverlay();
let loop = new FixedStep(STEP, MAX_FRAME_DT);
const camera = new Camera(VIEW_W, VIEW_H, presentationGame.world.width, presentationGame.world.height);
let particles = new Particles(effectiveParticleLimit(settings.reducedEffects));
const squash = new Squash();
const afterimages = new Afterimages();

let prevX = presentationGame.player.x;
let prevY = presentationGame.player.y;
let lastMs = 0;
let stepsThisFrame = 0;
let stepCount = 0;
let presentationTime = 0;

const DUST = '#cfe3a8';
const SPARK = '#ffe6b0';

const menus = new MenuView(menuRoot, noticeRoot, handleMenuAction);
applySettings(settings);
refreshMenu();
if (app.notice) menus.showNotice(app.notice.message);

function activeGame(): Game {
  return app.game ?? presentationGame;
}

function applySettings(next: Settings): void {
  settings = next;
  input.setBindings(settings.bindings);
  camera.setShakeEnabled(effectsPolicy(settings).shakeEnabled);
  particles = new Particles(effectiveParticleLimit(settings.reducedEffects));
  audio.setVolumes(settings.masterVolume, settings.sfxVolume);
}

function updateSettings(next: Settings): void {
  app.updateSettings(next);
  applySettings(next);
  refreshMenu();
}

function refreshMenu(): void {
  menus.render({
    screen: app.screen,
    settings,
    canContinueNormal: app.continueAvailable('normal'),
    canContinueHard: app.continueAvailable('hard'),
    pendingConfirmation: app.pendingConfirmation,
  });
  if (app.notice) menus.showNotice(app.notice.message);
}

function handleMenuAction(action: MenuAction): void {
  void audio.unlock().then((ready) => { if (ready) audio.play('uiConfirm'); });
  if (action.type === 'play') app.openModeSelect();
  if (action.type === 'openSettings') app.openSettings();
  if (action.type === 'back') app.screen === 'settings' ? app.closeSettings() : app.backToTitle();
  if (action.type === 'newRun') app.newRun(action.mode);
  if (action.type === 'continueRun') app.continueRun(action.mode);
  if (action.type === 'resume') app.resume();
  if (action.type === 'restart') app.restart();
  if (action.type === 'quit') app.quitToTitle();
  if (action.type === 'confirm') {
    app.confirm();
    settings = app.settings;
    applySettings(settings);
  }
  if (action.type === 'cancel') app.cancelConfirmation();
  if (action.type === 'resetSettings') app.resetSettings();
  if (action.type === 'setVolume') updateSettings({ ...settings, [action.name]: action.value });
  if (action.type === 'setToggle') updateSettings({ ...settings, [action.name]: action.value });
  if (action.type === 'beginBinding') {
    menus.beginBindingCapture(action.action, action.slot);
    return;
  }
  if (action.type === 'replaceBinding') updateSettings(replaceBinding(settings, action.action, action.slot, action.code));
  resetFrameState();
  syncAmbience();
  refreshMenu();
}

function syncAmbience(): void {
  if (app.screen === 'playing') audio.setAmbience('moss');
  else if (app.game && (app.screen === 'paused' || app.screen === 'settings')) audio.setAmbience('paused');
  else audio.setAmbience('off');
}

function resetFrameState(): void {
  input.releaseAll();
  loop = new FixedStep(STEP, MAX_FRAME_DT);
  lastMs = 0;
  const player = activeGame().player;
  prevX = player.x;
  prevY = player.y;
  if (app.game) camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
}

function respawn(): void {
  if (!app.game) return;
  app.game.respawn();
  resetFrameState();
}

function runDebugCommands(): void {
  const game = app.game;
  if (!game) return;
  for (let command = debug.takeCommand(); command !== null; command = debug.takeCommand()) {
    if (command.type === 'toggleNoclip') game.toggleNoclip();
    if (command.type === 'toggleMode') game.toggleMode();
    if (command.type === 'warp') game.warp(game.currentSection + command.delta);
    resetFrameState();
  }
}

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === 'Escape' && !event.repeat) {
    if (app.screen === 'playing') app.pause('escape');
    else if (app.screen === 'paused') app.resume();
    else if (app.screen === 'settings') app.closeSettings();
    else if (app.screen === 'modeSelect') app.backToTitle();
    resetFrameState();
    refreshMenu();
    syncAmbience();
    return;
  }
  if (app.screen !== 'playing') return;
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
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autoPause();
});

function autoPause(): void {
  input.releaseAll();
  app.pause('visibility');
  resetFrameState();
  syncAmbience();
  refreshMenu();
}

function count(value: number): number {
  return effectiveBurstCount(value, settings.reducedEffects);
}

function onEvents(events: GameStepResult): void {
  const player = activeGame().player;
  const footX = player.x + player.w / 2;
  const footY = player.y + player.h;
  if (events.jumped) {
    audio.play('jump');
    squash.set(0.75, 1.3);
    particles.burst(footX, footY, { count: count(8), speed: 120, color: DUST, size: 3, life: 0.35, spread: Math.PI });
  }
  if (events.wallJumped) {
    audio.play('wallJump');
    squash.set(0.8, 1.25);
    const wallX = player.facing === 1 ? player.x : player.x + player.w;
    const away = player.facing === 1 ? 0 : Math.PI;
    particles.burst(wallX, player.y + player.h / 2, {
      count: count(8), speed: 140, color: DUST, size: 3, life: 0.35, angle: away, spread: Math.PI * 0.8,
    });
  }
  if (events.dashed) {
    audio.play('dash');
    camera.shake(4, 0.12);
    particles.burst(footX, player.y + player.h / 2, { count: count(12), speed: 220, color: SPARK, size: 2.5, life: 0.3 });
  }
  if (events.landed > 250) {
    audio.play('land', events.landed);
    const scale = squashScale(events.landed);
    squash.set(scale.sx, scale.sy);
    particles.burst(footX, footY, {
      count: count(Math.round(events.landed / 80)), speed: events.landed * 0.25, color: DUST,
      size: 3, life: 0.4, spread: Math.PI * 0.9,
    });
    if (events.landed > 1000) camera.shake(3, 0.1);
  }
  if (events.checkpointActivated) audio.play('checkpoint');
}

function update(frameDt: number): void {
  presentationTime += frameDt;
  stepsThisFrame = 0;
  const game = app.game;
  if (app.screen === 'playing' && game) {
    app.advanceRealTime(frameDt);
    stepsThisFrame = loop.advance(frameDt * debug.timeScale);
    if (stepsThisFrame > 0) {
      const pad = readPad(navigator.getGamepads?.()?.find((item) => item !== null) ?? null);
      const sampled: InputFrame = input.sample(pad);
      for (let i = 0; i < stepsThisFrame; i++) {
        prevX = game.player.x;
        prevY = game.player.y;
        const facingBefore = game.player.facing;
        const events = app.step(i === 0 ? sampled : withoutPresses(sampled), camera.y);
        if (!events) break;
        onEvents(events);
        if (events.respawned) resetFrameState();
        if (game.player.onGround && game.player.facing !== facingBefore && Math.abs(game.player.vx) > 150) {
          particles.burst(game.player.x + game.player.w / 2, game.player.y + game.player.h, {
            count: count(5), speed: 90, color: DUST, size: 2.5, life: 0.3,
            angle: game.player.facing === 1 ? Math.PI : 0, spread: 1.2,
          });
        }
        stepCount++;
        if (game.player.dashTimer > 0 && stepCount % 2 === 0) afterimages.add(prevX, prevY);
      }
    }
    const rx = prevX + (game.player.x - prevX) * loop.alpha;
    const ry = prevY + (game.player.y - prevY) * loop.alpha;
    camera.follow(rx + game.player.w / 2, ry + game.player.h / 2, game.player.vy, frameDt);
  } else if (!game) {
    const travel = Math.max(1, presentationGame.world.height - VIEW_H);
    camera.y = travel - (presentationTime * 18 % travel);
  }

  camera.updateShake(frameDt);
  particles.update(frameDt, 400);
  squash.update(frameDt);
  afterimages.update(frameDt);
  render();
}

function render(): void {
  const game = activeGame();
  const player = game.player;
  const rx = prevX + (player.x - prevX) * loop.alpha;
  const ry = prevY + (player.y - prevY) * loop.alpha;
  const camX = camera.x + camera.offsetX;
  const camY = camera.y + camera.offsetY;
  const glowScale = settings.reducedEffects ? 0 : blurScale;
  drawBackground(ctx, camX, camY, app.game?.time ?? presentationTime);
  drawSolids(ctx, game.world.solids, camX, camY, glowScale);
  if (!app.game) return;
  drawCheckpoints(ctx, game.world.sections, game.run.checkpoint, game.run.mode, camX, camY, glowScale);
  drawEntities(ctx, game.activeEntities(camera.y), camX, camY, game.time, loop.alpha);
  drawAfterimages(ctx, afterimages, player.w, player.h, camX, camY);
  drawPlayer(ctx, { ...player, x: rx, y: ry }, squash, camX, camY, game.time, glowScale);
  drawParticles(ctx, particles, camX, camY);
  drawHud(ctx, game.run, ry, game.world.height, game.world.stage.name);
  drawPrompt(ctx, game.prompts);
  drawStageBanner(ctx, game.banner);
  if (app.screen === 'playing') {
    debug.draw(ctx, { ...player, x: rx, y: ry }, game.world.solids, camX, camY, stepsThisFrame, {
      mode: game.run.mode, section: game.currentSection, noclip: game.noclip,
    });
  }
}

function frame(nowMs: number): void {
  const frameDt = lastMs === 0 ? 0 : (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  debug.recordFrame(nowMs);
  update(frameDt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
window.addEventListener('pagehide', () => audio.dispose(), { once: true });
