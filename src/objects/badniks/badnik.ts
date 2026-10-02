import type { PixelImage } from '../../art/pixels';
import { shotImg } from '../../art/badniks';
import type { Renderer } from '../../engine/renderer';
import { DOWN, LEFT, RIGHT } from '../../level/collision';
import type { Player } from '../../player/Player';
import type { Act } from '../../game/act';
import { Animal } from '../common';
import { GameObject } from '../base';

/** Common badnik behaviour: destroyed by attacks, hurts otherwise. */
export abstract class Badnik extends GameObject {
  facing: 1 | -1 = -1;
  t = 0;

  constructor(x: number, y: number) {
    super(x, y);
    this.depth = 4;
  }

  override touch(act: Act, p: Player): void {
    if (p.dead) return;
    if (p.attacking) this.destroy(act, p);
    else p.hurt(act, this.x);
  }

  destroy(act: Act, p: Player): void {
    if (this.dead) return;
    this.dead = true;
    act.effect('explosion', this.x, this.y);
    act.sfx('explode');
    act.spawn(new Animal(this.x, this.y, Math.floor(Math.random() * 4)));
    act.badnikScore(p, this.x, this.y - 16);
    act.bounce(p, this.y);
  }

  /** Distance from (x, y) down to the floor (path A). */
  floorBelow(act: Act, x: number, y: number): number {
    return act.col.dist(x, y, DOWN, 0, true);
  }

  /** Is there a wall `ahead` px in front at height y? */
  wallAhead(act: Act, ahead: number, y: number): boolean {
    const d = this.facing > 0 ? RIGHT : LEFT;
    return act.col.dist(this.x + this.facing * ahead, y, d, 0, false) <= 0;
  }

  drawImg(r: Renderer, img: PixelImage, cx: number, cy: number): void {
    r.image(img, this.x - cx, this.y - cy, { flipX: this.facing > 0 });
  }
}

/** Badnik bullets. Elemental shields and the insta-shield deflect them. */
export class Projectile extends GameObject {
  private t = 0;
  constructor(
    x: number,
    y: number,
    public vx: number,
    public vy: number,
    public grv = 0,
    public color?: number,
    /** Custom sprite (coconuts, seeds, bombs). */
    public img?: (frame: number) => PixelImage,
  ) {
    super(x, y);
    this.hw = 4;
    this.hh = 4;
    this.depth = 7;
    this.alwaysActive = true;
  }
  override update(act: Act): void {
    this.t++;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.grv;
    if (this.t > 300 || Math.abs(this.x - act.camera.x - 160) > 400 || this.y > act.camera.y + 400)
      this.dead = true;
  }
  override touch(act: Act, p: Player): void {
    if (p.dead) return;
    const deflect =
      p.instaShield > 0 || p.shield === 'fire' || p.shield === 'bubble' || p.shield === 'lightning';
    if (deflect) {
      const a = Math.atan2(this.y - p.y, this.x - p.x);
      this.vx = Math.cos(a) * 8;
      this.vy = Math.sin(a) * 8;
      this.grv = 0;
      this.hw = 0;
      return;
    }
    if (p.hurt(act, this.x)) this.dead = true;
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(
      this.img ? this.img(act.frame >> 2) : shotImg(act.frame >> 2, this.color),
      this.x - cx,
      this.y - cy,
    );
  }
}
