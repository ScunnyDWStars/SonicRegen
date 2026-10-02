import { rgb } from '../art/pixels';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';

/** Simple full-screen message (GAME OVER, TIME OVER...) that continues after a delay or a button. */
export class MessageScene implements Scene {
  readonly music: string | null;
  private t = 0;
  constructor(
    private readonly lines: string[],
    private readonly next: (game: Game) => void,
    music: string | null = null,
    private readonly minFrames = 60,
    private readonly maxFrames = 600,
  ) {
    this.music = music;
  }
  update(game: Game): void {
    this.t++;
    const skip = this.t > this.minFrames && game.pad.isPressed(Btn.Start | Btn.A | Btn.B | Btn.C);
    if ((skip || this.t === this.maxFrames) && !game.transitioning) this.next(game);
  }
  render(r: Renderer): void {
    r.clear(rgb(0, 0, 0));
    const slide = Math.max(0, 1 - this.t / 30);
    this.lines.forEach((l, i) => {
      const w = l.length * 16;
      const x = (320 - w) / 2 + (i % 2 ? 1 : -1) * slide * 200;
      r.textScaled(l, x, 88 + i * 24, 2, rgb(255, 255, 255));
    });
  }
}
