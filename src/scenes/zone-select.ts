import { rgb } from '../art/pixels';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';
import type { ZoneDef } from '../zones';
import { emeraldImg } from './special-stage';
import { menuBackground, panel, WHITE, YELLOW } from './menu-ui';

/** The hub: pick any unlocked zone. Shows collected emeralds. */
export class ZoneSelect implements Scene {
  readonly music = 'menu';
  private sel: number;
  private t = 0;

  constructor(
    private readonly zones: ZoneDef[],
    private readonly onPick: (game: Game, zoneIndex: number) => void,
    private readonly onBack: (game: Game) => void,
    initial = 0,
  ) {
    this.sel = initial;
  }

  update(game: Game): void {
    this.t++;
    if (game.transitioning) return;
    const pad = game.pad;
    const max = Math.min(this.zones.length, game.session.unlocked) - 1;
    if (pad.isPressed(Btn.Up)) {
      this.sel = Math.max(0, this.sel - 1);
      game.sound.sfx('click');
    }
    if (pad.isPressed(Btn.Down)) {
      this.sel = Math.min(this.zones.length - 1, this.sel + 1);
      game.sound.sfx('click');
    }
    if (pad.isPressed(Btn.Start | Btn.A | Btn.C) && this.sel <= max) {
      game.sound.sfx('select');
      this.onPick(game, this.sel);
    }
    if (pad.isPressed(Btn.B)) this.onBack(game);
  }

  render(r: Renderer, game: Game): void {
    menuBackground(r, this.t, rgb(40, 16, 96), rgb(56, 24, 128));
    r.textScaled('ZONE SELECT', 72, 14, 2, YELLOW);
    const unlocked = game.session.unlocked;
    this.zones.forEach((z, i) => {
      const y = 50 + i * 40;
      const on = i === this.sel;
      panel(r, 40, y, 240, 34, on);
      if (i < unlocked) {
        r.text(z.name, 52, y + 8, WHITE);
        r.text(z.game, 52, y + 20, rgb(200, 220, 255));
        r.text(`${z.acts.length} ACTS`, 220, y + 20, rgb(200, 220, 255));
      } else {
        r.text('? ? ?', 52, y + 12, rgb(140, 140, 180));
      }
    });
    for (let e = 0; e < 7; e++) {
      const got = game.session.emeralds & (1 << e);
      if (got) r.image(emeraldImg(e, false), 112 + e * 14, 186);
      else r.rect(108 + e * 14, 182, 8, 8, rgb(40, 40, 80));
    }
    r.textCentered('A: PLAY   B: BACK', 204, WHITE);
  }
}
