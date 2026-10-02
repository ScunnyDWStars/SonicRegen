import type { Sfx } from '../player/types';

/** Audio output. The game logic only talks to this interface so it can run headless. */
export interface Sound {
  sfx(s: Sfx, pan?: number): void;
  music(track: string | null, opts?: { restart?: boolean; fadeIn?: boolean }): void;
  /** Temporarily override music (invincibility, drowning, 1-up jingle). */
  overrideMusic(track: string | null): void;
  /** Speed multiplier (speed shoes). */
  setTempo(mult: number): void;
  readonly current: string | null;
  volumes: { music: number; sfx: number };
}

export class NullSound implements Sound {
  current: string | null = null;
  volumes = { music: 1, sfx: 1 };
  log: string[] = [];
  sfx(s: Sfx): void {
    this.log.push(s);
    if (this.log.length > 200) this.log.shift();
  }
  music(track: string | null): void {
    this.current = track;
  }
  overrideMusic(): void {}
  setTempo(): void {}
}
