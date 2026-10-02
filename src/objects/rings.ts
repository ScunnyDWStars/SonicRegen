import { PixelImage, rgb } from '../art/pixels';
import type { Renderer } from '../engine/renderer';
import { DOWN } from '../level/collision';
import type { Player } from '../player/Player';
import type { Act } from '../game/act';
import { GameObject, registerObject } from './base';

const GOLD = rgb(252, 216, 48);
const GOLD_HI = rgb(255, 252, 184);
const GOLD_DK = rgb(200, 128, 16);
const OUT = rgb(96, 48, 8);

/** Ring spin frames: full face to edge-on and back. */
const ringFrames: PixelImage[] = [];
export function ringFrame(i: number): PixelImage {
  if (!ringFrames.length) {
    for (const wf of [1, 0.75, 0.45, 0.15]) {
      const img = new PixelImage(16, 16);
      img.ox = 8;
      img.oy = 8;
      const rx = 6.5 * wf + 0.6;
      img.ellipse(8, 8, rx, 6.5, GOLD);
      if (wf > 0.3) img.ellipse(8, 8, Math.max(0.5, rx - 2.6), 3.9, 0);
      img.ellipse(8 - rx * 0.35, 6, Math.max(0.6, rx * 0.25), 2, GOLD_HI);
      if (wf > 0.3) img.ellipse(8 + rx * 0.5, 10, Math.max(0.6, rx * 0.2), 2, GOLD_DK);
      img.outline(OUT);
      ringFrames.push(img);
    }
  }
  return ringFrames[i & 3]!;
}

export class Ring extends GameObject {
  private magnet = false;
  private vx = 0;
  private vy = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 6;
    this.hh = 6;
    this.depth = 2;
  }

  override update(act: Act): void {
    const p = act.leader;
    if (
      !this.magnet &&
      p.shield === 'lightning' &&
      Math.abs(p.x - this.x) < 64 &&
      Math.abs(p.y - this.y) < 64
    )
      this.magnet = true;
    if (this.magnet) {
      if (p.shield !== 'lightning') {
        // Lost the shield: the ring falls as a scattered ring.
        this.dead = true;
        act.spawn(new ScatteredRing(this.x, this.y, this.vx, this.vy, 0));
        return;
      }
      // Sonic 3 ring magnet: accelerate toward the player, faster when moving away.
      const ax = Math.sign(p.x - this.x),
        ay = Math.sign(p.y - this.y);
      this.vx += ax * (Math.sign(this.vx) === ax ? 0.1875 : 0.75);
      this.vy += ay * (Math.sign(this.vy) === ay ? 0.1875 : 0.75);
      this.x += this.vx;
      this.y += this.vy;
    }
  }

  override touch(act: Act, p: Player): void {
    if (p.action === 'hurt' || p.dead) return;
    this.dead = true;
    act.collectRing(this.x, this.y);
  }

  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(ringFrame(Math.floor(act.frame / 8)), this.x - cx, this.y - cy);
  }
}

/** Rings knocked loose when the player is hit. */
export class ScatteredRing extends GameObject {
  private t = 0;
  constructor(
    x: number,
    y: number,
    public vx: number,
    public vy: number,
    private readonly delay = 64,
  ) {
    super(x, y);
    this.hw = 6;
    this.hh = 6;
    this.depth = 6;
    this.alwaysActive = true;
  }

  override update(act: Act): void {
    this.t++;
    const under = this.y > act.waterY;
    this.vy += under ? 0.046875 : 0.09375;
    this.x += this.vx;
    this.y += this.vy;
    // Bounce off floors (checked every 4 frames, like the original).
    if ((act.frame & 3) === 0 && this.vy > 0) {
      const d = act.col.dist(this.x, this.y + 8, DOWN, 0, true);
      if (d < 0) {
        this.y += d;
        this.vy *= -0.75;
      }
    }
    if (this.t > 255 || this.y > act.level.height) this.dead = true;
  }

  override touch(act: Act, p: Player): void {
    if (this.t < this.delay || p.action === 'hurt' || p.dead) return;
    this.dead = true;
    act.collectRing(this.x, this.y);
  }

  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    if (this.t > 192 && this.t & 2) return;
    const speed = this.t < 64 ? 2 : this.t < 128 ? 4 : 8;
    r.image(ringFrame(Math.floor(act.frame / speed)), this.x - cx, this.y - cy);
  }
}

/** Spawn the classic two circles of scattered rings (max 32). */
export function scatterRings(act: Act, x: number, y: number, count: number): void {
  const n = Math.min(32, count);
  let angle = 101.25;
  let speed = 4;
  let flip = false;
  const under = y > act.waterY;
  for (let i = 0; i < n; i++) {
    if (i === 16) {
      speed = 2;
      angle = 101.25;
    }
    let vx = Math.cos((angle * Math.PI) / 180) * speed;
    const vy = -Math.sin((angle * Math.PI) / 180) * speed;
    if (flip) {
      vx = -vx;
      angle += 22.5;
    }
    flip = !flip;
    act.spawn(new ScatteredRing(x, y, under ? vx / 2 : vx, under ? vy / 2 : vy));
  }
}

registerObject('ring', (x, y) => new Ring(x, y));
