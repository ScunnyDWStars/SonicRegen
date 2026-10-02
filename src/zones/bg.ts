import { PixelImage, type Color } from '../art/pixels';
import type { Renderer } from '../engine/renderer';
import { SCREEN_W } from '../engine/constants';

/** Draw an image repeated horizontally across the screen, scrolled by `scroll` px. */
export function tileH(r: Renderer, img: PixelImage, scroll: number, y: number): void {
  const w = img.w;
  let x = -(((Math.floor(scroll) % w) + w) % w);
  for (; x < SCREEN_W; x += w) r.image(img, x, y);
}

/** Like tileH but each row scrolls by its own factor (water and floor "line scroll"). */
export function lineScroll(
  r: Renderer,
  img: PixelImage,
  camX: number,
  y: number,
  f0: number,
  f1: number,
  extra = 0,
): void {
  const src = r.source(img);
  const w = img.w;
  for (let row = 0; row < img.h; row++) {
    const f = f0 + ((f1 - f0) * row) / Math.max(1, img.h - 1);
    const s = camX * f + extra * (row % 2 ? 1 : -1);
    let x = -(((Math.floor(s) % w) + w) % w);
    for (; x < SCREEN_W; x += w) r.ctx.drawImage(src, 0, row, w, 1, x, Math.round(y + row), w, 1);
  }
}

/** Vertical gradient bands between colours. */
export function gradient(r: Renderer, y0: number, y1: number, cols: Color[]): void {
  const n = cols.length;
  const h = (y1 - y0) / n;
  cols.forEach((c, i) => r.rect(0, Math.floor(y0 + i * h), SCREEN_W, Math.ceil(h) + 1, c));
}

/** Seeded RNG for generating background art. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fill under a 1D height profile (for hills / mountains). */
export function silhouette(
  img: PixelImage,
  heightAt: (x: number) => number,
  color: (x: number, y: number, top: number) => Color,
): void {
  for (let x = 0; x < img.w; x++) {
    const top = Math.round(heightAt(x));
    for (let y = Math.max(0, top); y < img.h; y++) img.set(x, y, color(x, y, top));
  }
}
