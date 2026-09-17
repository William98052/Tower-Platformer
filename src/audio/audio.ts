export type SoundEvent =
  | 'uiMove'
  | 'uiConfirm'
  | 'jump'
  | 'wallJump'
  | 'dash'
  | 'land'
  | 'checkpoint'
  | 'machineWarning'
  | 'piston'
  | 'door';
export type AmbienceState = 'off' | 'paused' | 'moss' | 'clockwork';
export interface AmbienceMix {
  moss: number;
  clockwork: number;
  paused: boolean;
}

interface StageThemeRef { id: number }
interface ThemeBlendRef { lower: StageThemeRef; upper: StageThemeRef; mix: number }

export interface AudioBackend {
  unlock(): Promise<void>;
  setMasterGain(value: number): void;
  setSfxGain(value: number): void;
  play(event: SoundEvent, detail: number): void;
  setAmbience(state: AmbienceMix): void;
  dispose(): void;
}

export class AudioManager {
  private unlocked = false;
  private failed = false;
  private disposed = false;
  private master = 0.8;
  private sfx = 1;
  private ambience: AmbienceMix = { moss: 0, clockwork: 0, paused: false };

  constructor(private readonly backend: AudioBackend = new BrowserAudioBackend()) {}

  async unlock(): Promise<boolean> {
    if (this.disposed || this.failed) return false;
    if (this.unlocked) return true;
    try {
      await this.backend.unlock();
      this.unlocked = true;
      this.backend.setMasterGain(this.master);
      this.backend.setSfxGain(this.sfx);
      this.backend.setAmbience(this.ambience);
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  setVolumes(master: number, sfx: number): void {
    this.master = clamp01(master);
    this.sfx = clamp01(sfx);
    if (!this.unlocked || this.failed || this.disposed) return;
    this.backend.setMasterGain(this.master);
    this.backend.setSfxGain(this.sfx);
  }

  play(event: SoundEvent, detail = 0): boolean {
    if (!this.unlocked || this.failed || this.disposed || this.master === 0 || this.sfx === 0) return false;
    try {
      this.backend.play(event, Number.isFinite(detail) ? detail : 0);
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  setAmbience(state: AmbienceState | AmbienceMix): void {
    const next = normalizeAmbience(state, this.ambience);
    if (sameAmbience(next, this.ambience)) return;
    this.ambience = next;
    if (!this.unlocked || this.failed || this.disposed) return;
    try {
      this.backend.setAmbience(next);
    } catch {
      this.failed = true;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.backend.dispose();
  }
}

export class BrowserAudioBackend implements AudioBackend {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private mossGain: GainNode | null = null;
  private clockworkGain: GainNode | null = null;
  private mossSources: AudioScheduledSourceNode[] = [];
  private clockworkSources: AudioScheduledSourceNode[] = [];

  async unlock(): Promise<void> {
    if (!this.context) {
      const AudioContextCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('Web Audio unavailable');
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.sfx = this.context.createGain();
      this.mossGain = this.context.createGain();
      this.clockworkGain = this.context.createGain();
      this.sfx.connect(this.master);
      this.mossGain.connect(this.master);
      this.clockworkGain.connect(this.master);
      this.master.connect(this.context.destination);
      this.mossGain.gain.value = 0;
      this.clockworkGain.gain.value = 0;
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setMasterGain(value: number): void {
    if (this.context && this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }

  setSfxGain(value: number): void {
    if (this.context && this.sfx) this.sfx.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }

  play(event: SoundEvent, detail: number): void {
    if (!this.context || !this.sfx) return;
    switch (event) {
      case 'jump': this.tone(240, 430, 0.12, 'sine', 0.09); break;
      case 'wallJump':
        this.tone(210, 520, 0.14, 'triangle', 0.085);
        this.noise(0.05, 0.025, 1800);
        break;
      case 'dash': this.noise(0.13, 0.1, 2400); break;
      case 'land': {
        const strength = Math.min(Math.max(detail / 1200, 0.1), 1);
        this.tone(105, 55, 0.1, 'sine', 0.04 + strength * 0.1);
        this.noise(0.06, 0.025 + strength * 0.045, 500);
        break;
      }
      case 'checkpoint':
        this.tone(440, 560, 0.16, 'sine', 0.07);
        this.tone(660, 780, 0.18, 'sine', 0.06, 0.09);
        break;
      case 'machineWarning':
        this.tone(880, 620, 0.055, 'square', 0.035);
        break;
      case 'piston':
        this.tone(82, 42, 0.18, 'sine', 0.14);
        this.noise(0.09, 0.06, 420);
        break;
      case 'door':
        this.noise(0.2, 0.055, 1100);
        this.tone(130, 92, 0.18, 'triangle', 0.045);
        break;
      case 'uiMove': this.tone(330, 350, 0.045, 'sine', 0.025); break;
      case 'uiConfirm': this.tone(480, 620, 0.07, 'sine', 0.04); break;
    }
  }

  setAmbience(state: AmbienceMix): void {
    if (!this.context || !this.mossGain || !this.clockworkGain) return;
    const now = this.context.currentTime;
    if (state.moss > 0 && this.mossSources.length === 0) this.startMossAmbience();
    if (state.clockwork > 0 && this.clockworkSources.length === 0) this.startClockworkAmbience();
    const duck = state.paused ? 0.34 : 1;
    this.mossGain.gain.setTargetAtTime(0.035 * state.moss * duck, now, 0.2);
    this.clockworkGain.gain.setTargetAtTime(0.035 * state.clockwork * duck, now, 0.2);
  }

  dispose(): void {
    for (const source of [...this.mossSources, ...this.clockworkSources]) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    this.mossSources = [];
    this.clockworkSources = [];
    void this.context?.close();
    this.context = null;
  }

  private tone(startHz: number, endHz: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
    const context = this.context;
    const destination = this.sfx;
    if (!context || !destination) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private noise(duration: number, volume: number, frequency: number): void {
    const context = this.context;
    const destination = this.sfx;
    if (!context || !destination) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter).connect(gain).connect(destination);
    source.start();
  }

  private startMossAmbience(): void {
    const context = this.context;
    const destination = this.mossGain;
    if (!context || !destination) return;
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    noise.connect(filter).connect(destination);

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    drone.type = 'sine';
    drone.frequency.value = 54;
    droneGain.gain.value = 0.12;
    drone.connect(droneGain).connect(destination);
    noise.start();
    drone.start();
    this.mossSources = [noise, drone];
  }

  private startClockworkAmbience(): void {
    const context = this.context;
    const destination = this.clockworkGain;
    if (!context || !destination) return;
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 310;
    noise.connect(filter).connect(destination);

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    drone.type = 'sawtooth';
    drone.frequency.value = 43;
    droneGain.gain.value = 0.045;
    drone.connect(droneGain).connect(destination);

    const ticks = context.createOscillator();
    const tickGain = context.createGain();
    ticks.type = 'square';
    ticks.frequency.value = 2;
    tickGain.gain.value = 0.018;
    ticks.connect(tickGain).connect(destination);
    noise.start();
    drone.start();
    ticks.start();
    this.clockworkSources = [noise, drone, ticks];
  }
}

export function ambienceMixForThemeBlend(blend: ThemeBlendRef, paused = false): AmbienceMix {
  const mix = clamp01(blend.mix);
  const weights = new Map<number, number>();
  weights.set(blend.lower.id, (weights.get(blend.lower.id) ?? 0) + 1 - mix);
  weights.set(blend.upper.id, (weights.get(blend.upper.id) ?? 0) + mix);
  return {
    moss: clamp01(weights.get(1) ?? 0),
    clockwork: clamp01(weights.get(2) ?? 0),
    paused,
  };
}

function normalizeAmbience(state: AmbienceState | AmbienceMix, previous: AmbienceMix): AmbienceMix {
  if (typeof state !== 'string') {
    return { moss: clamp01(state.moss), clockwork: clamp01(state.clockwork), paused: Boolean(state.paused) };
  }
  if (state === 'paused') return { ...previous, paused: true };
  if (state === 'moss') return { moss: 1, clockwork: 0, paused: false };
  if (state === 'clockwork') return { moss: 0, clockwork: 1, paused: false };
  return { moss: 0, clockwork: 0, paused: false };
}

function sameAmbience(a: AmbienceMix, b: AmbienceMix): boolean {
  return a.moss === b.moss && a.clockwork === b.clockwork && a.paused === b.paused;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
