import { describe, expect, it } from 'vitest';
import { GLYPHS, GLYPH_COLS, GLYPH_ROWS } from '../src/ui/font';

describe('bitmap font', () => {
  it('has well-formed glyphs', () => {
    expect(GLYPHS.size).toBeGreaterThan(50);
    for (const [k, rows] of GLYPHS) {
      expect(rows, `glyph ${k}`).toHaveLength(GLYPH_ROWS);
      for (const r of rows) expect(r, `glyph ${k} row "${r}"`).toMatch(new RegExp(`^[X.]{${GLYPH_COLS}}$`));
    }
  });
  it('covers letters and digits', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:') expect(GLYPHS.has(ch)).toBe(true);
  });
});
