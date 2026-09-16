import { describe, expect, it } from 'vitest';
import { AudioManager, type AmbienceState, type AudioBackend, type SoundEvent } from '../../src/audio/audio';

class FakeBackend implements AudioBackend {
  unlocks = 0;
  masterGain = 1;
  sfxGain = 1;
  voices: Array<{ event: SoundEvent; detail: number }> = [];
  ambience: AmbienceState[] = [];
  disposed = false;
  failUnlock = false;

  async unlock() {
    this.unlocks++;
    if (this.failUnlock) throw new Error('blocked');
  }
  setMasterGain(value: number) { this.masterGain = value; }
  setSfxGain(value: number) { this.sfxGain = value; }
  play(event: SoundEvent, detail: number) { this.voices.push({ event, detail }); }
  setAmbience(state: AmbienceState) { this.ambience.push(state); }
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
    expect(backend.ambience).toEqual(['moss']);
    audio.play('land', 900);
    audio.setAmbience('paused');
    audio.setAmbience('off');
    expect(backend.voices[0]).toEqual({ event: 'land', detail: 900 });
    expect(backend.ambience).toEqual(['moss', 'paused', 'off']);
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
});
