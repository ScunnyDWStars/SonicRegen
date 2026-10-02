import { bloomGun, cocoBot, rhinoDash, roundShot } from '../../art/badniks';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { registerObject } from '../base';
import { Badnik, Projectile } from './badnik';

/** Clings to a tree trunk, climbs up and down and lobs coconuts. */
export class CocoBot extends Badnik {
  private readonly y0: number;
  private timer = 90;
  private throwT = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.y0 = y;
    this.hw = 12;
    this.hh = 14;
  }
  override update(act: Act): void {
    this.t++;
    const p = act.leader;
    this.facing = p.x < this.x ? -1 : 1;
    this.y = this.y0 + Math.sin(this.t / 50) * 24;
    if (this.throwT > 0) {
      if (--this.throwT === 10) {
        const dx = p.x - this.x;
        act.spawn(
          new Projectile(
            this.x + this.facing * 8,
            this.y - 12,
            Math.max(-3, Math.min(3, dx / 50)),
            -3,
            0.15,
            undefined,
            (f) => roundShot('coconut', f),
          ),
        );
      }
      return;
    }
    if (--this.timer <= 0 && Math.abs(p.x - this.x) < 200 && !p.dead) {
      this.throwT = 30;
      this.timer = 120;
    }
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    this.drawImg(r, cocoBot(this.t >> 3, this.throwT > 0), cx, cy);
  }
}

/** Patrols, then turns on a dime and charges when it spots the player. */
export class RhinoDash extends Badnik {
  private charge = 0;
  private skid = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 18;
    this.hh = 12;
  }
  override update(act: Act): void {
    this.t++;
    const p = act.leader;
    if (this.skid > 0) {
      this.skid--;
      if (this.skid === 0) this.facing = this.facing > 0 ? -1 : 1;
      return;
    }
    const dx = p.x - this.x;
    if (this.charge === 0 && Math.abs(dx) < 160 && Math.abs(p.y - this.y) < 40 && !p.dead) {
      if (Math.sign(dx) !== this.facing) {
        this.skid = 12;
        return;
      }
      this.charge = 90;
    }
    const speed = this.charge > 0 ? 4 : 1;
    if (this.charge > 0) this.charge--;
    const nx = this.x + this.facing * speed;
    const ahead = this.floorBelow(act, nx + this.facing * 14, this.y + 12);
    if (ahead > 12 || ahead < -12 || this.wallAhead(act, 22, this.y)) {
      this.skid = 20;
      this.charge = 0;
      return;
    }
    this.x = nx;
    const d = this.floorBelow(act, this.x, this.y + 12);
    if (Math.abs(d) <= 12) this.y += d;
    if (this.charge > 0 && this.t % 6 === 0) act.effect('dust', this.x - this.facing * 20, this.y + 10);
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    this.drawImg(r, rhinoDash(this.t >> 2, this.charge > 0), cx, cy);
  }
}

/** Stationary flower turret: opens and fires seeds up and to both sides. */
export class BloomGun extends Badnik {
  /** `y` is the ground under the flower; the hitbox sits on the bloom. */
  constructor(x: number, y: number) {
    super(x, y - 20);
    this.hw = 10;
    this.hh = 14;
    this.t = Math.floor(x) % 120;
  }
  override update(act: Act): void {
    this.t++;
    const phase = this.t % 160;
    if (phase === 120 && Math.abs(act.leader.x - this.x) < 240) {
      for (const vx of [-1.5, 1.5])
        act.spawn(new Projectile(this.x, this.y - 4, vx, -4.5, 0.15, undefined, (f) => roundShot('seed', f)));
    }
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    const phase = this.t % 160;
    r.image(bloomGun(this.t >> 4, phase > 100 && phase < 140), this.x - cx, this.y - cy + 13);
  }
}

registerObject('cocoBot', (x, y) => new CocoBot(x, y));
registerObject('rhinoDash', (x, y) => new RhinoDash(x, y));
registerObject('bloomGun', (x, y) => new BloomGun(x, y));
