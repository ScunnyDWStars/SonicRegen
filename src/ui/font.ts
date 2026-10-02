import { PixelImage, type Color } from '../art/pixels';
import { FONT_SRC } from './font-data';

export const GLYPH_ROWS = 7;
export const GLYPH_COLS = 7;
/** Horizontal advance per character, in pixels. */
export const GLYPH_W = 8;
export const GLYPH_H = 8;

/** Parsed glyph bitmaps, keyed by character. Exported for tests. */
export const GLYPHS: ReadonlyMap<string, readonly string[]> = parseFont(FONT_SRC);

function parseFont(src: string): Map<string, string[]> {
  const lines = src.split('\n').filter((l) => l.length > 0);
  const out = new Map<string, string[]>();
  for (let i = 0; i < lines.length; i += GLYPH_ROWS + 1) {
    const key = lines[i]!;
    // 'x' in the source is the multiplication sign; a real 'X' is a letter.
    out.set(key === 'x' ? '×' : key, lines.slice(i + 1, i + 1 + GLYPH_ROWS));
  }
  return out;
}

const cache = new Map<string, PixelImage>();

/** Glyph image for `ch`, in colour `ink` with a 1px drop shadow in `edge`. */
export function glyph(ch: string, ink: Color, edge: Color): PixelImage | null {
  const up = ch.toUpperCase();
  const rows = GLYPHS.get(up);
  if (!rows) return null;
  const key = `${up}|${ink}|${edge}`;
  let img = cache.get(key);
  if (!img) {
    const g = new PixelImage(GLYPH_COLS + 1, GLYPH_ROWS + 1);
    for (const [dx, col] of [
      [1, edge],
      [0, ink],
    ] as const) {
      rows.forEach((row, y) => {
        for (let x = 0; x < GLYPH_COLS; x++) if (row[x] === 'X') g.set(x + dx, y + dx, col);
      });
    }
    cache.set(key, g);
    img = g;
  }
  return img;
}

export function textWidth(s: string): number {
  return s.length * GLYPH_W;
}
