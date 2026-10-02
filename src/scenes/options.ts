import { rgb } from '../art/pixels';
import { Btn, DEFAULT_KEYS, type KeyMap } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Game } from '../game/game';
import type { Options } from '../game/save';
import type { Scene } from '../game/scene';
import { menuBackground, WHITE, YELLOW } from './menu-ui';

const BIND_ORDER: [string, number][] = [
  ['UP', Btn.Up],
  ['DOWN', Btn.Down],
  ['LEFT', Btn.Left],
  ['RIGHT', Btn.Right],
  ['JUMP (A)', Btn.A],
  ['JUMP (B)', Btn.B],
  ['JUMP (C)', Btn.C],
  ['START', Btn.Start],
];

/** Volume, screen scale and keyboard rebinding. */
export class OptionsScene implements Scene {
  readonly music = 'menu';
  private sel = 0;
  private t = 0;
  private binding = -1;
  private newKeys: KeyMap = {};
  private readonly items = ['MUSIC', 'SOUND FX', 'SCREEN', 'CONTROLS', 'DEFAULT KEYS', 'BACK'];

  constructor(
    private readonly opts: Options,
    private readonly apply: (o: Options) => void,
    private readonly onBack: (game: Game) => void,
  ) {}

  update(game: Game): void {
    this.t++;
    if (game.transitioning) return;
    if (this.binding >= 0) {
      const code = game.keyEvents[0];
      if (code) {
        this.newKeys[code] = BIND_ORDER[this.binding]![1];
        game.sound.sfx('click');
        if (++this.binding >= BIND_ORDER.length) {
          this.binding = -1;
          this.opts.keys = this.newKeys;
          this.apply(this.opts);
        }
      }
      return;
    }
    const pad = game.pad;
    if (pad.isPressed(Btn.Up)) this.sel = (this.sel + this.items.length - 1) % this.items.length;
    if (pad.isPressed(Btn.Down)) this.sel = (this.sel + 1) % this.items.length;
    const d = pad.isPressed(Btn.Left) ? -1 : pad.isPressed(Btn.Right) ? 1 : 0;
    const item = this.items[this.sel];
    if (d) {
      if (item === 'MUSIC') this.opts.music = Math.max(0, Math.min(10, this.opts.music + d));
      if (item === 'SOUND FX') this.opts.sfx = Math.max(0, Math.min(10, this.opts.sfx + d));
      if (item === 'SCREEN') this.opts.scale = (this.opts.scale + d + 5) % 5;
      this.apply(this.opts);
      game.sound.sfx('click');
    }
    if (pad.isPressed(Btn.Start | Btn.A | Btn.C)) {
      if (item === 'CONTROLS') {
        this.binding = 0;
        this.newKeys = {};
      } else if (item === 'DEFAULT KEYS') {
        this.opts.keys = { ...DEFAULT_KEYS };
        this.apply(this.opts);
        game.sound.sfx('select');
      } else if (item === 'BACK') this.onBack(game);
    }
    if (pad.isPressed(Btn.B)) this.onBack(game);
  }

  render(r: Renderer): void {
    menuBackground(r, this.t, rgb(16, 64, 48), rgb(24, 88, 64));
    r.textScaled('OPTIONS', 104, 14, 2, YELLOW);
    if (this.binding >= 0) {
      r.textCentered('PRESS A KEY FOR', 90, WHITE);
      r.textScaled(
        BIND_ORDER[this.binding]![0],
        160 - BIND_ORDER[this.binding]![0].length * 8,
        110,
        2,
        YELLOW,
      );
      return;
    }
    const val = (it: string) =>
      it === 'MUSIC'
        ? bar(this.opts.music)
        : it === 'SOUND FX'
          ? bar(this.opts.sfx)
          : it === 'SCREEN'
            ? this.opts.scale === 0
              ? 'FIT'
              : `${this.opts.scale}X`
            : '';
    this.items.forEach((it, i) => {
      const on = i === this.sel;
      const y = 56 + i * 20;
      r.text(on ? '>' : ' ', 40, y, YELLOW);
      r.text(it, 56, y, on ? WHITE : rgb(160, 200, 180));
      r.text(val(it), 176, y, on ? YELLOW : rgb(160, 200, 180));
    });
    r.textCentered('KEYS: ARROWS/WASD, Z X C / SPACE, ENTER', 190, rgb(200, 240, 220));
    r.textCentered('F1 DEBUG  F2 PAUSE  F3 STEP', 204, rgb(200, 240, 220));
  }
}

function bar(v: number): string {
  return '#'.repeat(v) + '-'.repeat(10 - v);
}
