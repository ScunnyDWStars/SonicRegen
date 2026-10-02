import { PixelImage, rgb } from '../art/pixels';
import type { Renderer } from '../engine/renderer';

/** Short-lived visual effects (dust, splashes, explosions, score pop-ups). */
interface Fx {
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  data: number;
}

const cache = new Map<string, PixelImage>();
function sprite(key: string, make: () => PixelImage): PixelImage {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

function centred(w: number, h: number): PixelImage {
  const img = new PixelImage(w, h);
  img.ox = w >> 1;
  img.oy = h >> 1;
  return img;
}

const OUTLINE = rgb(16, 16, 40);

export function explosionFrame(i: number): PixelImage {
  return sprite(`boom${i}`, () => {
    const img = centred(40, 40);
    const r = 5 + i * 3.2;
    const cols = [
      rgb(255, 255, 255),
      rgb(255, 240, 96),
      rgb(255, 160, 32),
      rgb(224, 64, 16),
      rgb(120, 40, 24),
    ];
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + i;
      img.circle(20 + Math.cos(a) * r * 0.5, 20 + Math.sin(a) * r * 0.5, r * 0.55, cols[Math.min(4, i)]!);
    }
    img.circle(20, 20, r * 0.45, cols[Math.min(4, Math.max(0, i - 1))]!);
    if (i < 2) img.circle(20, 20, r * 0.3, cols[0]!);
    img.outline(OUTLINE);
    return img;
  });
}

function dustFrame(i: number): PixelImage {
  return sprite(`dust${i}`, () => {
    const img = centred(16, 16);
    const r = 2 + i;
    img.circle(8, 8, r, rgb(232, 232, 240));
    img.circle(7, 7, r * 0.6, rgb(255, 255, 255));
    return img;
  });
}

function sparkleFrame(i: number): PixelImage {
  return sprite(`spark${i}`, () => {
    const img = centred(16, 16);
    const s = [6, 4, 7, 3][i & 3]!;
    const c = i < 2 ? rgb(255, 255, 255) : rgb(255, 240, 128);
    img.line(8 - s, 8, 8 + s, 8, 1, c);
    img.line(8, 8 - s, 8, 8 + s, 1, c);
    img.line(8 - s / 2, 8 - s / 2, 8 + s / 2, 8 + s / 2, 1, c);
    img.line(8 + s / 2, 8 - s / 2, 8 - s / 2, 8 + s / 2, 1, c);
    return img;
  });
}

function splashFrame(i: number): PixelImage {
  return sprite(`splash${i}`, () => {
    const img = new PixelImage(32, 32);
    img.ox = 16;
    img.oy = 31;
    const h = [10, 18, 22, 16, 8][i]!;
    for (let k = -3; k <= 3; k++) {
      const x = 16 + k * 3.5;
      const hh = h * (1 - Math.abs(k) / 4.5);
      img.line(x, 31, x + k * 0.8, 31 - hh, 2, rgb(208, 232, 255));
      img.circle(x + k, 31 - hh - 1, 1.6, rgb(255, 255, 255));
    }
    return img;
  });
}

export function bubbleImg(r: number): PixelImage {
  return sprite(`bubble${r}`, () => {
    const img = centred(r * 2 + 4, r * 2 + 4);
    const c = r + 2;
    img.circle(c, c, r, rgb(160, 208, 255));
    img.circle(c, c, Math.max(0, r - 1), 0);
    img.set(c - Math.floor(r / 2), c - Math.floor(r / 2), rgb(255, 255, 255));
    return img;
  });
}

function ringBurst(r: number, col: number): PixelImage {
  return sprite(`burst${r}:${col}`, () => {
    const img = centred(r * 2 + 4, r * 2 + 4);
    const c = r + 2;
    img.circle(c, c, r, col);
    img.circle(c, c, Math.max(0, r - 2), 0);
    return img;
  });
}

export class Effects {
  private readonly list: Fx[] = [];

  add(kind: string, x: number, y: number, data = 0, vx = 0, vy = 0): void {
    const life =
      {
        explosion: 20,
        dust: 16,
        sparkle: 16,
        splash: 20,
        score: 48,
        bubble: 180,
        instaShield: 14,
        bubbleBounce: 12,
        fireDash: 18,
        sparks: 16,
        superFlash: 30,
        debris: 60,
        wallBreak: 1,
        smoke: 30,
      }[kind] ?? 20;
    if (kind === 'wallBreak') {
      for (let i = 0; i < 8; i++)
        this.list.push({
          kind: 'debris',
          x: x + (i % 2) * 16 - 8,
          y: y + Math.floor(i / 2) * 12 - 18,
          vx: (i % 2 ? 1 : -1) * (1 + Math.random() * 2),
          vy: -2 - Math.random() * 3,
          t: 0,
          life: 60,
          data,
        });
      return;
    }
    if (kind === 'sparks') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        this.list.push({
          kind: 'sparkle',
          x,
          y,
          vx: Math.cos(a) * 2,
          vy: Math.sin(a) * 2,
          t: 0,
          life: 16,
          data,
        });
      }
      return;
    }
    this.list.push({ kind, x, y, vx, vy, t: 0, life, data });
  }

  update(waterY: number): void {
    for (const f of this.list) {
      f.t++;
      f.x += f.vx;
      f.y += f.vy;
      if (f.kind === 'debris') f.vy += 0.2;
      if (f.kind === 'score') f.y -= f.t < 24 ? 1 : 0;
      if (f.kind === 'bubble') {
        f.y -= 0.6;
        f.x += Math.sin(f.t / 8) * 0.3;
        if (f.y < waterY) f.t = f.life;
      }
      if (f.kind === 'smoke') f.y -= 0.5;
    }
    for (let i = this.list.length - 1; i >= 0; i--)
      if (this.list[i]!.t >= this.list[i]!.life) this.list.splice(i, 1);
  }

  draw(r: Renderer, cx: number, cy: number, frame: number): void {
    for (const f of this.list) {
      const x = f.x - cx,
        y = f.y - cy;
      switch (f.kind) {
        case 'explosion':
          r.image(explosionFrame(Math.min(4, Math.floor(f.t / 4))), x, y);
          break;
        case 'smoke':
          r.image(dustFrame(Math.min(3, Math.floor(f.t / 8))), x, y, { alpha: 0.7 });
          break;
        case 'dust':
          r.image(dustFrame(Math.min(3, Math.floor(f.t / 4))), x, y);
          break;
        case 'sparkle':
          r.image(sparkleFrame(Math.floor(f.t / 4)), x, y);
          break;
        case 'splash':
          r.image(splashFrame(Math.min(4, Math.floor(f.t / 4))), x, y);
          break;
        case 'score':
          r.text(String(f.data), x - String(f.data).length * 4, y - 4);
          break;
        case 'bubble':
          r.image(bubbleImg(f.data || 2), x, y);
          break;
        case 'instaShield':
          r.image(ringBurst(8 + f.t * 1.5, rgb(255, 255, 255)), x, y, { alpha: 1 - f.t / f.life });
          break;
        case 'bubbleBounce':
          r.image(ringBurst(6 + f.t, rgb(160, 216, 255)), x, y, { alpha: 1 - f.t / f.life });
          break;
        case 'superFlash':
          r.image(ringBurst(4 + f.t * 3, rgb(255, 255, 160)), x, y, { alpha: 1 - f.t / f.life });
          break;
        case 'fireDash':
          r.image(explosionFrame(Math.min(4, 1 + Math.floor(f.t / 5))), x - f.data * f.t * 2, y, {
            alpha: 0.7,
          });
          break;
        case 'debris':
          r.rect(x - 3, y - 3, 6, 6, (frame + f.data) & 4 ? rgb(108, 92, 140) : rgb(148, 132, 172));
          break;
      }
    }
  }

  clear(): void {
    this.list.length = 0;
  }
}
