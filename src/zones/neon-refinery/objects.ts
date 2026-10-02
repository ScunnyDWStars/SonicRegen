import { cached, canvas, OUTLINE } from '../../art/objects';
import { rgb, type PixelImage } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { GameObject, registerObject } from '../../objects/base';
import type { Player } from '../../player/Player';

// ============================================================================ Transport tube

/**
 * A see-through pipe that carries the player along a path at high speed, like the
 * classic chemical-plant tubes. Points are relative to the object position.
 */
export class Tube extends GameObject {
  private readonly pts: [number, number][];
  private readonly lens: number[] = [];
  private readonly total: number;
  private readonly riders = new Map<Player, number>();
  private readonly cooldown = new Map<Player, number>();
  constructor(
    x: number,
    y: number,
    rel: [number, number][],
    readonly speed: number,
  ) {
    super(x, y);
    this.pts = rel.map(([px, py]) => [x + px, y + py]);
    let t = 0;
    for (let i = 0; i + 1 < this.pts.length; i++) {
      const [ax, ay] = this.pts[i]!,
        [bx, by] = this.pts[i + 1]!;
      const l = Math.hypot(bx - ax, by - ay);
      this.lens.push(l);
      t += l;
    }
    this.total = t;
    this.hw = 14;
    this.hh = 14;
    this.depth = 11;
    this.alwaysActive = true;
  }

  private at(d: number): { x: number; y: number; dx: number; dy: number } {
    let i = 0;
    while (i < this.lens.length - 1 && d > this.lens[i]!) d -= this.lens[i++]!;
    const [ax, ay] = this.pts[i]!,
      [bx, by] = this.pts[i + 1]!;
    const l = this.lens[i]!;
    const t = Math.min(1, d / l);
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / l, dy: (by - ay) / l };
  }

  override touch(act: Act, p: Player): void {
    if (this.riders.has(p) || (this.cooldown.get(p) ?? 0) > 0 || p.noClip) return;
    // Only the entrance (first point) grabs players.
    const [ex, ey] = this.pts[0]!;
    if (Math.abs(p.x - ex) > 20 || Math.abs(p.y - ey) > 24) return;
    this.riders.set(p, 0);
    p.noClip = true;
    p.grounded = false;
    p.onObject = null;
    if (!p.ball) p.setBall(true);
    p.action = 'roll';
    act.sfx('roll');
  }

  override update(act: Act): void {
    for (const [p, c] of this.cooldown) if (c > 0) this.cooldown.set(p, c - 1);
    for (const [p, d0] of this.riders) {
      const d = d0 + this.speed;
      if (d >= this.total || p.dead) {
        const end = this.at(this.total - 0.01);
        p.noClip = false;
        p.x = end.x;
        p.y = end.y;
        p.xsp = end.dx * this.speed;
        p.ysp = end.dy * this.speed;
        p.facing = p.xsp >= 0 ? 1 : -1;
        p.grounded = false;
        p.jumping = false;
        this.riders.delete(p);
        this.cooldown.set(p, 30);
        continue;
      }
      const pos = this.at(d);
      p.x = pos.x;
      p.y = pos.y;
      p.xsp = pos.dx * this.speed;
      p.ysp = pos.dy * this.speed;
      p.gsp = p.xsp;
      p.facing = p.xsp >= 0 ? 1 : -1;
      this.riders.set(p, d);
    }
    void act;
  }

  override draw(r: Renderer, cx: number, cy: number): void {
    const ctx = r.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = () => {
      ctx.beginPath();
      this.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - cx, y - cy) : ctx.moveTo(x - cx, y - cy)));
    };
    path();
    ctx.strokeStyle = 'rgba(8,16,48,0.95)';
    ctx.lineWidth = 34;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(48,120,232,0.85)';
    ctx.lineWidth = 30;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(160,216,255,0.6)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
    const [ex, ey] = this.pts[0]!;
    const [ox, oy] = this.pts[this.pts.length - 1]!;
    r.image(tubeMouth(), ex - cx, ey - cy);
    r.image(tubeMouth(), ox - cx, oy - cy);
  }
}

function tubeMouth(): PixelImage {
  return cached('tubeMouth', () => {
    const img = canvas(40, 40);
    img.circle(20, 20, 18, rgb(24, 40, 120));
    img.circle(20, 20, 14, rgb(8, 8, 24));
    img.outline(OUTLINE);
    return img;
  });
}

registerObject(
  'tube',
  (x, y, p) =>
    new Tube(
      x,
      y,
      (p.path as [number, number][]) ?? [
        [0, 0],
        [200, 0],
      ],
      (p.speed as number) ?? 12,
    ),
);

// ============================================================================ Speed booster

/** A floor pad that fires grounded players along at 16 px/frame. */
export class SpeedBooster extends GameObject {
  constructor(
    x: number,
    y: number,
    readonly dir: 1 | -1,
  ) {
    super(x, y);
    this.hw = 16;
    this.hh = 8;
    this.depth = 1;
  }
  override touch(act: Act, p: Player): void {
    if (!p.grounded) return;
    p.gsp = 16 * this.dir;
    p.facing = this.dir;
    p.controlLock = 0;
    if (act.frame % 4 === 0) act.sfx('release');
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(boosterImg((act.frame >> 2) & 3), this.x - cx, this.y - cy, { flipX: this.dir < 0 });
  }
}

function boosterImg(f: number): PixelImage {
  return cached(`boost:${f}`, () => {
    const img = canvas(32, 8, 16, 4);
    img.rect(0, 0, 32, 8, rgb(40, 40, 56));
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 8;
      const lit = i === f;
      img.poly(
        [
          [x, 1],
          [x + 5, 4],
          [x, 7],
        ],
        lit ? rgb(255, 255, 160) : rgb(252, 176, 32),
      );
    }
    img.outline(OUTLINE);
    return img;
  });
}

registerObject('speedBooster', (x, y, p) => new SpeedBooster(x, y, ((p.dir as number) ?? 1) as 1 | -1));
