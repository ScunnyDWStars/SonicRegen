import { chainLink } from '../../art/badniks';
import { cached, canvas, OUTLINE } from '../../art/objects';
import { PixelImage, rgb, shade } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import { Mat } from '../../level/builder';
import type { Act } from '../../game/act';
import { GameObject, registerObject, SolidBox } from '../../objects/base';
import { themedBlock } from '../../objects/common';
import type { Player } from '../../player/Player';

// ============================================================================ Swing platform

/** A platform hanging from a pivot on a chain, swinging like a pendulum. */
export class SwingPlatform extends GameObject {
  private t: number;
  private img: PixelImage | null = null;
  constructor(
    x: number,
    y: number,
    readonly links: number,
    readonly amp: number,
    phase: number,
  ) {
    super(x, y);
    this.hw = 0;
    this.t = phase;
    this.solid = new SolidBox(x, y + links * 16, 24, 8, true);
    this.depth = 3;
    this.alwaysActive = true;
  }
  private angle(): number {
    return Math.sin((this.t / 150) * Math.PI * 2) * this.amp;
  }
  override update(): void {
    this.t++;
    const a = this.angle();
    const L = this.links * 16 + 8;
    this.solid!.moveTo(this.x + Math.sin(a) * L, this.y + Math.cos(a) * L);
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    const a = this.angle();
    for (let i = 1; i <= this.links; i++) {
      const L = i * 16;
      r.image(chainLink(), this.x + Math.sin(a) * L - cx, this.y + Math.cos(a) * L - cy);
    }
    r.image(pivotImg(), this.x - cx, this.y - cy);
    this.img ??= themedBlock(act, 48, 16, Mat.Platform, Math.round(this.x), Math.round(this.y));
    r.image(this.img, this.solid!.x - cx, this.solid!.y - cy);
  }
}

function pivotImg(): PixelImage {
  return cached('pivot', () => {
    const img = canvas(16, 16);
    img.circle(8, 8, 6, rgb(176, 184, 208));
    img.circle(7, 7, 2, rgb(255, 255, 255));
    img.outline(OUTLINE);
    return img;
  });
}

registerObject(
  'swingPlatform',
  (x, y, p) =>
    new SwingPlatform(x, y, (p.links as number) ?? 6, (p.amp as number) ?? 1.0, (p.phase as number) ?? 0),
);

// ============================================================================ Log bridge

/** A bridge of logs that sags under whoever stands on it. */
export class LogBridge extends GameObject {
  private sagAt = -1;
  private sag = 0;
  constructor(
    x: number,
    y: number,
    readonly w: number,
  ) {
    super(x + w / 2, y);
    this.hw = 0;
    const s = new SolidBox(x + w / 2, y + 4, w / 2, 4, true);
    s.surface = (lx) => this.sagOffset(lx + w / 2);
    this.solid = s;
    this.depth = 3;
  }
  /** Sag below the bridge line at px (0 at both anchored ends, deepest under the player). */
  private sagOffset(px: number): number {
    if (this.sagAt < 0 || this.sag <= 0) return 0;
    const w = this.w,
      at = this.sagAt;
    const maxSag = Math.min(this.sag, 2 + 10 * Math.sin((Math.PI * at) / w));
    if (px <= 0 || px >= w) return 0;
    const f =
      px <= at ? Math.sin((Math.PI / 2) * (px / at)) : Math.sin((Math.PI / 2) * ((w - px) / (w - at)));
    return maxSag * f;
  }
  override update(act: Act): void {
    const on = act.players.find((p) => p.onObject === this.solid);
    if (on) {
      this.sagAt = Math.max(8, Math.min(this.w - 8, on.x - (this.x - this.w / 2)));
      this.sag = Math.min(12, this.sag + 1);
    } else {
      this.sag = Math.max(0, this.sag - 1);
    }
  }
  override onStand(_act: Act, p: Player): void {
    // Keep the player glued to the sagging surface.
    p.y = this.solid!.y - this.solid!.hh + this.sagOffset(p.x - (this.x - this.w / 2)) - p.hr;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    const x0 = this.x - this.w / 2;
    for (let lx = 0; lx < this.w; lx += 16) {
      const y = this.y + this.sagOffset(lx + 8);
      r.image(logImg(), x0 + lx + 8 - cx, y - cy);
    }
  }
}

function logImg(): PixelImage {
  return cached('log', () => {
    const img = canvas(16, 12, 8, 2);
    const c = rgb(176, 104, 40);
    img.rect(0, 1, 16, 8, c);
    img.rect(0, 1, 16, 2, shade(c, 1.3));
    img.rect(0, 7, 16, 2, shade(c, 0.7));
    img.rect(15, 1, 1, 8, shade(c, 0.5));
    img.outline(OUTLINE);
    return img;
  });
}

registerObject('logBridge', (x, y, p) => new LogBridge(x, y, (p.w as number) ?? 256));

// ============================================================================ Decorations

export class Decor extends GameObject {
  constructor(
    x: number,
    y: number,
    readonly kind: string,
    depth: number,
    readonly flip: boolean,
  ) {
    super(x, y);
    this.hw = 0;
    this.depth = depth;
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    const img = decorImg(this.kind, act.frame);
    if (img) r.image(img, this.x - cx, this.y - cy, { flipX: this.flip });
  }
}

const LEAF = rgb(48, 184, 40);
const LEAF_DK = rgb(24, 120, 32);
const TRUNK = rgb(184, 120, 56);

export function decorImg(kind: string, frame: number): PixelImage | null {
  switch (kind) {
    case 'palm':
      return cached('palm', () => {
        const img = canvas(96, 128, 48, 127);
        // Curved, segmented trunk
        for (let i = 0; i < 14; i++) {
          const t = i / 13;
          const x = 48 + Math.sin(t * 1.4) * 14,
            y = 126 - t * 92;
          img.ellipse(x, y, 5 - t * 1.2, 4, i % 2 ? TRUNK : shade(TRUNK, 0.8));
        }
        const tx = 48 + Math.sin(1.4) * 14,
          ty = 30;
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI + (k / 6) * Math.PI;
          for (let s = 0; s < 18; s++) {
            const u = s / 18;
            const fx = tx + Math.cos(a) * u * 40,
              fy = ty + Math.sin(a) * u * 22 + u * u * 22;
            img.ellipse(fx, fy, 5 * (1 - u) + 1.5, 2.5 * (1 - u) + 1, k % 2 ? LEAF : LEAF_DK, a);
          }
        }
        img.circle(tx - 3, ty + 4, 3, rgb(120, 72, 24));
        img.circle(tx + 3, ty + 5, 3, rgb(120, 72, 24));
        img.outline(OUTLINE);
        return img;
      });
    case 'sunflower': {
      const f = (frame >> 4) & 1;
      return cached(`sunflower:${f}`, () => {
        const img = canvas(32, 56, 16, 55);
        img.line(16, 55, 16, 18, 2, LEAF_DK);
        img.ellipse(10, 40, 6, 3, LEAF, -0.5);
        img.ellipse(22, 34, 6, 3, LEAF, 0.5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + f * 0.4;
          img.ellipse(16 + Math.cos(a) * 7, 14 + Math.sin(a) * 7, 4, 2.5, rgb(252, 220, 48), a);
        }
        img.circle(16, 14, 5, rgb(140, 72, 24));
        img.circle(15, 13, 2, rgb(200, 120, 48));
        img.outline(OUTLINE);
        return img;
      });
    }
    case 'tulip': {
      const f = (frame >> 5) & 1;
      return cached(`tulip:${f}`, () => {
        const img = canvas(16, 32, 8, 31);
        img.line(8, 31, 8 + f, 12, 1.5, LEAF_DK);
        img.ellipse(5, 24, 3, 1.5, LEAF, -0.6);
        img.ellipse(8 + f, 9, 4, 5, rgb(176, 72, 220));
        img.poly(
          [
            [4 + f, 6],
            [6 + f, 2],
            [8 + f, 6],
            [10 + f, 2],
            [12 + f, 6],
          ],
          rgb(176, 72, 220),
        );
        img.outline(OUTLINE);
        return img;
      });
    }
    case 'totem':
      return cached('totem', () => {
        const img = canvas(32, 96, 16, 95);
        const cols = [rgb(220, 56, 40), rgb(252, 200, 48), rgb(48, 120, 220)];
        for (let i = 0; i < 4; i++) {
          const y = 95 - (i + 1) * 22;
          const c = cols[i % 3]!;
          img.rect(6, y, 20, 22, c);
          img.rect(9, y + 6, 4, 4, rgb(255, 255, 255));
          img.rect(19, y + 6, 4, 4, rgb(255, 255, 255));
          img.rect(10, y + 7, 2, 2, OUTLINE);
          img.rect(20, y + 7, 2, 2, OUTLINE);
          img.rect(11, y + 14, 10, 3, shade(c, 0.5));
        }
        img.poly(
          [
            [0, 10],
            [16, 0],
            [32, 10],
          ],
          rgb(48, 184, 40),
        );
        img.outline(OUTLINE);
        return img;
      });
    case 'rock':
      return cached('rock', () => {
        const img = canvas(40, 28, 20, 27);
        img.ellipse(20, 18, 18, 10, rgb(148, 132, 172));
        img.ellipse(16, 14, 9, 5, rgb(180, 168, 200));
        img.outline(OUTLINE);
        return img;
      });
    default:
      return null;
  }
}

registerObject(
  'decor',
  (x, y, p) => new Decor(x, y, (p.kind as string) ?? 'palm', (p.depth as number) ?? -1, Boolean(p.flip)),
);
