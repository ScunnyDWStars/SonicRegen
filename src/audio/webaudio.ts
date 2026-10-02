import type { Sfx } from '../player/types';
import { midiToHz, parseMML, type NoteEvent } from './mml';
import { SONGS, type Song } from './songs';
import type { Sound } from './sound';

interface PreparedSong {
  song: Song;
  channels: { events: NoteEvent[]; length: number }[];
  length: number;
}

const prepared = new Map<string, PreparedSong>();
function prepare(name: string): PreparedSong | null {
  let p = prepared.get(name);
  if (p) return p;
  const song = SONGS[name];
  if (!song) return null;
  const channels = song.channels.map((c) => parseMML(c.mml, c.inst));
  p = { song, channels, length: Math.max(...channels.map((c) => c.length)) };
  prepared.set(name, p);
  return p;
}

interface Playing {
  name: string;
  prep: PreparedSong;
  /** Beat position already scheduled up to. */
  scheduledBeat: number;
  /** AudioContext time of beat 0 (adjusted when tempo changes). */
  startTime: number;
  secPerBeat: number;
  /** Per-channel event cursors. */
  cursors: number[];
  loopsDone: number[];
  bus: GainNode;
  done: boolean;
}

/**
 * Web Audio implementation: a small FM / pulse synth, a look-ahead sequencer for
 * MML songs, and synthesised sound effects. The context starts on the first
 * user gesture (browsers require it).
 */
export class WebAudioSound implements Sound {
  current: string | null = null;
  volumes = { music: 0.7, sfx: 0.8 };
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noise!: AudioBuffer;
  private pulse25!: PeriodicWave;
  private main: Playing | null = null;
  private over: Playing | null = null;
  private overName: string | null = null;
  private jingleP: Playing | null = null;
  private tempo = 1;
  private timer = 0;
  private pendingMain: string | null = null;

  constructor() {
    const unlock = () => this.ensure();
    addEventListener('keydown', unlock);
    addEventListener('pointerdown', unlock);
    addEventListener('gamepadconnected', unlock);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.applyVolumes();
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.pulse25 = this.pulseWave(0.25);
      this.timer = window.setInterval(() => this.tick(), 25);
      if (this.pendingMain) {
        const n = this.pendingMain;
        this.pendingMain = null;
        this.music(n, { restart: true });
      }
      return ctx;
    } catch {
      return null;
    }
  }

  private pulseWave(duty: number): PeriodicWave {
    const n = 32;
    const real = new Float32Array(n),
      imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return this.ctx!.createPeriodicWave(real, imag);
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
  }

  // ------------------------------------------------------------------ music

  music(track: string | null, opts: { restart?: boolean } = {}): void {
    if (track === this.current && !opts.restart && this.main) return;
    this.current = track;
    this.stopPlaying(this.main);
    this.main = null;
    if (!track) return;
    if (!this.ctx) {
      this.pendingMain = track;
      return;
    }
    this.main = this.start(track);
    if (this.over || this.jingleP) this.main?.bus.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  overrideMusic(track: string | null): void {
    if (track === this.overName) return;
    this.overName = track;
    this.stopPlaying(this.over);
    this.over = null;
    const ctx = this.ctx;
    if (!ctx) return;
    if (track) {
      this.over = this.start(track);
      this.main?.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    } else if (!this.jingleP) {
      this.main?.bus.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    }
  }

  /** A one-shot tune that pauses the music (extra life). */
  jingle(track: string): void {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopPlaying(this.jingleP);
    this.jingleP = this.start(track);
    this.main?.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    this.over?.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  }

  setTempo(mult: number): void {
    if (mult === this.tempo) return;
    this.tempo = mult;
    for (const p of [this.main, this.over]) {
      if (!p || !this.ctx) continue;
      // Re-anchor so the current beat stays put while the tempo changes.
      const now = this.ctx.currentTime;
      const beat = (now - p.startTime) / p.secPerBeat;
      p.secPerBeat = 60 / (p.prep.song.bpm * mult);
      p.startTime = now - beat * p.secPerBeat;
    }
  }

  private start(name: string): Playing | null {
    const ctx = this.ctx;
    const prep = prepare(name);
    if (!ctx || !prep) return null;
    const bus = ctx.createGain();
    bus.connect(this.musicGain);
    const mult = name === this.current ? this.tempo : 1;
    return {
      name,
      prep,
      scheduledBeat: 0,
      startTime: ctx.currentTime + 0.05,
      secPerBeat: 60 / (prep.song.bpm * mult),
      cursors: prep.channels.map(() => 0),
      loopsDone: prep.channels.map(() => 0),
      bus,
      done: false,
    };
  }

  private stopPlaying(p: Playing | null): void {
    if (!p || !this.ctx) return;
    p.done = true;
    const g = p.bus.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    const bus = p.bus;
    setTimeout(() => bus.disconnect(), 300);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const horizon = ctx.currentTime + 0.15;
    for (const p of [this.main, this.over, this.jingleP]) if (p && !p.done) this.schedule(p, horizon);
    // Jingle finished: bring the music back.
    if (this.jingleP?.done) {
      this.jingleP = null;
      const target = this.over ?? this.main;
      target?.bus.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
    }
    if (this.over?.done && !this.over.prep.song.loop) this.overrideMusic(null);
  }

  private schedule(p: Playing, horizon: number): void {
    const { prep } = p;
    let allDone = true;
    prep.channels.forEach((ch, ci) => {
      const loopLen = prep.song.loop ? ch.length : Infinity;
      for (;;) {
        if (p.cursors[ci]! >= ch.events.length) {
          if (!prep.song.loop || ch.events.length === 0) break;
          p.cursors[ci] = 0;
          p.loopsDone[ci]!++;
        }
        const ev = ch.events[p.cursors[ci]!]!;
        const beat = ev.t + p.loopsDone[ci]! * (loopLen === Infinity ? 0 : loopLen);
        const time = p.startTime + beat * p.secPerBeat;
        if (time > horizon) {
          allDone = false;
          break;
        }
        if (time >= this.ctx!.currentTime - 0.05) this.playNote(ev, time, ev.dur * p.secPerBeat, p.bus);
        p.cursors[ci]!++;
      }
      if (prep.song.loop || p.cursors[ci]! < ch.events.length) allDone = false;
    });
    if (allDone && !prep.song.loop) {
      const endTime = p.startTime + prep.length * p.secPerBeat;
      if (this.ctx!.currentTime > endTime) p.done = true;
    }
  }

  // ------------------------------------------------------------------ instruments

  private playNote(ev: NoteEvent, t: number, dur: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const vol = (ev.vol / 15) * 0.22;
    if (ev.inst === 8) {
      this.drum(ev.note % 12, t, vol * 1.4, out);
      return;
    }
    const f = midiToHz(ev.note);
    const env = ctx.createGain();
    env.connect(out);
    const g = env.gain;
    const rel = 0.04;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(vol, t + 0.005);
    const sustain = ev.inst === 5 ? vol * 0.25 : ev.inst === 3 ? vol * 0.7 : vol * 0.6;
    g.setTargetAtTime(sustain, t + 0.005, ev.inst === 5 ? 0.12 : 0.06);
    g.setTargetAtTime(0, t + Math.max(0.01, dur), rel / 3);
    const stop = t + dur + rel * 2;
    switch (ev.inst) {
      case 0:
      case 1:
      case 6: {
        const o = ctx.createOscillator();
        if (ev.inst === 0) o.type = 'square';
        else if (ev.inst === 1) o.setPeriodicWave(this.pulse25);
        else o.type = 'sawtooth';
        o.frequency.value = f;
        if (ev.inst === 6) {
          const lp = ctx.createBiquadFilter();
          lp.frequency.value = 1800;
          o.connect(lp).connect(env);
        } else o.connect(env);
        // Light vibrato on long notes
        if (dur > 0.3) {
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = 5.5;
          lg.gain.value = f * 0.006;
          lfo.connect(lg).connect(o.frequency);
          lfo.start(t + 0.15);
          lfo.stop(stop);
        }
        o.start(t);
        o.stop(stop);
        break;
      }
      case 2: {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(env);
        o.start(t);
        o.stop(stop);
        break;
      }
      default: {
        // Two-operator FM (3 bass, 4 lead, 5 bell, 7 organ).
        const ratio = { 3: 1, 4: 2, 5: 3.5, 7: 1 }[ev.inst] ?? 1;
        const index = { 3: 2.2, 4: 1.6, 5: 4, 7: 0.8 }[ev.inst] ?? 1;
        const car = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const mg = ctx.createGain();
        car.frequency.value = f;
        mod.frequency.value = f * ratio;
        mg.gain.setValueAtTime(f * index, t);
        mg.gain.setTargetAtTime(
          f * index * (ev.inst === 4 || ev.inst === 7 ? 0.6 : 0.15),
          t,
          ev.inst === 5 ? 0.08 : 0.15,
        );
        mod.connect(mg).connect(car.frequency);
        car.connect(env);
        if (ev.inst === 7) {
          const c2 = ctx.createOscillator();
          c2.frequency.value = f * 2;
          const g2 = ctx.createGain();
          g2.gain.value = 0.3;
          c2.connect(g2).connect(env);
          c2.start(t);
          c2.stop(stop);
        }
        car.start(t);
        mod.start(t);
        car.stop(stop);
        mod.stop(stop);
      }
    }
  }

  private drum(n: number, t: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    if (n === 0) {
      // Kick
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol * 2.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    if (n === 4) {
      // Tom
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.18);
      g.gain.setValueAtTime(vol * 1.6, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.25);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    let len: number;
    if (n === 2) {
      // Snare: noise + body
      f.type = 'bandpass';
      f.frequency.value = 1800;
      len = 0.16;
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      og.gain.setValueAtTime(vol, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(og).connect(out);
      o.start(t);
      o.stop(t + 0.12);
    } else if (n === 11) {
      f.type = 'highpass';
      f.frequency.value = 3000;
      len = 0.6;
    } else {
      f.type = 'highpass';
      f.frequency.value = 7000;
      len = n === 9 ? 0.18 : 0.04;
    }
    g.gain.setValueAtTime(vol * (n === 2 ? 1.6 : 0.8), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
  }

  // ------------------------------------------------------------------ effects

  sfx(s: Sfx, pan = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const out = ctx.createStereoPanner();
    out.pan.value = pan;
    out.connect(this.sfxGain);
    const tone = (
      type: OscillatorType | 'pulse25',
      f0: number,
      f1: number,
      dur: number,
      vol = 0.25,
      at = 0,
      exp = true,
    ) => {
      const o = ctx.createOscillator();
      if (type === 'pulse25') o.setPeriodicWave(this.pulse25);
      else o.type = type;
      const g = ctx.createGain();
      o.frequency.setValueAtTime(f0, t + at);
      if (exp) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + at + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(vol, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
      o.connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + dur + 0.02);
    };
    const noise = (
      dur: number,
      vol: number,
      freq: number,
      type: BiquadFilterType = 'lowpass',
      at = 0,
      f1?: number,
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t + at);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t + at, Math.random() * 0.5);
      src.stop(t + at + dur + 0.02);
    };
    switch (s) {
      case 'jump':
        tone('pulse25', 280, 820, 0.14, 0.2);
        break;
      case 'ring':
        out.pan.value = (this.ringPan = -this.ringPan) * 0.6;
        tone('square', 1760, 1760, 0.06, 0.12, 0, false);
        tone('square', 2349, 2349, 0.16, 0.12, 0.05, false);
        break;
      case 'ringLoss':
        for (let i = 0; i < 6; i++) tone('square', 2400 - i * 180, 1800 - i * 180, 0.08, 0.08, i * 0.035);
        noise(0.2, 0.15, 3000, 'highpass');
        break;
      case 'spindash':
        tone('sawtooth', 220, 880, 0.22, 0.14);
        noise(0.2, 0.08, 2000, 'bandpass', 0, 6000);
        break;
      case 'release':
        noise(0.3, 0.2, 6000, 'lowpass', 0, 300);
        tone('pulse25', 700, 200, 0.2, 0.12);
        break;
      case 'roll':
        noise(0.14, 0.12, 4000, 'bandpass', 0, 1500);
        break;
      case 'skid':
        noise(0.22, 0.18, 1500, 'bandpass', 0, 600);
        tone('square', 300, 220, 0.18, 0.06);
        break;
      case 'hurt':
      case 'death':
        tone('square', 700, 140, s === 'death' ? 0.5 : 0.3, 0.2);
        noise(0.18, 0.15, 2500);
        break;
      case 'spring':
        tone('triangle', 200, 760, 0.12, 0.3);
        tone('square', 760, 520, 0.18, 0.08, 0.1);
        break;
      case 'pop':
        noise(0.18, 0.3, 1800);
        tone('square', 160, 60, 0.15, 0.15);
        break;
      case 'explode':
      case 'wallBreak':
      case 'collapse':
        noise(s === 'collapse' ? 0.5 : 0.4, 0.35, s === 'wallBreak' ? 3000 : 1200, 'lowpass', 0, 120);
        tone('square', 120, 40, 0.3, 0.12);
        break;
      case 'shield':
      case 'bubbleShield':
      case 'fireShield':
      case 'lightningShield':
        for (let i = 0; i < 4; i++)
          tone('pulse25', 523 * Math.pow(1.26, i), 523 * Math.pow(1.26, i), 0.08, 0.1, i * 0.05, false);
        if (s === 'fireShield') noise(0.3, 0.12, 800, 'bandpass', 0, 3000);
        if (s === 'lightningShield') noise(0.2, 0.12, 8000, 'highpass');
        break;
      case 'fireDash':
        noise(0.35, 0.25, 600, 'bandpass', 0, 4000);
        break;
      case 'bubbleBounce':
        tone('sine', 300, 900, 0.15, 0.25);
        break;
      case 'doubleJump':
        noise(0.12, 0.15, 9000, 'highpass');
        tone('square', 900, 1800, 0.1, 0.1);
        break;
      case 'instaShield':
        noise(0.12, 0.15, 5000, 'bandpass', 0, 1200);
        break;
      case 'splash':
        noise(0.3, 0.2, 5000, 'highpass', 0, 800);
        break;
      case 'drownWarn':
        tone('triangle', 1318, 1318, 0.2, 0.2, 0, false);
        break;
      case 'drown':
        tone('square', 600, 80, 0.8, 0.15);
        break;
      case 'breath':
        tone('sine', 220, 660, 0.12, 0.3);
        break;
      case 'checkpoint':
        tone('triangle', 1046, 1046, 0.1, 0.25, 0, false);
        tone('triangle', 1568, 1568, 0.25, 0.25, 0.1, false);
        break;
      case 'signpost':
        for (let i = 0; i < 12; i++) tone('square', i % 2 ? 1568 : 1318, 1318, 0.05, 0.06, i * 0.06, false);
        break;
      case 'bossHit':
        tone('square', 180, 120, 0.2, 0.25);
        tone('square', 189, 125, 0.2, 0.2);
        noise(0.15, 0.2, 2000);
        break;
      case 'fly':
        noise(0.06, 0.06, 1200, 'bandpass');
        break;
      case 'glide':
        noise(0.25, 0.1, 800, 'bandpass', 0, 2000);
        break;
      case 'grab':
        tone('triangle', 160, 90, 0.08, 0.3);
        break;
      case 'super':
        for (let i = 0; i < 6; i++)
          tone('pulse25', 392 * Math.pow(1.19, i), 392 * Math.pow(1.19, i), 0.12, 0.12, i * 0.06, false);
        noise(0.6, 0.12, 400, 'bandpass', 0, 6000);
        break;
      case 'oneUp':
        this.jingle('oneUp');
        break;
      case 'giantRing':
        for (let i = 0; i < 10; i++)
          tone('triangle', 880 * Math.pow(1.12, i), 880 * Math.pow(1.12, i), 0.1, 0.12, i * 0.04, false);
        break;
      case 'click':
        tone('square', 1200, 1200, 0.03, 0.1, 0, false);
        break;
      case 'select':
        tone('square', 880, 880, 0.06, 0.12, 0, false);
        tone('square', 1320, 1320, 0.12, 0.12, 0.06, false);
        break;
      case 'blueSphere':
        tone('triangle', 1046, 1568, 0.08, 0.2);
        break;
      case 'redSphere':
        tone('sawtooth', 200, 60, 0.5, 0.2);
        break;
      case 'bumper':
        tone('square', 400, 800, 0.08, 0.15);
        tone('square', 800, 600, 0.1, 0.1, 0.06);
        break;
      case 'tally':
        tone('square', 1500, 1500, 0.025, 0.08, 0, false);
        break;
    }
  }
  private ringPan = 1;

  dispose(): void {
    clearInterval(this.timer);
    void this.ctx?.close();
  }
}
