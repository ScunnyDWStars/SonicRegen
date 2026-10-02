import { rgb } from '../art/pixels';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { sprites } from '../game/act';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';
import type { Team } from '../game/session';
import type { CharId } from '../player/types';

interface Option {
  team: Team;
  label: string;
  chars: CharId[];
  blurb: string;
}

export const TEAM_OPTIONS: Option[] = [
  {
    team: 'sonic+tails',
    label: 'SONIC & TAILS',
    chars: ['sonic', 'tails'],
    blurb: 'TAILS FOLLOWS. UP+JUMP: CARRY',
  },
  { team: 'sonic', label: 'SONIC', chars: ['sonic'], blurb: 'INSTA-SHIELD AND SHIELD MOVES' },
  { team: 'tails', label: 'TAILS', chars: ['tails'], blurb: 'JUMP TWICE TO FLY OR SWIM' },
  { team: 'knuckles', label: 'KNUCKLES', chars: ['knuckles'], blurb: 'GLIDE, CLIMB AND BREAK WALLS' },
];

/** Pick a character (or the Sonic & Tails team). */
export class CharacterSelect implements Scene {
  readonly music = 'menu';
  private sel = 0;
  private t = 0;
  private chosen = -1;

  constructor(
    private readonly onPick: (game: Game, team: Team) => void,
    private readonly onBack?: (game: Game) => void,
    initial: Team = 'sonic+tails',
  ) {
    this.sel = Math.max(
      0,
      TEAM_OPTIONS.findIndex((o) => o.team === initial),
    );
  }

  update(game: Game): void {
    this.t++;
    const pad = game.pad;
    if (this.chosen >= 0) {
      if (++this.chosen > 40 && !game.transitioning) this.onPick(game, TEAM_OPTIONS[this.sel]!.team);
      return;
    }
    if (pad.isPressed(Btn.Left)) {
      this.sel = (this.sel + TEAM_OPTIONS.length - 1) % TEAM_OPTIONS.length;
      game.sound.sfx('click');
    }
    if (pad.isPressed(Btn.Right)) {
      this.sel = (this.sel + 1) % TEAM_OPTIONS.length;
      game.sound.sfx('click');
    }
    if (pad.isPressed(Btn.Start | Btn.A | Btn.C)) {
      this.chosen = 0;
      game.sound.sfx('select');
    } else if (pad.isPressed(Btn.B) && this.onBack) {
      this.onBack(game);
    }
  }

  render(r: Renderer): void {
    // Scrolling diagonal checker background.
    r.clear(rgb(16, 32, 120));
    const off = (this.t / 2) % 32;
    for (let y = -32; y < SCREEN_H + 32; y += 32)
      for (let x = -32; x < SCREEN_W + 32; x += 32)
        if (((x + y) / 32) % 2 === 0) r.rect(x + off, y + off, 32, 32, rgb(24, 48, 152));
    r.textScaled('SELECT PLAYER', 56, 16, 2, rgb(252, 228, 48));
    const n = TEAM_OPTIONS.length;
    const slotW = SCREEN_W / n;
    TEAM_OPTIONS.forEach((o, i) => {
      const cx = slotW * i + slotW / 2;
      const on = i === this.sel;
      r.rect(cx - 36, 60, 72, 96, on ? rgb(252, 228, 48) : rgb(8, 16, 72));
      r.rect(cx - 34, 62, 68, 92, on ? rgb(40, 96, 216) : rgb(24, 48, 136));
      const anim = on ? (this.chosen >= 0 ? 'victory' : 'walk') : 'idle';
      o.chars.forEach((c, k) => {
        const dx = o.chars.length > 1 ? (k === 0 ? 10 : -14) : 0;
        const img = sprites.frame(c, anim, Math.floor(this.t / 6));
        r.image(img, cx + dx, 112 + (k ? 4 : 0));
      });
      const label = o.label.length > 8 ? o.label.split(' & ') : [o.label];
      label.forEach((l, k) =>
        r.text(l, cx - l.length * 4, 162 + k * 10, on ? rgb(255, 255, 255) : rgb(140, 160, 220)),
      );
    });
    const sel = TEAM_OPTIONS[this.sel]!;
    r.textCentered(sel.blurb, 196, rgb(255, 255, 255));
    if (this.chosen > 0 && this.chosen & 4) r.textCentered('GOOD LUCK!', 40, rgb(255, 255, 255));
  }
}
