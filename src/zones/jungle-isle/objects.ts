import { flameImg } from '../../art/badniks';
import { cached, canvas, OUTLINE } from '../../art/objects';
import { rgb, type PixelImage } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import { JUMP } from '../../engine/input';
import type { Act } from '../../game/act';
import { GameObject, registerObject } from '../../objects/base';
import type { Player } from '../../player/Player';
import { jungleState } from './theme';

// ============================================================================ Zipline

/** A handle that slides down a rope. Grab it, ride it, jump off. */
export class Zipline extends GameObject {
  private readonly x1: number;
  private readonly y1: number;
  private readonly len: number;
  private readonly dx: number;
  private readonly dy: number;
  private pos = 0;
  private speed = 0;
  private rider: Player | null = null;
  private reset = 0;
  constructor(x: number, y: number, x1: number, y1: number) {
    super(x, y);
    this.x1 = x1;
    this.y1 = y1;
    this.len = Math.hypot(x1 - x, y1 - y);
    this.dx = (x1 - x) / this.len;
    this.dy = (y1 - y) / this.len;
    this.hw = 12;
    this.hh = 20;
    this.depth = 9;
    this.alwaysActive = true;
  }
  private get hx(): number {
    return this.x + this.dx * this.pos;
  }
  private get hy(): number {
    return this.y + this.dy * this.pos;
  }
  override touch(act: Act, p: Player): void {
    if (this.rider || this.reset > 0 || this.pos > 0 || p.dead || p.noClip) return;
    if (Math.abs(p.x - this.hx) > 14 || Math.abs(p.y - (this.hy + 24)) > 20) return;
    this.rider = p;
    p.action = 'carried';
    if (p.ball) p.setBall(false);
    p.noClip = true;
    p.grounded = false;
    p.onObject = null;
    this.speed = Math.max(2, Math.abs(p.xsp) * 0.5);
    act.sfx('grab');
  }
  override update(act: Act): void {
    if (this.reset > 0 && --this.reset === 0) this.pos = 0;
    const p = this.rider;
    if (!p) return;
    this.speed = Math.min(10, this.speed + 0.12 + this.dy * 0.1);
    this.pos += this.speed;
    const end = this.pos >= this.len;
    if (end) this.pos = this.len;
    p.x = this.hx;
    p.y = this.hy + 24;
    p.facing = this.dx >= 0 ? 1 : -1;
    if (end || p.pad.isPressed(JUMP) || p.dead) {
      p.noClip = false;
      p.action = 'jump';
      p.jumping = p.pad.isPressed(JUMP);
      p.abilityUsed = false;
      p.setBall(true);
      p.xsp = this.dx * this.speed;
      p.ysp = this.dy * this.speed - (p.jumping ? 4 : 0);
      if (p.jumping) act.sfx('jump');
      this.rider = null;
      this.reset = 180;
    }
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.line(this.x - cx, this.y - cy, this.x1 - cx, this.y1 - cy, rgb(80, 56, 32));
    r.line(this.x - cx, this.y - cy + 1, this.x1 - cx, this.y1 - cy + 1, rgb(168, 124, 72));
    r.image(postImg(), this.x - cx, this.y - cy);
    r.image(postImg(), this.x1 - cx, this.y1 - cy);
    r.image(handleImg(), this.hx - cx, this.hy - cy);
  }
}

function handleImg(): PixelImage {
  return cached('zipHandle', () => {
    const img = canvas(16, 24, 8, 2);
    img.circle(8, 3, 3, rgb(176, 184, 208));
    img.line(8, 5, 8, 16, 1.5, rgb(120, 124, 148));
    img.rect(2, 16, 12, 3, rgb(232, 64, 64));
    img.outline(OUTLINE);
    return img;
  });
}

function postImg(): PixelImage {
  return cached('zipPost', () => {
    const img = canvas(12, 12);
    img.circle(6, 6, 4, rgb(120, 80, 40));
    img.outline(OUTLINE);
    return img;
  });
}

registerObject(
  'zipline',
  (x, y, p) => new Zipline(x, y, (p.x1 as number) ?? x + 400, (p.y1 as number) ?? y + 200),
);

// ============================================================================ Flames

/** Ground fire left by firebombs. */
export class Flame extends GameObject {
  private t = 0;
  constructor(
    x: number,
    y: number,
    private readonly life = 90,
  ) {
    super(x, y);
    this.hw = 6;
    this.hh = 10;
    this.depth = 6;
    this.alwaysActive = true;
  }
  override update(): void {
    if (++this.t > this.life) this.dead = true;
  }
  override touch(act: Act, p: Player): void {
    if (p.shield === 'fire') return;
    p.hurt(act, this.x);
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(flameImg(this.t >> 2), this.x - cx, this.y - cy + 10, {
      alpha: this.t > this.life - 20 ? 0.6 : 1,
    });
  }
}

// ============================================================================ Jungle tree (for Cocobots)

export class JungleTree extends GameObject {
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 0;
    this.depth = -1;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(treeImg(jungleState.burnt), this.x - cx, this.y - cy);
  }
}

function treeImg(burnt: boolean): PixelImage {
  return cached(`jtree:${burnt}`, () => {
    const img = canvas(80, 160, 40, 159);
    const bark = burnt ? rgb(56, 36, 28) : rgb(120, 80, 48);
    img.rect(32, 30, 16, 130, bark);
    for (let y = 36; y < 160; y += 12) img.rect(32, y, 16, 2, burnt ? rgb(32, 20, 16) : rgb(88, 56, 32));
    const leaf = burnt ? rgb(80, 48, 40) : rgb(48, 160, 64);
    const leafDk = burnt ? rgb(48, 28, 24) : rgb(24, 112, 48);
    img.ellipse(40, 26, 36, 20, leafDk);
    img.ellipse(30, 20, 20, 12, leaf);
    img.ellipse(54, 22, 18, 11, leaf);
    img.outline(OUTLINE);
    return img;
  });
}

registerObject('jungleTree', (x, y) => new JungleTree(x, y));
