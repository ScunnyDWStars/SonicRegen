import { PixelImage } from '../art/pixels';
import type { Renderer } from '../engine/renderer';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import type { ZoneTheme } from '../zones/theme';
import { MAT_SHIFT } from './builder';
import type { CollisionMap } from './collision';

const T = 256; // render tile size
const MAX_TILES = 72;
const CAP = 31;

/** Paints level pixels with the zone theme into cached 256x256 tiles. */
export class TerrainRenderer {
  private readonly tiles = new Map<number, PixelImage>();

  constructor(
    private readonly map: CollisionMap,
    private readonly theme: ZoneTheme,
  ) {}

  private key(tx: number, ty: number): number {
    return ty * 4096 + tx;
  }

  draw(r: Renderer, camX: number, camY: number): void {
    const tx0 = Math.floor(camX / T),
      tx1 = Math.floor((camX + SCREEN_W - 1) / T);
    const ty0 = Math.floor(camY / T),
      ty1 = Math.floor((camY + SCREEN_H - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx * T >= this.map.width || ty * T >= this.map.height) continue;
        const img = this.tile(tx, ty);
        if (img) r.image(img, tx * T - camX, ty * T - camY);
      }
    }
  }

  /** Pre-build the tiles around a point (avoids hitches on the first frames). */
  warm(x: number, y: number): void {
    const tx = Math.floor(x / T),
      ty = Math.floor(y / T);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 2; dx++) this.tile(tx + dx, ty + dy);
  }

  /** Forget cached art in a rectangle (after level pixels change). */
  invalidate(x: number, y: number, w: number, h: number): void {
    for (let ty = Math.floor(y / T); ty <= Math.floor((y + h) / T); ty++)
      for (let tx = Math.floor(x / T); tx <= Math.floor((x + w) / T); tx++)
        this.tiles.delete(this.key(tx, ty));
  }

  private tile(tx: number, ty: number): PixelImage | null {
    if (tx < 0 || ty < 0) return null;
    const k = this.key(tx, ty);
    let img = this.tiles.get(k);
    if (img) {
      // refresh LRU order
      this.tiles.delete(k);
      this.tiles.set(k, img);
      return img;
    }
    img = this.build(tx, ty);
    this.tiles.set(k, img);
    if (this.tiles.size > MAX_TILES) this.tiles.delete(this.tiles.keys().next().value!);
    return img;
  }

  private build(tx: number, ty: number): PixelImage {
    const img = new PixelImage(T, T);
    const map = this.map,
      theme = this.theme;
    const x0 = tx * T,
      y0 = ty * T;
    const colH = T + CAP * 2;
    const mats = new Uint8Array(colH);
    const ups = new Uint8Array(colH);
    const downs = new Uint8Array(colH);
    for (let lx = 0; lx < T; lx++) {
      const x = x0 + lx;
      for (let i = 0; i < colH; i++) mats[i] = map.get(x, y0 - CAP + i) >> MAT_SHIFT;
      // Distance (in material pixels) to the nearest air above and below.
      let run = -1;
      for (let i = 0; i < colH; i++) {
        if (!mats[i]) run = -1;
        else run = run < 0 ? (i === 0 ? CAP : 0) : Math.min(CAP, run + 1);
        ups[i] = Math.max(0, run);
      }
      run = -1;
      for (let i = colH - 1; i >= 0; i--) {
        if (!mats[i]) run = -1;
        else run = run < 0 ? (i === colH - 1 ? CAP : 0) : Math.min(CAP, run + 1);
        downs[i] = Math.max(0, run);
      }
      for (let ly = 0; ly < T; ly++) {
        const i = ly + CAP;
        const m = mats[i]!;
        if (!m) continue;
        const y = y0 + ly;
        img.data[ly * T + lx] = theme.paint(m, x, y, ups[i]!, downs[i]!, map.get(x, y) & 7);
      }
    }
    return img;
  }
}
