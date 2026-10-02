import { rgb } from '../art/pixels';
import { SCREEN_W } from '../engine/constants';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { sprites } from '../game/act';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';
import { ringFrame } from '../objects/rings';
import { PALM_COAST } from '../zones/palm-coast/theme';
import { centeredText, WHITE, YELLOW } from './menu-ui';

export interface TitleActions {
  play(game: Game): void;
  options(game: Game): void;
}

/** Title screen: animated seaside backdrop, logo, PRESS START, then a small menu. */
export class TitleScene implements Scene {
  readonly music = 'title';
  private t = 0;
  private menu = false;
  private sel = 0;
  private readonly items = ['PLAY', 'OPTIONS'];

  constructor(private readonly actions: TitleActions) {}

  update(game: Game): void {
    this.t++;
    const pad = game.pad;
    if (game.transitioning) return;
    if (!this.menu) {
      if (pad.isPressed(Btn.Start | Btn.A | Btn.B | Btn.C) && this.t > 20) {
        this.menu = true;
        game.sound.sfx('select');
      }
      return;
    }
    if (pad.isPressed(Btn.Up | Btn.Down)) {
      this.sel = (this.sel + 1) % this.items.length;
      game.sound.sfx('click');
    }
    if (pad.isPressed(Btn.Start | Btn.A | Btn.C)) {
      game.sound.sfx('select');
      if (this.sel === 0) this.actions.play(game);
      else this.actions.options(game);
    }
    if (pad.isPressed(Btn.B)) this.menu = false;
  }

  render(r: Renderer): void {
    PALM_COAST.drawBackground(r, this.t * 1.5, 120, this.t);
    // Logo: a big ring emblem with two-tone lettering.
    const cx = SCREEN_W / 2;
    const bob = Math.round(Math.sin(this.t / 30) * 2);
    r.ctx.save();
    r.ctx.fillStyle = 'rgba(8,16,72,0.85)';
    r.ctx.beginPath();
    r.ctx.ellipse(cx, 66 + bob, 118, 40, 0, 0, Math.PI * 2);
    r.ctx.fill();
    r.ctx.strokeStyle = '#fce430';
    r.ctx.lineWidth = 4;
    r.ctx.stroke();
    r.ctx.restore();
    r.textScaled('SONIC', cx - 80, 40 + bob, 4, rgb(64, 128, 255), rgb(8, 8, 40));
    r.textScaled('REGEN', cx - 40, 74 + bob, 2, YELLOW, rgb(96, 40, 8));
    r.image(ringFrame(this.t >> 3), cx - 64, 82 + bob);
    r.image(ringFrame(this.t >> 3), cx + 64, 82 + bob);
    // The hero peeks in from the side.
    const pose = this.t % 300 < 150 ? 'wait' : 'victory';
    r.image(sprites.frame('sonic', pose, Math.floor(this.t / 20)), cx + 112, 150);
    r.image(sprites.frame('tails', 'idle', 0), cx - 120, 154);
    r.image(sprites.frame('knuckles', 'idle', 0), cx - 150, 150);
    if (!this.menu) {
      if ((this.t >> 5) & 1) centeredText(r, 'PRESS START', 150, true);
    } else {
      this.items.forEach((it, i) => {
        const on = i === this.sel;
        centeredText(r, (on ? '> ' : '  ') + it + (on ? ' <' : '  '), 140 + i * 14, on);
      });
    }
    r.textCentered('FAN GAME - NOT AFFILIATED WITH SEGA', 208, rgb(200, 220, 255));
    void WHITE;
  }
}
