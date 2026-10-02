import { rgb } from '../art/pixels';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { sprites } from '../game/act';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';
import { PALM_COAST } from '../zones/palm-coast/theme';
import { emeraldImg } from './special-stage';

/** Shown after the last zone. */
export class EndingScene implements Scene {
  readonly music = 'ending';
  private t = 0;
  constructor(private readonly onDone: (game: Game) => void) {}
  update(game: Game): void {
    this.t++;
    if (!game.transitioning && this.t > 240 && game.pad.isPressed(Btn.Start | Btn.A)) this.onDone(game);
  }
  render(r: Renderer, game: Game): void {
    PALM_COAST.drawBackground(r, this.t, 200, this.t);
    r.textScaled('CONGRATULATIONS!', 32, 30, 2, rgb(252, 228, 48));
    const all = game.session.allEmeralds;
    r.textCentered(
      all ? 'ALL SEVEN EMERALDS FOUND!' : `EMERALDS: ${game.session.emeraldCount} / 7`,
      64,
      rgb(255, 255, 255),
    );
    for (let e = 0; e < 7; e++)
      if (game.session.emeralds & (1 << e)) r.image(emeraldImg(e, false), 112 + e * 14, 84);
    r.textCentered(`SCORE ${game.session.score}`, 104, rgb(255, 255, 255));
    const id =
      game.session.team === 'tails' ? 'tails' : game.session.team === 'knuckles' ? 'knuckles' : 'sonic';
    r.image(sprites.frame(id, 'victory', 0), 160, 170);
    if (game.session.team === 'sonic+tails') r.image(sprites.frame('tails', 'victory', 0), 130, 174);
    r.textCentered('THANK YOU FOR PLAYING', 196, rgb(255, 255, 255));
    if (this.t > 240 && (this.t >> 5) & 1) r.textCentered('PRESS START', 210, rgb(252, 228, 48));
  }
}
