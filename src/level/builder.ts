import { CollisionMap, SOLID_A, SOLID_B, SOLID_BOTH, TOP_ONLY } from './collision';

/**
 * Level geometry is written as code: terrain profiles, shapes and loops are
 * rasterised into a per-pixel map. Bits 0-2 of each pixel are collision (see
 * collision.ts); bits 3-7 hold a material id that the zone's renderer turns into art.
 */

export const MAT_SHIFT = 3;
export const enum Mat {
  None = 0,
  /** Main ground of the zone (grass/checker, metal, jungle soil...). */
  Ground = 1,
  /** Secondary rock / wall material. */
  Rock = 2,
  /** Floating or semi-solid platforms. */
  Platform = 3,
  /** Loops, tubes, ramps: drawn with the zone's "structure" style. */
  Structure = 4,
  /** Breakable or special walls. */
  Special = 5,
  /** Background-only decoration drawn on the level layer, never solid. */
  Decor = 6,
}

export type Layer = 'both' | 'A' | 'B';

export interface ShapeOpts {
  layer?: Layer;
  topOnly?: boolean;
  material?: Mat;
  /** false = decoration only (drawn, never solid). */
  solid?: boolean;
}

/** A terrain control point. `curve` sets how the segment *leading to the next point* is shaped. */
export type TerrainPoint = [x: number, y: number, curve?: 'smooth' | 'linear' | 'step'];

export interface ObjectSpawn {
  type: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
}

export interface PathSwapper {
  x: number;
  y0: number;
  y1: number;
  /** Optional: only swap while grounded. */
  groundedOnly: boolean;
}

export interface LevelData {
  width: number;
  height: number;
  map: CollisionMap;
  spawns: ObjectSpawn[];
  swappers: PathSwapper[];
  start: { x: number; y: number };
  waterY: number;
  /** Optional per-x water level overrides, e.g. rising liquid is driven by objects instead. */
  bottom: number;
  /** Camera floor clamp: the lowest camera Y for a given X (keeps pits looking right). */
  cameraBottom: number;
}

function layerBits(l: Layer | undefined): number {
  return l === 'A' ? SOLID_A : l === 'B' ? SOLID_B : SOLID_BOTH;
}

export class LevelBuilder {
  readonly map: CollisionMap;
  readonly spawns: ObjectSpawn[] = [];
  readonly swappers: PathSwapper[] = [];
  start = { x: 96, y: 0 };
  waterY = Infinity;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.map = new CollisionMap(width, height);
  }

  private value(o: ShapeOpts = {}): number {
    const solid = o.solid !== false;
    let v = ((o.material ?? Mat.Ground) & 31) << MAT_SHIFT;
    if (solid) v |= layerBits(o.layer) | (o.topOnly ? TOP_ONLY : 0);
    return v;
  }

  /** Write a span; later shapes replace earlier ones. */
  private span(x0: number, x1: number, y: number, v: number): void {
    this.map.fillRow(Math.round(x0), Math.round(x1), y, () => v);
  }

  /** Write a span but keep solid bits from both (used to merge loop halves into ground). */
  private spanMerge(x0: number, x1: number, y: number, v: number): void {
    this.map.fillRow(Math.round(x0), Math.round(x1), y, (old) => {
      if (old & SOLID_BOTH && (old & SOLID_BOTH) !== (v & SOLID_BOTH)) {
        // Union of collision paths; keep the stronger (non-top-only) rule.
        const bits = (old | v) & SOLID_BOTH;
        const top = old & TOP_ONLY && v & TOP_ONLY ? TOP_ONLY : 0;
        return bits | top | (v & ~7);
      }
      return v;
    });
  }

  /** Surface Y of a terrain profile at x (no clamping). */
  static profileY(points: readonly TerrainPoint[], x: number): number {
    if (x <= points[0]![0]) return points[0]![1];
    for (let i = 0; i + 1 < points.length; i++) {
      const [x0, y0, curve] = points[i]!;
      const [x1, y1] = points[i + 1]!;
      if (x >= x0 && x <= x1) {
        if (x1 === x0) return y1;
        const t = (x - x0) / (x1 - x0);
        if (curve === 'linear') return y0 + (y1 - y0) * t;
        if (curve === 'step') return t < 1 ? y0 : y1;
        return y0 + (y1 - y0) * (1 - Math.cos(t * Math.PI)) * 0.5;
      }
    }
    return points[points.length - 1]![1];
  }

  /**
   * Solid ground under a surface profile, from the surface down to `depth`
   * (default: the bottom of the level).
   */
  terrain(points: TerrainPoint[], o: ShapeOpts & { depth?: number } = {}): this {
    const v = this.value(o);
    const x0 = Math.floor(points[0]![0]);
    const x1 = Math.ceil(points[points.length - 1]![0]);
    for (let x = x0; x < x1; x++) {
      const top = Math.round(LevelBuilder.profileY(points, x + 0.5));
      const bottom = o.depth !== undefined ? top + o.depth : this.height;
      for (let y = Math.max(0, top); y < Math.min(this.height, bottom); y++) this.map.set(x, y, v);
    }
    return this;
  }

  /** Solid region above a ceiling profile (from the top of the level, or `depth` px thick). */
  ceiling(points: TerrainPoint[], o: ShapeOpts & { depth?: number } = {}): this {
    const v = this.value(o);
    const x0 = Math.floor(points[0]![0]);
    const x1 = Math.ceil(points[points.length - 1]![0]);
    for (let x = x0; x < x1; x++) {
      const bottom = Math.round(LevelBuilder.profileY(points, x + 0.5));
      const top = o.depth !== undefined ? bottom - o.depth : 0;
      for (let y = Math.max(0, top); y < Math.min(this.height, bottom); y++) this.map.set(x, y, v);
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, o: ShapeOpts = {}): this {
    const v = this.value(o);
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) this.span(x, x + w, yy, v);
    return this;
  }

  /** Remove everything inside a rectangle. */
  carveRect(x: number, y: number, w: number, h: number): this {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) this.span(x, x + w, yy, 0);
    return this;
  }

  poly(pts: ReadonlyArray<readonly [number, number]>, o: ShapeOpts = {}): this {
    this.scanPoly(pts, this.value(o));
    return this;
  }

  carvePoly(pts: ReadonlyArray<readonly [number, number]>): this {
    this.scanPoly(pts, 0);
    return this;
  }

  private scanPoly(pts: ReadonlyArray<readonly [number, number]>, v: number): void {
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
      for (let k = 0; k + 1 < xs.length; k += 2) this.span(xs[k]!, xs[k + 1]!, y, v);
    }
  }

  circle(cx: number, cy: number, r: number, o: ShapeOpts = {}): this {
    const v = this.value(o);
    this.annulus(cx, cy, 0, r, v, () => true);
    return this;
  }

  carveCircle(cx: number, cy: number, r: number): this {
    this.annulus(cx, cy, 0, r, 0, () => true);
    return this;
  }

  /** Fill pixels whose centre lies between radii rIn and rOut and passes `keep`. */
  private annulus(
    cx: number,
    cy: number,
    rIn: number,
    rOut: number,
    v: number,
    keep: (dx: number, dy: number) => boolean,
    merge = false,
  ): void {
    for (let y = Math.floor(cy - rOut); y <= Math.ceil(cy + rOut); y++) {
      for (let x = Math.floor(cx - rOut); x <= Math.ceil(cx + rOut); x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < rIn * rIn || d2 > rOut * rOut || !keep(dx, dy)) continue;
        if (merge) this.spanMerge(x, x + 1, y, v);
        else this.map.set(x, y, v);
      }
    }
  }

  /**
   * A vertical loop standing on flat ground at `floorY`. The inner running
   * surface has radius `r`. The right half is solid on path A and the left half
   * on path B, with path swappers placed at the top and on both sides.
   * Make sure the ground under the loop is flat for at least r px either side.
   */
  loop(cx: number, floorY: number, r: number, o: ShapeOpts & { thickness?: number } = {}): this {
    const t = o.thickness ?? 24;
    const cy = floorY - r;
    const mat = o.material ?? Mat.Structure;
    const vA = this.value({ ...o, material: mat, layer: 'A' });
    const vB = this.value({ ...o, material: mat, layer: 'B' });
    this.annulus(cx, cy, r, r + t, vA, (dx) => dx >= 0, true);
    this.annulus(cx, cy, r, r + t, vB, (dx) => dx < 0, true);
    // Swappers: crossing right selects A, crossing left selects B.
    this.swappers.push({ x: cx, y0: cy - r - t - 16, y1: cy - r * 0.3, groundedOnly: false });
    this.swappers.push({ x: cx - r - t - 12, y0: cy - r * 0.5, y1: floorY + 4, groundedOnly: false });
    this.swappers.push({ x: cx + r + t + 12, y0: cy - r * 0.5, y1: floorY + 4, groundedOnly: false });
    this.place('loopDecor', cx, cy, { r, t });
    return this;
  }

  /**
   * Quarter pipe: a concave curve rising from floor level at `x` to vertical,
   * facing left (dir = 1, wall on the right) or right (dir = -1).
   */
  quarterPipe(x: number, floorY: number, r: number, dir: 1 | -1, o: ShapeOpts = {}): this {
    const v = this.value({ material: Mat.Ground, ...o });
    // Circle centre sits above the floor at the start of the curve.
    const cx = x,
      cy = floorY - r;
    for (let px = 0; px < r; px++) {
      const lx = px + 0.5;
      const surf = cy + Math.sqrt(Math.max(0, r * r - lx * lx));
      const xx = dir === 1 ? x + px : x - px - 1;
      for (let y = Math.round(surf); y < this.height; y++) this.map.set(xx, y, v);
    }
    void cx;
    return this;
  }

  place(type: string, x: number, y: number, props: Record<string, unknown> = {}): this {
    this.spawns.push({ type, x, y, props });
    return this;
  }

  /** A line of `n` rings starting at (x, y), spaced by (dx, dy). */
  rings(x: number, y: number, n: number, dx = 24, dy = 0): this {
    for (let i = 0; i < n; i++) this.place('ring', x + i * dx, y + i * dy);
    return this;
  }

  /** Rings in an arc (jump arcs, loops). */
  ringArc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): this {
    for (let i = 0; i < n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
      this.place('ring', cx + Math.cos(a) * r, cy - Math.sin(a) * r);
    }
    return this;
  }

  /** First solid floor pixel at or below y (path A) — handy for placing objects. */
  groundY(x: number, fromY = 0): number {
    for (let y = Math.max(0, Math.floor(fromY)); y < this.height; y++) {
      if (this.map.get(Math.floor(x), y) & SOLID_A) return y;
    }
    return this.height;
  }

  build(extra: Partial<Pick<LevelData, 'bottom' | 'cameraBottom'>> = {}): LevelData {
    this.map.compact();
    return {
      width: this.width,
      height: this.height,
      map: this.map,
      spawns: this.spawns,
      swappers: this.swappers,
      start: this.start,
      waterY: this.waterY,
      bottom: extra.bottom ?? this.height,
      cameraBottom: extra.cameraBottom ?? this.height,
    };
  }
}
