import { colorToCss, rgb, type Color, type PixelImage } from '../art/pixels';
import { glyph, GLYPH_W } from '../ui/font';
import { SCREEN_H, SCREEN_W } from './constants';

type Canvasish = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvasish {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

interface CacheEntry {
  canvas: Canvasish;
  version: number;
}

const WHITE = rgb(255, 255, 255);
const SHADOW = rgb(0, 0, 0);

export interface DrawOpts {
  flipX?: boolean;
  flipY?: boolean;
  alpha?: number;
}

/**
 * Draws into the 320x224 back buffer. All coordinates are screen pixels; callers
 * subtract the camera position themselves.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly cache = new WeakMap<PixelImage, CacheEntry>();

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas not supported');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  /** Converts (and caches) a PixelImage to something drawImage accepts. */
  source(img: PixelImage): Canvasish {
    let e = this.cache.get(img);
    if (!e || e.version !== img.version) {
      const canvas = e?.canvas ?? makeCanvas(img.w, img.h);
      const c2 = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      const id = new ImageData(img.w, img.h);
      new Uint32Array(id.data.buffer).set(img.data);
      c2.putImageData(id, 0, 0);
      e = { canvas, version: img.version };
      this.cache.set(img, e);
    }
    return e.canvas;
  }

  clear(c: Color): void {
    this.ctx.fillStyle = colorToCss(c);
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    this.ctx.fillStyle = colorToCss(c);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Draws `img` so its hot-spot (ox, oy) lands on screen point (x, y). */
  image(img: PixelImage, x: number, y: number, o: DrawOpts = {}): void {
    const src = this.source(img);
    const ctx = this.ctx;
    const fx = !!o.flipX,
      fy = !!o.flipY;
    const dx = Math.round(x) - (fx ? img.w - img.ox : img.ox);
    const dy = Math.round(y) - (fy ? img.h - img.oy : img.oy);
    if (dx > SCREEN_W || dy > SCREEN_H || dx + img.w < 0 || dy + img.h < 0) return;
    const prevAlpha = ctx.globalAlpha;
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (fx || fy) {
      ctx.save();
      ctx.translate(dx + (fx ? img.w : 0), dy + (fy ? img.h : 0));
      ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(src, dx, dy);
    }
    ctx.globalAlpha = prevAlpha;
  }

  text(s: string, x: number, y: number, ink: Color = WHITE, edge: Color = SHADOW): void {
    let cx = Math.round(x);
    for (const ch of s) {
      if (ch !== ' ') {
        const g = glyph(ch, ink, edge);
        if (g) this.ctx.drawImage(this.source(g), cx, Math.round(y));
      }
      cx += GLYPH_W;
    }
  }

  /** Text drawn at an integer scale (title cards, big numbers). */
  textScaled(s: string, x: number, y: number, scale: number, ink: Color = WHITE, edge: Color = SHADOW): void {
    let cx = Math.round(x);
    for (const ch of s) {
      if (ch !== ' ') {
        const g = glyph(ch, ink, edge);
        if (g) this.ctx.drawImage(this.source(g), cx, Math.round(y), g.w * scale, g.h * scale);
      }
      cx += GLYPH_W * scale;
    }
  }

  textCentered(s: string, y: number, ink?: Color, edge?: Color): void {
    this.text(s, Math.round((SCREEN_W - s.length * GLYPH_W) / 2), y, ink, edge);
  }

  /** Outline rectangle (debug). */
  box(x: number, y: number, w: number, h: number, c: Color): void {
    this.ctx.strokeStyle = colorToCss(c);
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    const ctx = this.ctx;
    ctx.strokeStyle = colorToCss(c);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5);
    ctx.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.stroke();
  }

  /** Fades the whole frame toward black (t = 0..1). */
  fade(t: number, c: Color = SHADOW): void {
    if (t <= 0) return;
    this.ctx.globalAlpha = Math.min(1, t);
    this.rect(0, 0, SCREEN_W, SCREEN_H, c);
    this.ctx.globalAlpha = 1;
  }
}
