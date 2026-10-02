/**
 * Tiny software rasteriser for pixel art. Everything here is pure so sprites can be
 * generated (and tested) without a browser. Colours are packed 0xAABBGGRR so a
 * PixelImage's buffer can be copied straight into an ImageData.
 */

/** Mega Drive DAC output levels for its 3-bit colour channels. */
const MD_LEVELS = [0, 52, 87, 116, 144, 172, 206, 255];

export type Color = number;
export const CLEAR: Color = 0;

/** Pack an 8-bit RGB colour. */
export function rgb(r: number, g: number, b: number, a = 255): Color {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** A colour on the Mega Drive's 9-bit palette: each channel 0-7. */
export function md(r: number, g: number, b: number): Color {
  return rgb(MD_LEVELS[r & 7]!, MD_LEVELS[g & 7]!, MD_LEVELS[b & 7]!);
}

/** Parse '#rrggbb'. */
export function hex(s: string): Color {
  const n = parseInt(s.replace('#', ''), 16);
  return rgb((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function colorToCss(c: Color): string {
  const r = c & 255,
    g = (c >>> 8) & 255,
    b = (c >>> 16) & 255,
    a = (c >>> 24) & 255;
  return a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

export function shade(c: Color, f: number): Color {
  const r = Math.min(255, Math.round((c & 255) * f));
  const g = Math.min(255, Math.round(((c >>> 8) & 255) * f));
  const b = Math.min(255, Math.round(((c >>> 16) & 255) * f));
  return rgb(r, g, b, (c >>> 24) & 255);
}

export function mix(a: Color, b: Color, t: number): Color {
  const ch = (s: number) => Math.round(((a >>> s) & 255) * (1 - t) + ((b >>> s) & 255) * t);
  return rgb(ch(0), ch(8), ch(16), ch(24));
}

export class PixelImage {
  readonly data: Uint32Array;
  /** Hot-spot: the point that is drawn at the sprite's world position. */
  ox = 0;
  oy = 0;
  /** Bumped whenever pixels change so render caches can refresh. */
  version = 0;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(w * h);
  }

  get(x: number, y: number): Color {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLEAR;
    return this.data[y * this.w + x]!;
  }

  set(x: number, y: number, c: Color): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  fill(c: Color): this {
    this.data.fill(c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    const x0 = Math.max(0, Math.round(x)),
      y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w)),
      y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) this.data.fill(c, yy * this.w + x0, yy * this.w + x1);
    return this;
  }

  /** Filled ellipse centred on (cx, cy), optionally rotated by `rot` radians. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color, rot = 0): this {
    const ext = Math.max(rx, ry) + 1;
    const cs = Math.cos(rot),
      sn = Math.sin(rot);
    for (let y = Math.floor(cy - ext); y <= Math.ceil(cy + ext); y++) {
      for (let x = Math.floor(cx - ext); x <= Math.ceil(cx + ext); x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        const u = dx * cs + dy * sn,
          v = -dx * sn + dy * cs;
        if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, c: Color): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  /** Filled polygon using even-odd scanline fill with pixel-centre sampling. */
  poly(pts: ReadonlyArray<readonly [number, number]>, c: Color): this {
    if (pts.length < 3) return this;
    let minY = Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    const xs: number[] = [];
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!,
          b = pts[(i + 1) % pts.length]!;
        if (a[1] <= sy !== b[1] <= sy) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Thick line made of round stamps. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, c: Color): this {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t,
        y = y0 + (y1 - y0) * t;
      if (width <= 1) this.set(Math.floor(x), Math.floor(y), c);
      else this.circle(x, y, width / 2, c);
    }
    return this;
  }

  /** Draws `src` onto this image (opaque pixels only). */
  blit(src: PixelImage, dx: number, dy: number, flipX = false): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + (flipX ? src.w - 1 - x : x)]!;
        if (c >>> 24) this.set(dx + x, dy + y, c);
      }
    }
    return this;
  }

  /** Adds a 1px outline of colour `c` around all opaque pixels. */
  outline(c: Color): this {
    const src = this.data.slice();
    const w = this.w,
      h = this.h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x]! >>> 24) continue;
        const n =
          (x > 0 && src[y * w + x - 1]! >>> 24) ||
          (x < w - 1 && src[y * w + x + 1]! >>> 24) ||
          (y > 0 && src[(y - 1) * w + x]! >>> 24) ||
          (y < h - 1 && src[(y + 1) * w + x]! >>> 24);
        if (n) this.data[y * w + x] = c;
      }
    }
    return this;
  }

  /** Replaces every pixel of colour `from` with `to`. */
  recolor(map: ReadonlyMap<Color, Color>): PixelImage {
    const out = new PixelImage(this.w, this.h);
    out.ox = this.ox;
    out.oy = this.oy;
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i]!;
      out.data[i] = map.get(c) ?? c;
    }
    return out;
  }

  clone(): PixelImage {
    const out = new PixelImage(this.w, this.h);
    out.data.set(this.data);
    out.ox = this.ox;
    out.oy = this.oy;
    return out;
  }

  /**
   * Nearest-neighbour rotation about the hot-spot, sampled at 2x first to keep
   * lines clean (a light version of the "RotSprite" idea).
   */
  rotated(rad: number): PixelImage {
    if (Math.abs(rad) < 1e-3) return this;
    const cs = Math.cos(rad),
      sn = Math.sin(rad);
    const r = Math.ceil(Math.hypot(Math.max(this.ox, this.w - this.ox), Math.max(this.oy, this.h - this.oy)));
    const out = new PixelImage(r * 2 + 1, r * 2 + 1);
    out.ox = r;
    out.oy = r;
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        let best = 0;
        // 2x2 supersample; take the first opaque sample (keeps outlines solid).
        for (let s = 0; s < 4 && !best; s++) {
          const fx = x - r + 0.25 + (s & 1) * 0.5,
            fy = y - r + 0.25 + (s >> 1) * 0.5;
          const sx = Math.floor(fx * cs + fy * sn + this.ox);
          const sy = Math.floor(-fx * sn + fy * cs + this.oy);
          const c = this.get(sx, sy);
          if (c >>> 24) best = c;
        }
        out.data[y * out.w + x] = best;
      }
    }
    return out;
  }

  /** Build from rows of characters, each mapped through `pal`. Spaces and '.' are clear. */
  static fromStrings(rows: readonly string[], pal: Record<string, Color>): PixelImage {
    const w = Math.max(...rows.map((r) => r.length));
    const img = new PixelImage(w, rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]!;
        if (ch === ' ' || ch === '.') continue;
        const c = pal[ch];
        if (c !== undefined) img.data[y * w + x] = c;
      }
    });
    return img;
  }
}
