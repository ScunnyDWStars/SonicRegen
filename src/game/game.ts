import type { Sound } from '../audio/sound';
import { Pad } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Scene } from './scene';
import { Session } from './session';

/** Owns the current scene, transitions, session and audio. */
export class Game {
  frame = 0;
  scene: Scene;
  readonly pad = new Pad();
  readonly session = new Session();
  debug = false;
  /** Raw keyboard events this frame (for menus that rebind keys). */
  keyEvents: readonly string[] = [];
  private pending: Scene | null = null;
  private fadeOut = 0;
  private fadeIn = 0;
  private fadeLen = 16;
  /** Hooks supplied by the platform layer (browser). */
  onSave: (g: Game) => void = () => {};

  constructor(
    public readonly sound: Sound,
    first: Scene,
  ) {
    this.scene = first;
    this.applyMusic(first);
  }

  /** Switch scene with a fade to black. */
  goto(next: Scene, fade = 16): void {
    if (fade <= 0) {
      this.scene = next;
      this.applyMusic(next);
      return;
    }
    this.pending = next;
    this.fadeLen = fade;
    this.fadeOut = fade;
  }

  get transitioning(): boolean {
    return this.pending !== null;
  }

  private applyMusic(s: Scene): void {
    if (s.music !== undefined) this.sound.music(s.music);
  }

  update(raw: Pad): void {
    this.pad.copyFrom(raw);
    this.frame++;
    if (this.pending) {
      if (--this.fadeOut <= 0) {
        this.scene = this.pending;
        this.pending = null;
        this.fadeIn = this.fadeLen;
        this.applyMusic(this.scene);
      }
      return;
    }
    if (this.fadeIn > 0) this.fadeIn--;
    this.scene.update(this);
  }

  render(r: Renderer): void {
    this.scene.render(r, this);
    if (this.pending) r.fade(1 - this.fadeOut / this.fadeLen);
    else if (this.fadeIn > 0) r.fade(this.fadeIn / this.fadeLen);
  }
}
