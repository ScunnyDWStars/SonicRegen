import { rgb, type Color } from '../art/pixels';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import type { Renderer } from '../engine/renderer';

export const YELLOW = rgb(252, 228, 48);
export const WHITE = rgb(255, 255, 255);
export const DIM = rgb(140, 160, 220);

/** Scrolling diagonal checker background used by the menus. */
export function menuBackground(
  r: Renderer,
  t: number,
  a: Color = rgb(16, 32, 120),
  b: Color = rgb(24, 48, 152),
): void {
  r.clear(a);
  const off = (t / 2) % 32;
  for (let y = -32; y < SCREEN_H + 32; y += 32)
    for (let x = -32; x < SCREEN_W + 32; x += 32)
      if (((x + y) / 32) % 2 === 0) r.rect(x + off, y + off, 32, 32, b);
}

export function panel(r: Renderer, x: number, y: number, w: number, h: number, on: boolean): void {
  r.rect(x, y, w, h, on ? YELLOW : rgb(8, 16, 72));
  r.rect(x + 2, y + 2, w - 4, h - 4, on ? rgb(40, 96, 216) : rgb(24, 48, 136));
}

export function centeredText(r: Renderer, s: string, y: number, on: boolean): void {
  r.text(s, Math.round((SCREEN_W - s.length * 8) / 2), y, on ? WHITE : DIM);
}
