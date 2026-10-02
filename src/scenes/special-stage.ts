import { drawBackView, PALETTES } from '../art/characters';
import { cached, canvas, OUTLINE } from '../art/objects';
import { mix, rgb, shade, type Color, type PixelImage } from '../art/pixels';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import type { Renderer } from '../engine/renderer';
import type { Game } from '../game/game';
import type { Scene } from '../game/scene';
import { ringFrame } from '../objects/rings';
import type { CharId } from '../player/types';
import { EMERALD_COLORS, STAGES } from '../specialstage/layouts';
import { Cell, JUMP_FRAMES, SIZE, StageLogic } from '../specialstage/logic';

// Camera model: the floor is a huge sphere; the camera sits behind and above the player.
const R = 26; // sphere radius in cells
const CAM_H = 2.4;
const PITCH = 0.36;
const FOCAL = 210;
const CY = 62; // screen row of the optical axis
const BACK = 3.2; // camera distance behind the player, in cells

interface View {
  dx: Float32Array;
  dz: Float32Array;
  shadeRow: Float32Array;
}

let view: View | null = null;

/** Precompute the floor coordinate (relative to the player) under every screen pixel. */
function buildView(): View {
  const dx = new Float32Array(SCREEN_W * SCREEN_H).fill(NaN);
  const dz = new Float32Array(SCREEN_W * SCREEN_H).fill(NaN);
  const shadeRow = new Float32Array(SCREEN_H);
  const cp = Math.cos(PITCH),
    sp = Math.sin(PITCH);
  // Camera basis: forward f, up u, right r.
  const f = [0, -sp, cp],
    u = [0, cp, sp];
  const oy = CAM_H + R; // camera height above the sphere centre
  for (let sy = 0; sy < SCREEN_H; sy++) {
    for (let sx = 0; sx < SCREEN_W; sx++) {
      const a = (sx - SCREEN_W / 2) / FOCAL,
        b = -(sy - CY) / FOCAL;
      let x = a,
        y = f[1]! + b * u[1]!,
        z = f[2]! + b * u[2]!;
      const n = Math.hypot(x, y, z);
      x /= n;
      y /= n;
      z /= n;
      // Ray-sphere intersection (sphere centre at (0, -R, 0) relative to the floor under the camera).
      const bq = oy * y;
      const c = oy * oy - R * R;
      const disc = bq * bq - c;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t <= 0) continue;
      const px = x * t,
        py = oy + y * t,
        pz = z * t;
      const i = sy * SCREEN_W + sx;
      dz[i] = R * Math.atan2(pz, py) - BACK;
      dx[i] = R * Math.atan2(px, Math.hypot(py, pz));
    }
    shadeRow[sy] = 1;
  }
  return { dx, dz, shadeRow };
}

/** Screen position and scale of a point on the floor at (dx, dz) cells from the player, lifted by `h`. */
function project(dx: number, dz: number, h: number): { x: number; y: number; s: number } | null {
  const phi = (dz + BACK) / R,
    th = dx / R;
  const rr = R + h;
  const px = rr * Math.sin(th),
    py = rr * Math.cos(th) * Math.cos(phi) - R,
    pz = rr * Math.cos(th) * Math.sin(phi);
  // Into camera space.
  const vy = py - CAM_H,
    vz = pz;
  const cp = Math.cos(PITCH),
    sp = Math.sin(PITCH);
  const zc = -vy * sp + vz * cp;
  const yc = vy * cp + vz * sp;
  if (zc < 0.3) return null;
  return { x: SCREEN_W / 2 + (px / zc) * FOCAL, y: CY - (yc / zc) * FOCAL, s: FOCAL / zc };
}

function sphereImg(kind: Cell, d: number): PixelImage {
  const size = Math.max(2, Math.min(64, Math.round(d)));
  return cached(`ss:${kind}:${size}`, () => {
    const img = canvas(size + 2, size + 2);
    const r = size / 2;
    const c = r + 1;
    const base: Color =
      kind === Cell.Blue
        ? rgb(48, 96, 255)
        : kind === Cell.Red
          ? rgb(232, 40, 40)
          : kind === Cell.Yellow
            ? rgb(252, 216, 32)
            : rgb(232, 232, 240);
    img.circle(c, c, r, shade(base, 0.6));
    img.circle(c - r * 0.12, c - r * 0.12, r * 0.85, base);
    img.circle(c - r * 0.35, c - r * 0.35, Math.max(0.6, r * 0.25), mix(base, rgb(255, 255, 255), 0.7));
    if (kind === Cell.Bumper && size > 6) {
      // Star on the bumper.
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 ? r * 0.25 : r * 0.6;
        pts.push([c + Math.cos(a) * rad, c + Math.sin(a) * rad]);
      }
      img.poly(pts, rgb(232, 48, 48));
    }
    if (size > 5) img.outline(OUTLINE);
    return img;
  });
}

function emeraldImg(i: number, big: boolean): PixelImage {
  return cached(`emerald:${i}:${big}`, () => {
    const s = big ? 3 : 1;
    const img = canvas(16 * s, 14 * s);
    const c = EMERALD_COLORS[i]!;
    img.poly(
      [
        [3 * s, 0],
        [13 * s, 0],
        [16 * s, 5 * s],
        [8 * s, 14 * s],
        [0, 5 * s],
      ],
      c,
    );
    img.poly(
      [
        [4 * s, 1 * s],
        [8 * s, 1 * s],
        [6 * s, 5 * s],
      ],
      mix(c, rgb(255, 255, 255), 0.6),
    );
    img.outline(OUTLINE);
    return img;
  });
}

function makeCanvas(): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(SCREEN_W, SCREEN_H);
  const c = document.createElement('canvas');
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  return c;
}

export class SpecialStageScene implements Scene {
  readonly music = 'special';
  readonly logic: StageLogic;
  private readonly floor: ImageData | null = null;
  private readonly floorBuf: Uint32Array | null = null;
  private endT = 0;
  private readonly charId: CharId;
  private floorCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  constructor(
    readonly stageIndex: number,
    charId: CharId,
    private readonly onDone: (game: Game, won: boolean, rings: number) => void,
  ) {
    this.logic = new StageLogic(stageIndex);
    this.charId = charId;
    if (typeof ImageData !== 'undefined') {
      this.floor = new ImageData(SCREEN_W, SCREEN_H);
      this.floorBuf = new Uint32Array(this.floor.data.buffer);
    }
  }

  update(game: Game): void {
    const L = this.logic;
    L.update(game.pad);
    for (const e of L.events) {
      const s = (
        {
          blue: 'blueSphere',
          red: 'redSphere',
          ring: 'ring',
          bumper: 'bumper',
          spring: 'spring',
          jump: 'jump',
          fail: 'redSphere',
          clear: 'giantRing',
          perfect: 'giantRing',
        } as const
      )[e];
      if (s) game.sound.sfx(s);
    }
    if (L.state === 'clear' || L.state === 'fail') {
      if (++this.endT === 180 && !game.transitioning) this.onDone(game, L.state === 'clear', L.rings);
    }
  }

  render(r: Renderer): void {
    const st = STAGES[this.stageIndex % STAGES.length]!;
    const L = this.logic;
    view ??= buildView();
    // Sky
    const bands = 12;
    for (let i = 0; i < bands; i++)
      r.rect(0, (i * 120) / bands, SCREEN_W, 120 / bands + 1, mix(st.skyTop, st.skyBottom, i / (bands - 1)));
    for (let i = 0; i < 30; i++) {
      const x = (((i * 73 - L.angle * 200) % SCREEN_W) + SCREEN_W) % SCREEN_W;
      if ((i + (L.t >> 4)) % 5) r.rect(x, (i * 37) % 70, 1, 1, rgb(255, 255, 255));
    }
    // Floor (software-rendered into an ImageData)
    if (this.floor && this.floorBuf) {
      const fx = Math.sin(L.angle),
        fy = -Math.cos(L.angle);
      const rx = Math.cos(L.angle),
        ry = Math.sin(L.angle);
      const buf = this.floorBuf;
      const { dx, dz } = view;
      const A = st.floorA,
        B = st.floorB;
      const Ad = shade(A, 0.7),
        Bd = shade(B, 0.75);
      let first = -1;
      for (let i = 0; i < buf.length; i++) {
        const z = dz[i]!;
        if (z !== z) {
          buf[i] = 0;
          continue;
        }
        if (first < 0) first = i;
        const x = dx[i]!;
        const wx = L.x + rx * x + fx * z,
          wy = L.y + ry * x + fy * z;
        const odd = (Math.floor(wx + 0.5) + Math.floor(wy + 0.5)) & 1;
        const far = z > 9;
        buf[i] = odd ? (far ? Ad : A) : far ? Bd : B;
      }
      // putImageData ignores alpha, so go through an offscreen canvas to keep the sky.
      this.floorCanvas ??= makeCanvas();
      const fctx = this.floorCanvas.getContext('2d') as CanvasRenderingContext2D;
      const startRow = Math.max(0, Math.floor(first / SCREEN_W));
      fctx.putImageData(this.floor, 0, 0, 0, startRow, SCREEN_W, SCREEN_H - startRow);
      r.ctx.drawImage(this.floorCanvas, 0, 0);
    }
    // Spheres, back to front.
    const items: { x: number; y: number; s: number; c: Cell; z: number }[] = [];
    const fx = Math.sin(L.angle),
      fy = -Math.cos(L.angle);
    const rx = Math.cos(L.angle),
      ry = Math.sin(L.angle);
    const cx0 = Math.round(L.x),
      cy0 = Math.round(L.y);
    for (let oy = -15; oy <= 15; oy++)
      for (let ox = -15; ox <= 15; ox++) {
        const gx = cx0 + ox,
          gy = cy0 + oy;
        const c = L.cell(gx, gy);
        if (c === Cell.Empty) continue;
        const wx = gx - L.x,
          wy = gy - L.y;
        const vdx = wx * rx + wy * ry,
          vdz = wx * fx + wy * fy;
        if (vdz < -BACK + 0.6 || vdz > 15 || Math.abs(vdx) > 14) continue;
        const p = project(vdx, vdz, 0.5);
        if (!p) continue;
        items.push({ ...p, c, z: vdz });
      }
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      if (it.c === Cell.Ring) {
        const img = ringFrame(L.t >> 3);
        if (it.s > 20) r.image(img, it.x, it.y);
        else r.rect(it.x - 1, it.y - 1, 2, 2, rgb(252, 216, 48));
        continue;
      }
      r.image(sphereImg(it.c, it.s * 0.9), it.x, it.y);
    }
    // Player
    const pp = project(0, 0, 0)!;
    const jump = L.airborne
      ? Math.sin((L.jumpT / L.jumpLen) * Math.PI) * (L.jumpLen > JUMP_FRAMES ? 70 : 34)
      : 0;
    const pal = PALETTES[this.charId];
    const frame = L.state === 'run' ? Math.floor(L.t / Math.max(2, Math.round(0.4 / L.speed))) : 0;
    const img = cached(`back:${this.charId}:${frame & 3}`, () => drawBackView(this.charId, pal, frame & 3));
    if (L.state !== 'fail' || this.endT & 4) r.image(img, pp.x, pp.y - jump);
    // HUD
    r.rect(8, 6, 66, 20, rgb(16, 32, 120));
    r.image(sphereImg(Cell.Blue, 12), 18, 16);
    r.text(String(L.blueLeft).padStart(3, ' '), 32, 12);
    r.rect(SCREEN_W - 74, 6, 66, 20, rgb(120, 80, 16));
    r.image(ringFrame(L.t >> 3), SCREEN_W - 64, 16);
    r.text(String(L.rings).padStart(3, ' '), SCREEN_W - 50, 12);
    if (L.state === 'intro') r.textCentered('GET BLUE SPHERES', 100, rgb(255, 255, 255));
    if (L.state === 'clear') {
      r.textCentered(L.ringsLeft === 0 ? 'PERFECT!' : 'CHAOS EMERALD', 70, rgb(255, 255, 255));
      r.image(emeraldImg(this.stageIndex % 7, true), SCREEN_W / 2, 110);
    }
    if (L.state === 'fail') r.fade(Math.min(0.8, this.endT / 120), rgb(255, 255, 255));
    // Collected emeralds
    void SIZE;
  }
}

export { emeraldImg };
