import { clampSpider, crawlBot, drillBot } from '../../art/badniks';
import { rgb } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { registerObject } from '../base';
import { Badnik, Projectile } from './badnik';

/** Crawls along the floor and lobs a spike ball at the player above. */
export class CrawlBot extends Badnik {
  private cooldown = 60;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 14;
    this.hh = 10;
  }
  override update(act: Act): void {
    this.t++;
    if (this.cooldown > 0) this.cooldown--;
    const p = act.leader;
    if (this.cooldown === 0 && Math.abs(p.x - this.x) < 96 && p.y < this.y - 16 && !p.dead) {
      act.spawn(
        new Projectile(this.x, this.y - 12, Math.sign(p.x - this.x) * 1.5, -5, 0.15, rgb(220, 120, 255)),
      );
      this.cooldown = 120;
    }
    if (this.t % 2) return;
    const nx = this.x + this.facing;
    const ahead = this.floorBelow(act, nx + this.facing * 12, this.y + 12);
    if (ahead > 8 || ahead < -8 || this.wallAhead(act, 16, this.y)) {
      this.facing = this.facing > 0 ? -1 : 1;
      return;
    }
    this.x = nx;
    const d = this.floorBelow(act, this.x, this.y + 12);
    if (Math.abs(d) <= 8) this.y += d;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    this.drawImg(r, crawlBot(this.t >> 3), cx, cy);
  }
}

/** Hangs from the ceiling and drops on a thread when the player passes under. */
export class ClampSpider extends Badnik {
  private readonly y0: number;
  private vy = 0;
  private state: 'wait' | 'drop' | 'hold' | 'rise' = 'wait';
  private timer = 0;
  constructor(
    x: number,
    y: number,
    readonly reach: number,
  ) {
    super(x, y);
    this.y0 = y;
    this.hw = 12;
    this.hh = 10;
  }
  override update(act: Act): void {
    this.t++;
    const p = act.leader;
    switch (this.state) {
      case 'wait':
        if (Math.abs(p.x - this.x) < 40 && p.y > this.y && p.y < this.y + this.reach + 64)
          this.state = 'drop';
        break;
      case 'drop':
        this.vy = Math.min(6, this.vy + 0.5);
        this.y += this.vy;
        if (this.y >= this.y0 + this.reach) {
          this.y = this.y0 + this.reach;
          this.state = 'hold';
          this.timer = 45;
        }
        break;
      case 'hold':
        if (--this.timer <= 0) this.state = 'rise';
        break;
      case 'rise':
        this.y -= 1.5;
        this.vy = 0;
        if (this.y <= this.y0) {
          this.y = this.y0;
          this.state = 'wait';
        }
        break;
    }
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.rect(this.x - cx, this.y0 - 16 - cy, 1, this.y - this.y0 + 16, rgb(220, 220, 240));
    r.image(clampSpider(this.t >> 3), this.x - cx, this.y - cy);
  }
}

/** Charges at the player with its drill, then pauses and turns. */
export class DrillBot extends Badnik {
  private state: 'patrol' | 'charge' | 'rest' = 'patrol';
  private timer = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 18;
    this.hh = 12;
  }
  override update(act: Act): void {
    this.t++;
    const p = act.leader;
    let speed = 0.5;
    if (this.state === 'patrol') {
      if (Math.abs(p.x - this.x) < 140 && Math.abs(p.y - this.y) < 48 && !p.dead) {
        this.facing = p.x < this.x ? -1 : 1;
        this.state = 'charge';
        this.timer = 70;
      }
    } else if (this.state === 'charge') {
      speed = 3;
      if (--this.timer <= 0) {
        this.state = 'rest';
        this.timer = 60;
      }
    } else {
      speed = 0;
      if (--this.timer <= 0) this.state = 'patrol';
    }
    if (speed === 0) return;
    const nx = this.x + this.facing * speed;
    const ahead = this.floorBelow(act, nx + this.facing * 14, this.y + 12);
    if (ahead > 10 || ahead < -10 || this.wallAhead(act, 22, this.y)) {
      this.facing = this.facing > 0 ? -1 : 1;
      if (this.state === 'charge') {
        this.state = 'rest';
        this.timer = 40;
      }
      return;
    }
    this.x = nx;
    const d = this.floorBelow(act, this.x, this.y + 12);
    if (Math.abs(d) <= 10) this.y += d;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    this.drawImg(
      r,
      drillBot(this.state === 'charge' ? this.t : this.t >> 2, this.state === 'charge'),
      cx,
      cy,
    );
  }
}

registerObject('crawlBot', (x, y) => new CrawlBot(x, y));
registerObject('clampSpider', (x, y, p) => new ClampSpider(x, y, (p.reach as number) ?? 96));
registerObject('drillBot', (x, y) => new DrillBot(x, y));
