import { rgb } from '../art/pixels';
import { Btn } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { sprites } from '../game/act';
import type { Game } from '../game/game';
import { loadSlots, writeSlot, type SaveData } from '../game/save';
import type { Scene } from '../game/scene';
import { emeraldImg } from './special-stage';
import { menuBackground, panel, WHITE, YELLOW } from './menu-ui';

export interface SaveSelectActions {
  /** Start a new game in `slot` (null = no save). */
  newGame(game: Game, slot: number | null): void;
  /** Continue an existing save. */
  load(game: Game, slot: number, data: SaveData): void;
  back(game: Game): void;
}

/** Three save slots plus a no-save option. C deletes a slot (press twice). */
export class SaveSelect implements Scene {
  readonly music = 'menu';
  private sel = 1;
  private t = 0;
  private slots = loadSlots();
  private confirmDelete = -1;

  constructor(
    private readonly zoneNames: string[],
    private readonly actions: SaveSelectActions,
  ) {}

  update(game: Game): void {
    this.t++;
    if (game.transitioning) return;
    const pad = game.pad;
    if (pad.isPressed(Btn.Left)) this.move(game, -1);
    if (pad.isPressed(Btn.Right)) this.move(game, 1);
    if (pad.isPressed(Btn.B)) return this.actions.back(game);
    const slot = this.sel - 1;
    if (pad.isPressed(Btn.C) && slot >= 0 && this.slots[slot]) {
      if (this.confirmDelete === slot) {
        writeSlot(slot, null);
        this.slots = loadSlots();
        this.confirmDelete = -1;
        game.sound.sfx('wallBreak');
      } else {
        this.confirmDelete = slot;
        game.sound.sfx('click');
      }
      return;
    }
    if (pad.isPressed(Btn.Start | Btn.A)) {
      game.sound.sfx('select');
      if (slot < 0) this.actions.newGame(game, null);
      else if (this.slots[slot]) this.actions.load(game, slot, this.slots[slot]!);
      else this.actions.newGame(game, slot);
    }
  }

  private move(game: Game, d: number): void {
    this.sel = (this.sel + d + 4) % 4;
    this.confirmDelete = -1;
    game.sound.sfx('click');
  }

  render(r: Renderer): void {
    menuBackground(r, this.t);
    r.textScaled('DATA SELECT', 72, 14, 2, YELLOW);
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 78,
        y = 48;
      const on = i === this.sel;
      panel(r, x, y, 72, 128, on);
      if (i === 0) {
        r.text('NO', x + 28, y + 40, WHITE);
        r.text('SAVE', x + 20, y + 52, WHITE);
        continue;
      }
      const d = this.slots[i - 1];
      r.text(`SLOT ${i}`, x + 8, y + 8, YELLOW);
      if (!d) {
        r.text('NEW', x + 24, y + 56, WHITE);
        continue;
      }
      const lead = d.team === 'tails' ? 'tails' : d.team === 'knuckles' ? 'knuckles' : 'sonic';
      r.image(sprites.frame(lead, on ? 'walk' : 'idle', Math.floor(this.t / 6)), x + 36, y + 52);
      const zn = d.zone >= this.zoneNames.length ? 'CLEAR!' : (this.zoneNames[d.zone] ?? '');
      zn.split(' ').forEach((w, k) => r.text(w, x + 36 - w.length * 4, y + 76 + k * 10, WHITE));
      for (let e = 0; e < 7; e++)
        if (d.emeralds & (1 << e)) r.image(emeraldImg(e, false), x + 10 + e * 9, y + 108);
      r.text(`×${d.lives}`, x + 26, y + 116, rgb(200, 220, 255));
    }
    const slot = this.sel - 1;
    const hint =
      this.confirmDelete >= 0
        ? 'PRESS C AGAIN TO DELETE'
        : slot >= 0 && this.slots[slot]
          ? 'A: CONTINUE   C: DELETE   B: BACK'
          : 'A: START   B: BACK';
    r.textCentered(hint, 196, this.confirmDelete >= 0 ? rgb(255, 96, 96) : WHITE);
  }
}
