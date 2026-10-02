import { beetleWheel, clawTank, snapFish, waspJet } from '../../art/badniks';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { registerObject } from '../base';
import { Badnik, Projectile } from './badnik';

/** Ground patroller: rolls along, pauses and turns at ledges and walls. */
export class BeetleWheel extends Badnik {
  private pause = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 16;
    this.hh = 12;
  }
  override update(act: Act): void {
    this.t++;
    if (this.pause > 0) {
      if (--this.pause === 0) this.facing = this.facing > 0 ? -1 : 1;
      return;
    }
    const nx = this.x + this.facing;
    const ahead = this.floorBelow(act, nx + this.facing * 12, this.y + 12);
    if (ahead > 12 || ahead < -12 || this.wallAhead(act, 18, this.y)) {
      this.pause = 60;
      return;
    }
    this.x = nx;
    const d = this.floorBelow(act, this.x, this.y + 12);
    if (Math.abs(d) <= 12) this.y += d;
    if (this.t % 16 === 0) act.effect('smoke', this.x - this.facing * 20, this.y - 2);
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    this.drawImg(r, beetleWheel(this.pause > 0 ? 0 : this.t >> 2), cx, cy);
  }
}

/** Flies back and forth; stops to fire a diagonal shot when the player is below. */
export class WaspJet extends Badnik {
  private readonly x0: number;
  private fireTimer = 0;
  private cooldown = 0;
  constructor(
    x: number,
    y: number,
    readonly range: number,
  ) {
    super(x, y);
    this.x0 = x;
    this.hw = 18;
    this.hh = 10;
  }
  override update(act: Act): void {
    this.t++;
    if (this.cooldown > 0) this.cooldown--;
    if (this.fireTimer > 0) {
      this.fireTimer--;
      if (this.fireTimer === 30) {
        act.spawn(new Projectile(this.x + this.facing * 12, this.y + 12, this.facing * 2, 2));
      }
      return;
    }
    const p = act.leader;
    const dx = p.x - this.x;
    if (
      this.cooldown === 0 &&
      Math.sign(dx) === this.facing &&
      Math.abs(dx) < 80 &&
      p.y > this.y &&
      !p.dead
    ) {
      this.fireTimer = 60;
      this.cooldown = 180;
      return;
    }
    this.x += this.facing * 2;
    if (Math.abs(this.x - this.x0) > this.range) {
      this.x = this.x0 + Math.sign(this.x - this.x0) * this.range;
      this.facing = this.facing > 0 ? -1 : 1;
    }
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    this.drawImg(r, waspJet(this.t >> 1, this.fireTimer > 0), cx, cy);
  }
}

/** Walks slowly, then stops and lobs two shots in arcs. */
export class ClawTank extends Badnik {
  private state: 'walk' | 'aim' = 'walk';
  private timer = 120;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 18;
    this.hh = 14;
  }
  override update(act: Act): void {
    this.t++;
    if (--this.timer <= 0) {
      if (this.state === 'walk') {
        this.state = 'aim';
        this.timer = 60;
      } else {
        this.state = 'walk';
        this.timer = 120;
        this.facing = this.facing > 0 ? -1 : 1;
      }
    }
    if (this.state === 'aim') {
      if (this.timer === 30) {
        act.spawn(new Projectile(this.x - 18, this.y - 14, -1, -4, 0.21875));
        act.spawn(new Projectile(this.x + 18, this.y - 14, 1, -4, 0.21875));
      }
      return;
    }
    if (this.t % 2) return;
    const nx = this.x + this.facing;
    const ahead = this.floorBelow(act, nx + this.facing * 16, this.y + 16);
    if (ahead > 12 || ahead < -12 || this.wallAhead(act, 22, this.y)) {
      this.facing = this.facing > 0 ? -1 : 1;
      return;
    }
    this.x = nx;
    const d = this.floorBelow(act, this.x, this.y + 16);
    if (Math.abs(d) <= 12) this.y += d;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(clawTank(this.t >> 3, this.state === 'aim' ? 1 : 0), this.x - cx, this.y - cy);
  }
}

/** Leaps up from below bridges. */
export class SnapFish extends Badnik {
  private vy = 0;
  private readonly y0: number;
  constructor(x: number, y: number) {
    super(x, y);
    this.y0 = y;
    this.hw = 10;
    this.hh = 12;
    this.t = Math.floor(x) % 90;
  }
  override update(): void {
    this.t++;
    if (this.y >= this.y0 && this.t % 120 === 0) this.vy = -7;
    this.y += this.vy;
    this.vy += 0.1875;
    if (this.y > this.y0) {
      this.y = this.y0;
      this.vy = 0;
    }
    this.hw = this.y < this.y0 ? 10 : 0;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    if (this.y >= this.y0) return;
    r.image(snapFish(this.t >> 3), this.x - cx, this.y - cy, { flipY: this.vy > 0 });
  }
}

registerObject('beetleWheel', (x, y) => new BeetleWheel(x, y));
registerObject('waspJet', (x, y, p) => new WaspJet(x, y, (p.range as number) ?? 128));
registerObject('clawTank', (x, y) => new ClawTank(x, y));
registerObject('snapFish', (x, y) => new SnapFish(x, y));
