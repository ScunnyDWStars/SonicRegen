import type { Color } from '../art/pixels';
import type { Renderer } from '../engine/renderer';

/** Everything that gives a zone its look and sound. */
export interface ZoneTheme {
  id: string;
  /** Title-card name, e.g. "PALM COAST". */
  name: string;
  /**
   * Colour for a level pixel of material `mat` at world (x, y). `up`/`down` count
   * solid-material pixels above/below before reaching air (capped at 31), so
   * surfaces can get grass, trim and shading. `solid` holds the collision bits.
   */
  paint(mat: number, x: number, y: number, up: number, down: number, solid: number): Color;
  drawBackground(r: Renderer, camX: number, camY: number, frame: number): void;
  /** Colour tint for water and its surface line. */
  water?: { tint: Color; surface: Color; alpha: number };
  music: string;
  /** Badnik/object art flavour, for objects that differ per zone. */
  flavor: 'palm' | 'refinery' | 'jungle' | 'test';
}

/** Cheap deterministic hash for procedural texture detail. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
