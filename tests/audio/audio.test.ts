import { describe, expect, it } from 'vitest';
import {
  ambienceMixForThemeBlend,
  AudioManager,
  type AmbienceMix,
  type AudioBackend,
  type SoundEvent,
} from '../../src/audio/audio';
import { STAGE_01_MOSS } from '../../src/stages/stage01-moss';
import { STAGE_02_CLOCKWORK } from '../../src/stages/stage02-clockwork';
import { buildWorld } from '../../src/stages/world';
import { themeBlendAt } from '../../src/render/themes';

class FakeBackend implements AudioBackend {
  unlocks = 0;
  masterGain = 1;
  sfxGain = 1;
  voices: Array<{ event: SoundEvent; detail: number }> = [];
  ambience: AmbienceMix[] = [];
  disposed = false;
  failUnlock = false;
  failPlay = false;
  failAmbience = false;

  async unlock() {
    this.unlocks++;
    if (this.failUnlock) throw new Error('blocked');
  }
  setMasterGain(value: number) { this.masterGain = value; }
  setSfxGain(value: number) { this.sfxGain = value; }
  play(event: SoundEvent, detail: number) {
    if (this.failPlay) throw new Error('voice failed');
    this.voices.push({ event, detail });
  }
  setAmbience(state: AmbienceMix) {
    if (this.failAmbience) throw new Error('ambience failed');
    this.ambience.push(state);
  }
  dispose() { this.disposed = true; }
}

describe('AudioManager', () => {
  it('stays silent before unlock and routes sounds afterward', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    expect(audio.play('jump')).toBe(false);
    expect(await audio.unlock()).toBe(true);
    expect(audio.play('jump')).toBe(true);
    expect(backend.voices).toEqual([{ event: 'jump', detail: 0 }]);
  });

  it('unlocks only once and remains a silent no-op after failure', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    expect(await audio.unlock()).toBe(true);
    expect(await audio.unlock()).toBe(true);
    expect(backend.unlocks).toBe(1);

    const failedBackend = new FakeBackend();
    failedBackend.failUnlock = true;
    const failed = new AudioManager(failedBackend);
    expect(await failed.unlock()).toBe(false);
    expect(await failed.unlock()).toBe(false);
    expect(failed.play('dash')).toBe(false);
    expect(failedBackend.unlocks).toBe(1);
  });

  it('clamps live gains and suppresses voices at master zero', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    await audio.unlock();
    audio.setVolumes(4, -1);
    expect(backend.masterGain).toBe(1);
    expect(backend.sfxGain).toBe(0);
    audio.setVolumes(0, 1);
    expect(audio.play('wallJump')).toBe(false);
    expect(backend.voices).toEqual([]);
  });

  it('passes landing strength and ambience states to the backend', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    audio.setAmbience('moss');
    await audio.unlock();
    expect(backend.ambience).toEqual([{ moss: 1, clockwork: 0, paused: false }]);
    audio.play('land', 900);
    audio.setAmbience('paused');
    audio.setAmbience('off');
    expect(backend.voices[0]).toEqual({ event: 'land', detail: 900 });
    expect(backend.ambience).toEqual([
      { moss: 1, clockwork: 0, paused: false },
      { moss: 1, clockwork: 0, paused: true },
      { moss: 0, clockwork: 0, paused: false },
    ]);
  });

  it('disposes its backend once', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    await audio.unlock();
    audio.dispose();
    audio.dispose();
    expect(backend.disposed).toBe(true);
    expect(audio.play('uiConfirm')).toBe(false);
  });

  it('dispatches Clockwork warning and movement voices while SFX are audible', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    await audio.unlock();

    expect(audio.play('machineWarning')).toBe(true);
    expect(audio.play('piston')).toBe(true);
    expect(audio.play('door')).toBe(true);
    expect(backend.voices).toEqual([
      { event: 'machineWarning', detail: 0 },
      { event: 'piston', detail: 0 },
      { event: 'door', detail: 0 },
    ]);
  });

  it('mutes Clockwork voices at either master or SFX zero', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    await audio.unlock();

    audio.setVolumes(0, 1);
    expect(audio.play('machineWarning')).toBe(false);
    audio.setVolumes(1, 0);
    expect(audio.play('piston')).toBe(false);
    expect(backend.voices).toEqual([]);
  });

  it('isolates a Clockwork backend voice failure and stays silent afterward', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    await audio.unlock();
    backend.failPlay = true;

    expect(audio.play('door')).toBe(false);
    backend.failPlay = false;
    expect(audio.play('machineWarning')).toBe(false);
    expect(backend.voices).toEqual([]);
  });

  it('maps the visual blend to exact Moss and Clockwork ambience gains', () => {
    const world = buildWorld({ stages: [STAGE_01_MOSS, STAGE_02_CLOCKWORK] });
    const boundary = world.sections.find((section) => section.stageId === 2)!.bottom;
    expect(ambienceMixForThemeBlend(themeBlendAt(world, boundary + 600)))
      .toEqual({ moss: 1, clockwork: 0, paused: false });
    expect(ambienceMixForThemeBlend(themeBlendAt(world, boundary + 300)))
      .toEqual({ moss: 0.5, clockwork: 0.5, paused: false });
    expect(ambienceMixForThemeBlend(themeBlendAt(world, boundary)))
      .toEqual({ moss: 0, clockwork: 1, paused: false });
  });

  it('applies a live ambience blend alongside master mute and pause ducking', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    audio.setAmbience({ moss: 0.5, clockwork: 0.5, paused: false });
    await audio.unlock();
    expect(backend.ambience.at(-1)).toEqual({ moss: 0.5, clockwork: 0.5, paused: false });
    audio.setVolumes(0, 1);
    expect(backend.masterGain).toBe(0);
    audio.setAmbience('paused');
    expect(backend.ambience.at(-1)).toEqual({ moss: 0.5, clockwork: 0.5, paused: true });
  });

  it('isolates an ambience backend failure and stays silent afterward', async () => {
    const backend = new FakeBackend();
    const audio = new AudioManager(backend);
    await audio.unlock();
    backend.failAmbience = true;
    audio.setAmbience({ moss: 0.5, clockwork: 0.5, paused: false });
    backend.failAmbience = false;

    expect(audio.play('door')).toBe(false);
    audio.setAmbience('clockwork');
    expect(backend.ambience).toEqual([{ moss: 0, clockwork: 0, paused: false }]);
  });
});
