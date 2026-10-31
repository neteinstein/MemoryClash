import { KEYS } from '../game/config';

/**
 * Sintetizador simples com Web Audio: todos os sons são gerados em tempo real,
 * por isso não há ficheiros de áudio e os sons dos dois jogadores sobrepõem-se livremente.
 */
export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  /** Tem de ser chamado num gesto do utilizador (toque/clique) para o browser deixar tocar som. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.9;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private out(pan: number): { ctx: AudioContext; dest: AudioNode } | null {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return null;
    if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(this.master);
      return { ctx: this.ctx, dest: p };
    }
    return { ctx: this.ctx, dest: this.master };
  }

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; pan?: number; delay?: number; slideTo?: number; attack?: number } = {},
  ): void {
    const o = this.out(opts.pan ?? 0);
    if (!o) return;
    const { ctx, dest } = o;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const peak = opts.gain ?? 0.3;
    const attack = opts.attack ?? 0.008;
    const release = Math.min(0.12, duration * 0.4);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    env.gain.setValueAtTime(peak, t0 + Math.max(attack, duration - release));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(dest);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Nota de uma tecla (mistura triângulo + seno uma oitava acima para soar mais "cheio"). */
  note(key: number, durationMs: number, pan = 0): void {
    const def = KEYS[key];
    if (!def) return;
    const d = Math.max(0.09, durationMs / 1000);
    this.tone(def.freq, d, { type: 'triangle', gain: 0.32, pan });
    this.tone(def.freq * 2, d, { type: 'sine', gain: 0.08, pan });
  }

  error(pan = 0): void {
    this.tone(155, 0.32, { type: 'sawtooth', gain: 0.18, pan, slideTo: 70 });
    this.tone(160, 0.32, { type: 'square', gain: 0.08, pan, slideTo: 75 });
  }

  success(pan = 0): void {
    [659.25, 830.61, 987.77].forEach((f, i) => this.tone(f, 0.12, { type: 'sine', gain: 0.16, pan, delay: i * 0.06 }));
  }

  claim(pan = 0): void {
    this.tone(300, 0.18, { type: 'sine', gain: 0.1, pan, slideTo: 900 });
  }

  /** Gargalhada maléfica do diabinho: "mua-ha-ha-ha" descendente. */
  devil(pan = 0): void {
    this.tone(180, 0.22, { type: 'sawtooth', gain: 0.12, pan, slideTo: 260 });
    const notes = [520, 470, 420, 370];
    notes.forEach((f, i) => {
      this.tone(f, 0.11, { type: 'square', gain: 0.08, pan, delay: 0.25 + i * 0.13, slideTo: f * 0.8 });
      this.tone(f * 1.5, 0.11, { type: 'sawtooth', gain: 0.04, pan, delay: 0.25 + i * 0.13, slideTo: f * 1.1 });
    });
  }

  countdown(final = false): void {
    this.tone(final ? 880 : 440, final ? 0.35 : 0.15, { type: 'square', gain: 0.1 });
  }

  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, i === 3 ? 0.6 : 0.16, { type: 'triangle', gain: 0.22, delay: i * 0.12 }),
    );
  }

  click(): void {
    this.tone(1200, 0.04, { type: 'sine', gain: 0.06 });
  }
}

export const synth = new Synth();
