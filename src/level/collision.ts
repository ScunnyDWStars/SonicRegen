/**
 * Per-pixel collision for a level, stored in sparse 64x64 chunks.
 *
 * Each pixel is a bit field:
 *  - SOLID_A / SOLID_B: solid on collision path A and/or B. Loops swap paths, as on
 *    the Mega Drive, so the player can pass behind half of a loop.
 *  - TOP_ONLY: the pixel only blocks floor sensors (semi-solid platforms).
 */
export const SOLID_A = 1;
export const SOLID_B = 2;
export const SOLID_BOTH = SOLID_A | SOLID_B;
export const TOP_ONLY = 4;

const CS = 64; // chunk size
const CSHIFT = 6;
const CMASK = CS - 1;

/** A chunk is either a shared constant fill value or its own byte array. */
type Chunk = Uint8Array | number;

export class CollisionMap {
  readonly cw: number;
  readonly ch: number;
  private readonly chunks: Chunk[];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cw = Math.ceil(width / CS);
    this.ch = Math.ceil(height / CS);
    this.chunks = new Array<Chunk>(this.cw * this.ch).fill(0);
  }

  get(x: number, y: number): number {
    if (x < 0 || x >= this.width) return 0;
    if (y < 0) return 0;
    if (y >= this.height) return 0;
    const c = this.chunks[(y >> CSHIFT) * this.cw + (x >> CSHIFT)]!;
    if (typeof c === 'number') return c;
    return c[((y & CMASK) << CSHIFT) | (x & CMASK)]!;
  }

  set(x: number, y: number, v: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const ci = (y >> CSHIFT) * this.cw + (x >> CSHIFT);
    let c = this.chunks[ci]!;
    if (typeof c === 'number') {
      if (c === v) return;
      c = new Uint8Array(CS * CS).fill(c);
      this.chunks[ci] = c;
    }
    c[((y & CMASK) << CSHIFT) | (x & CMASK)] = v;
  }

  /** Fast path used by the level builder: fill a horizontal run. */
  fillRow(x0: number, x1: number, y: number, fn: (old: number) => number): void {
    if (y < 0 || y >= this.height) return;
    x0 = Math.max(0, x0);
    x1 = Math.min(this.width, x1);
    for (let x = x0; x < x1; x++) {
      const old = this.get(x, y);
      const v = fn(old);
      if (v !== old) this.set(x, y, v);
    }
  }

  /** Collapse chunks that ended up uniform back to constants to save memory. */
  compact(): void {
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i]!;
      if (typeof c === 'number') continue;
      const v = c[0]!;
      if (c.every((p) => p === v)) this.chunks[i] = v;
    }
  }

  /** Number of chunks that own a byte array (for tests and stats). */
  get detailedChunks(): number {
    return this.chunks.filter((c) => typeof c !== 'number').length;
  }
}

/** Sensor directions. Tangent is the direction a positive ground speed moves along a surface hit this way. */
export interface Dir {
  readonly dx: number;
  readonly dy: number;
}
export const DOWN: Dir = { dx: 0, dy: 1 };
export const UP: Dir = { dx: 0, dy: -1 };
export const LEFT: Dir = { dx: -1, dy: 0 };
export const RIGHT: Dir = { dx: 1, dy: 0 };

/** Maximum distance a sensor looks, in pixels (two 16x16 tiles, as on the Mega Drive). */
export const SENSOR_RANGE = 32;

export interface SensorHit {
  /**
   * Signed distance along the sensor direction from the sensor pixel to the last
   * empty pixel before the surface. 0 = touching, negative = embedded,
   * SENSOR_RANGE = nothing found.
   */
  dist: number;
  /** Surface angle in degrees, counter-clockwise, 0 = flat floor (Sonic Physics Guide convention). */
  angle: number;
  found: boolean;
}

/**
 * Queries collision for one path. `floorSensor` sensors see TOP_ONLY pixels, other
 * sensors ignore them.
 */
export class CollisionView {
  constructor(public map: CollisionMap) {}

  solid(x: number, y: number, layer: number, floorSensor: boolean): boolean {
    const v = this.map.get(x, y);
    if (!(v & (layer === 0 ? SOLID_A : SOLID_B))) return false;
    if (v & TOP_ONLY && !floorSensor) return false;
    return true;
  }

  /** Raw distance cast; see {@link SensorHit.dist}. */
  dist(px: number, py: number, d: Dir, layer: number, floorSensor: boolean): number {
    let x = Math.floor(px),
      y = Math.floor(py);
    if (this.solid(x, y, layer, floorSensor)) {
      for (let k = 1; k <= SENSOR_RANGE; k++) {
        x -= d.dx;
        y -= d.dy;
        if (!this.solid(x, y, layer, floorSensor)) return -k;
      }
      return -SENSOR_RANGE;
    }
    for (let k = 1; k <= SENSOR_RANGE; k++) {
      x += d.dx;
      y += d.dy;
      if (this.solid(x, y, layer, floorSensor)) return k - 1;
    }
    return SENSOR_RANGE;
  }

  /**
   * Casts a sensor and measures the surface angle by probing either side of the hit
   * and fitting a line, which gives smooth angles on any curve.
   */
  sensor(px: number, py: number, d: Dir, layer: number, floorSensor: boolean): SensorHit {
    const dist = this.dist(px, py, d, layer, floorSensor);
    const found = dist < SENSOR_RANGE && dist > -SENSOR_RANGE;
    if (!found) return { dist, angle: cardinal(d), found: false };
    // Tangent: the direction positive ground speed moves for a surface met in direction d.
    const tx = d.dy,
      ty = -d.dx;
    // Surface point of the main hit, measured along d from the sensor.
    let sumT = 0,
      sumS = 0,
      sumTT = 0,
      sumTS = 0,
      n = 0;
    const add = (t: number, s: number) => {
      sumT += t;
      sumS += s;
      sumTT += t * t;
      sumTS += t * s;
      n++;
    };
    add(0, dist);
    for (const off of PROBES) {
      const s = this.dist(px + tx * off, py + ty * off, d, layer, floorSensor);
      if (s >= SENSOR_RANGE || s <= -SENSOR_RANGE) continue;
      if (Math.abs(s - dist) > Math.abs(off) * 1.6 + 1) continue; // a ledge or a different surface
      add(off, s);
    }
    let slope = 0; // change in distance (along d) per pixel along the tangent
    if (n >= 2) {
      const den = n * sumTT - sumT * sumT;
      if (den !== 0) slope = (n * sumTS - sumT * sumS) / den;
    }
    // Surface direction vector in screen space: tangent + d * slope.
    const vx = tx + d.dx * slope,
      vy = ty + d.dy * slope;
    return { dist, angle: normAngle((Math.atan2(-vy, vx) * 180) / Math.PI), found: true };
  }
}

const PROBES = [-8, -4, 4, 8];

export function cardinal(d: Dir): number {
  if (d.dy > 0) return 0;
  if (d.dx > 0) return 90;
  if (d.dy < 0) return 180;
  return 270;
}

export function normAngle(a: number): number {
  a %= 360;
  if (a < 0) a += 360;
  return a + 0; // normalise -0
}

/** Smallest absolute difference between two angles in degrees. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normAngle(a) - normAngle(b));
  return d > 180 ? 360 - d : d;
}
