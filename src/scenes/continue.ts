import { rgb } from '../art/pixels';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { sprites } from '../game/act';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';

/** CONTINUE? countdown after a game over when continues remain. */
export class ContinueScene implements Scene {
  readonly music = 'gameOver';
  private t = 0;
  constructor(
    private readonly onYes: (game: Game) => void,
    private readonly onNo: (game: Game) => void,
  ) {}
  update(game: Game): void {
    this.t++;
    if (game.transitioning) return;
    if (this.t > 30 && game.pad.isPressed(Btn.Start | Btn.A | Btn.B | Btn.C)) {
      game.sound.sfx('select');
      this.onYes(game);
    } else if (this.t >= 600) this.onNo(game);
  }
  render(r: Renderer, game: Game): void {
    r.clear(rgb(0, 0, 32));
    r.textScaled('CONTINUE?', 88, 60, 2, rgb(252, 228, 48));
    const n = Math.max(0, 9 - Math.floor(this.t / 60));
    r.textScaled(String(n), 148, 96, 3, rgb(255, 255, 255));
    r.image(sprites.frame('sonic', 'wait', Math.floor(this.t / 20)), 160, 180);
    r.textCentered(`CONTINUES LEFT: ${game.session.continues}`, 200, rgb(200, 220, 255));
  }
}
