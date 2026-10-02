import { PixelImage, rgb, type Color } from './pixels';
import type { CharId } from '../player/types';

/**
 * Original character art, drawn from simple posed "puppet" parts and rasterised
 * without anti-aliasing so the result reads as hand-made pixel art. Every frame is
 * a 64x64 image whose hot-spot (32, 32) is the player's centre.
 */

export const FRAME = 64;
const C = 32;

export interface CharPalette {
  main: Color;
  mainDark: Color;
  mainLight: Color;
  skin: Color;
  skinDark: Color;
  shoe: Color;
  shoeDark: Color;
  strap: Color;
  glove: Color;
  gloveDark: Color;
  eye: Color;
  pupil: Color;
  outline: Color;
  /** Character-specific accent (Tails' tail tips, Knuckles' chest crescent). */
  accent: Color;
}

const OUT = rgb(8, 8, 40);
const WHITE = rgb(255, 255, 255);
const GLOVE_DARK = rgb(184, 184, 208);

export const PALETTES: Record<CharId, CharPalette> = {
  sonic: {
    main: rgb(36, 84, 232),
    mainDark: rgb(20, 44, 156),
    mainLight: rgb(96, 148, 255),
    skin: rgb(252, 200, 148),
    skinDark: rgb(212, 148, 100),
    shoe: rgb(228, 36, 36),
    shoeDark: rgb(148, 16, 24),
    strap: WHITE,
    glove: WHITE,
    gloveDark: GLOVE_DARK,
    eye: WHITE,
    pupil: rgb(16, 16, 40),
    outline: OUT,
    accent: WHITE,
  },
  tails: {
    main: rgb(252, 160, 32),
    mainDark: rgb(200, 100, 16),
    mainLight: rgb(255, 208, 96),
    skin: WHITE,
    skinDark: rgb(212, 212, 228),
    shoe: rgb(220, 36, 36),
    shoeDark: rgb(140, 16, 24),
    strap: WHITE,
    glove: WHITE,
    gloveDark: GLOVE_DARK,
    eye: WHITE,
    pupil: rgb(16, 40, 96),
    outline: OUT,
    accent: WHITE,
  },
  knuckles: {
    main: rgb(220, 32, 44),
    mainDark: rgb(140, 12, 28),
    mainLight: rgb(255, 104, 96),
    skin: rgb(252, 200, 148),
    skinDark: rgb(212, 148, 100),
    shoe: rgb(40, 180, 64),
    shoeDark: rgb(16, 112, 40),
    strap: rgb(252, 220, 64),
    glove: WHITE,
    gloveDark: GLOVE_DARK,
    eye: WHITE,
    pupil: rgb(120, 16, 120),
    outline: OUT,
    accent: WHITE,
  },
};

/** Golden palettes for Super forms. */
export function superPalette(id: CharId, flash: number): CharPalette {
  const base = PALETTES[id];
  const t = 0.5 + 0.5 * Math.sin(flash);
  if (id === 'knuckles') {
    return {
      ...base,
      main: rgb(255, 120 + Math.round(60 * t), 160 + Math.round(40 * t)),
      mainDark: rgb(220, 72, 120),
      mainLight: rgb(255, 200, 220),
    };
  }
  return {
    ...base,
    main: rgb(255, 216 + Math.round(30 * t), 48 + Math.round(80 * t)),
    mainDark: rgb(224, 152, 0),
    mainLight: rgb(255, 255, 176),
    pupil: id === 'sonic' ? rgb(200, 0, 16) : base.pupil,
  };
}

// ----------------------------------------------------------------------------
// Pose description
// ----------------------------------------------------------------------------

/** Angles in radians: 0 = pointing straight down, positive = swung forward. */
export interface Pose {
  /** Torso centre relative to the hot-spot. */
  bx: number;
  by: number;
  /** Torso lean (positive = forward). */
  lean: number;
  /** Head centre relative to the hot-spot. */
  hx: number;
  hy: number;
  legF: [number, number];
  legB: [number, number];
  armF: [number, number];
  armB: [number, number];
  eyes: 'open' | 'closed' | 'hurt' | 'up' | 'down' | 'wink';
  /** Draw legs as a blurred figure-eight (top-speed run). */
  blurLegs?: number;
  /** Draw arms as a blur (Tails flying / peel-out). */
  mouth?: 'smile' | 'open' | 'none';
  /** Hide the far arm (some poses). */
  hideArmB?: boolean;
  /** Tails' tail animation phase. */
  tailPhase?: number;
  /** Extra: squash factor for crouching. */
  crouch?: boolean;
}

const BASE_POSE: Pose = {
  bx: 0,
  by: -4,
  lean: 0,
  hx: 1,
  hy: -15,
  legF: [0.05, 0],
  legB: [-0.1, 0],
  armF: [0.15, -0.3],
  armB: [-0.2, -0.3],
  eyes: 'open',
  mouth: 'smile',
};

export function pose(p: Partial<Pose>): Pose {
  return { ...BASE_POSE, ...p };
}

// ----------------------------------------------------------------------------
// Limb helpers
// ----------------------------------------------------------------------------

function seg(x: number, y: number, a: number, len: number): [number, number] {
  return [x + Math.sin(a) * len, y + Math.cos(a) * len];
}

function drawLeg(
  img: PixelImage,
  pal: CharPalette,
  hipX: number,
  hipY: number,
  a1: number,
  a2: number,
  far: boolean,
  shoeScale = 1,
): void {
  const leg = far ? pal.mainDark : pal.main;
  const [kx, ky] = seg(hipX, hipY, a1, 6);
  const [fx, fy] = seg(kx, ky, a1 + a2, 6);
  img.line(hipX, hipY, kx, ky, 3, leg);
  img.line(kx, ky, fx, fy, 3, leg);
  // Shoe: points along the foot direction (perpendicular-ish to the shin).
  const fa = a1 + a2 - Math.PI / 2;
  const sx = fx + Math.sin(-fa) * 3 * shoeScale;
  const sy = fy + 1.5;
  img.ellipse(
    sx,
    sy,
    5.5 * shoeScale,
    3,
    far ? pal.shoeDark : pal.shoe,
    Math.max(-0.6, Math.min(0.6, -a1 * 0.4)),
  );
  img.line(sx - 3, sy + 2.2, sx + 3.5, sy + 2.2, 1.5, far ? pal.gloveDark : WHITE);
  img.line(fx - 0.5, fy - 1, fx + 1, fy + 1.5, 2, far ? pal.gloveDark : pal.strap);
}

function drawArm(
  img: PixelImage,
  pal: CharPalette,
  shX: number,
  shY: number,
  a1: number,
  a2: number,
  far: boolean,
  gloveR = 2.6,
): [number, number] {
  const armCol = far ? pal.skinDark : pal.skin;
  const [ex, ey] = seg(shX, shY, a1, 5);
  const [hx, hy] = seg(ex, ey, a1 + a2, 5);
  img.line(shX, shY, ex, ey, 2, armCol);
  img.line(ex, ey, hx, hy, 2, armCol);
  img.circle(hx, hy, gloveR, far ? pal.gloveDark : pal.glove);
  return [hx, hy];
}

// ----------------------------------------------------------------------------
// Heads
// ----------------------------------------------------------------------------

function drawEyes(img: PixelImage, pal: CharPalette, hx: number, hy: number, eyes: Pose['eyes']): void {
  if (eyes === 'closed') {
    img.line(hx + 1, hy - 1, hx + 7, hy - 1, 1, pal.outline);
    return;
  }
  // Classic joined eye: two overlapping white ovals.
  img.ellipse(hx + 2.5, hy - 2.5, 2.6, 4, pal.eye);
  img.ellipse(hx + 6, hy - 2.5, 2.4, 3.8, pal.eye);
  img.line(hx + 4.3, hy - 6, hx + 4.3, hy + 0.5, 1, pal.mainDark);
  let px = hx + 6.6,
    py = hy - 2.5;
  if (eyes === 'up') py -= 1.5;
  if (eyes === 'down') py += 1.5;
  if (eyes === 'hurt') {
    img.line(hx + 4.8, hy - 4.5, hx + 7.8, hy - 1.5, 1, pal.pupil);
    img.line(hx + 7.8, hy - 4.5, hx + 4.8, hy - 1.5, 1, pal.pupil);
    return;
  }
  img.rect(px - 0.5, py - 1.5, 2, 3, pal.pupil);
  img.set(px, py - 1, WHITE);
  px = hx + 2.8;
  img.rect(px - 0.5, py - 1.5, 1, 3, pal.pupil);
}

function sonicHead(img: PixelImage, pal: CharPalette, p: Pose, hx: number, hy: number): void {
  const m = pal.main;
  // Quills sweep back.
  img.poly(
    [
      [hx - 1, hy - 8],
      [hx - 17, hy - 9],
      [hx - 6, hy - 2],
    ],
    m,
  );
  img.poly(
    [
      [hx - 5, hy - 5],
      [hx - 20, hy - 1],
      [hx - 5, hy + 3],
    ],
    m,
  );
  img.poly(
    [
      [hx - 5, hy + 1],
      [hx - 16, hy + 8],
      [hx - 2, hy + 6],
    ],
    pal.mainDark,
  );
  // Ear.
  img.poly(
    [
      [hx - 4, hy - 7],
      [hx - 2, hy - 14],
      [hx + 2, hy - 7],
    ],
    m,
  );
  img.set(hx - 2, hy - 10, pal.skin);
  img.circle(hx, hy, 8.5, m);
  img.ellipse(hx - 2, hy - 3, 4, 3, pal.mainLight);
  img.circle(hx, hy, 0, m);
  // Muzzle and nose.
  img.ellipse(hx + 5, hy + 4, 5.5, 3.6, pal.skin);
  img.circle(hx + 10.5, hy + 1.5, 1.6, pal.outline);
  if (p.mouth === 'open') img.rect(hx + 5, hy + 5, 3, 2, pal.outline);
  else if (p.mouth === 'smile') img.line(hx + 4, hy + 5.5, hx + 7.5, hy + 5, 1, pal.skinDark);
  drawEyes(img, pal, hx, hy, p.eyes);
}

function tailsHead(img: PixelImage, pal: CharPalette, p: Pose, hx: number, hy: number): void {
  const m = pal.main;
  // Two big ears.
  img.poly(
    [
      [hx - 7, hy - 4],
      [hx - 6, hy - 16],
      [hx, hy - 7],
    ],
    m,
  );
  img.poly(
    [
      [hx - 1, hy - 6],
      [hx + 3, hy - 17],
      [hx + 6, hy - 5],
    ],
    m,
  );
  img.poly(
    [
      [hx - 5, hy - 7],
      [hx - 5, hy - 13],
      [hx - 2, hy - 7],
    ],
    pal.mainDark,
  );
  // Bangs.
  img.poly(
    [
      [hx - 2, hy - 8],
      [hx + 3, hy - 11],
      [hx + 4, hy - 6],
    ],
    m,
  );
  img.circle(hx, hy, 8, m);
  // White cheeks and muzzle.
  img.ellipse(hx + 4, hy + 4, 6, 3.6, pal.skin);
  img.poly(
    [
      [hx - 7, hy + 2],
      [hx - 10, hy + 6],
      [hx - 4, hy + 6],
    ],
    pal.skin,
  );
  img.circle(hx + 9.5, hy + 2, 1.4, pal.outline);
  if (p.mouth === 'open') img.rect(hx + 4, hy + 5, 3, 2, pal.outline);
  drawEyes(img, pal, hx - 0.5, hy, p.eyes);
}

function knucklesHead(img: PixelImage, pal: CharPalette, p: Pose, hx: number, hy: number): void {
  const m = pal.main;
  // Dreadlocks hang down the back.
  img.poly(
    [
      [hx - 2, hy - 7],
      [hx - 12, hy + 2],
      [hx - 13, hy + 13],
      [hx - 5, hy + 4],
    ],
    m,
  );
  img.poly(
    [
      [hx - 6, hy - 3],
      [hx - 9, hy + 6],
      [hx - 8, hy + 16],
      [hx - 2, hy + 6],
    ],
    pal.mainDark,
  );
  img.poly(
    [
      [hx - 4, hy - 8],
      [hx - 14, hy - 5],
      [hx - 18, hy + 4],
      [hx - 8, hy - 1],
    ],
    m,
  );
  img.circle(hx, hy, 8.5, m);
  img.ellipse(hx - 2, hy - 3, 4, 3, pal.mainLight);
  img.ellipse(hx + 5, hy + 4, 5.5, 3.4, pal.skin);
  img.circle(hx + 10.5, hy + 1.5, 1.6, pal.outline);
  if (p.mouth === 'smile') img.line(hx + 4, hy + 5.5, hx + 7.5, hy + 5.5, 1, pal.skinDark);
  if (p.mouth === 'open') img.rect(hx + 5, hy + 5, 3, 2, pal.outline);
  drawEyes(img, pal, hx, hy, p.eyes);
  // Heavy brow.
  img.line(hx + 1, hy - 7, hx + 8, hy - 6, 1.5, pal.mainDark);
}

// ----------------------------------------------------------------------------
// Bodies
// ----------------------------------------------------------------------------

function drawTails(img: PixelImage, pal: CharPalette, cx: number, cy: number, phase: number): void {
  for (let i = 0; i < 2; i++) {
    const a = phase + i * 1.4;
    const ex = cx - 13 - Math.cos(a) * 3,
      ey = cy + 1 + Math.sin(a) * 7 - i * 4;
    const col = i ? pal.mainDark : pal.main;
    img.line(cx - 2, cy + 1, ex, ey, 6, col);
    img.circle(ex - 2, ey, 4.5, col);
    img.circle(ex - 4, ey, 3, i ? pal.gloveDark : pal.skin);
  }
}

/** Draws one standing/moving frame of a character into a fresh 64x64 image. */
export function drawCharacter(id: CharId, pal: CharPalette, p: Pose): PixelImage {
  const img = new PixelImage(FRAME, FRAME);
  img.ox = C;
  img.oy = C;
  const bx = C + p.bx,
    by = C + p.by;
  const hipX = bx - 1 + p.lean * 2,
    hipY = by + 5;
  const shX = bx + 1 + p.lean * 5,
    shY = by - 3;

  if (id === 'tails') drawTails(img, pal, bx, by + 2, p.tailPhase ?? 0);
  if (!p.hideArmB) drawArm(img, pal, shX - 1, shY, p.armB[0], p.armB[1], true, id === 'knuckles' ? 3.4 : 2.6);
  if (p.blurLegs !== undefined) {
    // Figure-eight run blur.
    const t = p.blurLegs;
    img.ellipse(hipX + 2, hipY + 7, 7, 5, pal.shoeDark, t);
    img.ellipse(hipX + 2, hipY + 7, 5, 3, pal.shoe, t + 1.5);
    img.ellipse(hipX + 2, hipY + 7, 2.5, 1.5, WHITE, t + 0.8);
  } else {
    drawLeg(img, pal, hipX - 1, hipY, p.legB[0], p.legB[1], true);
  }
  // Torso.
  img.ellipse(bx, by, 6, 7.5, pal.main, p.lean * 0.5);
  if (id === 'tails') img.ellipse(bx + 3, by - 3, 4, 4, pal.skin);
  else img.ellipse(bx + 2.5, by + 1, 3.6, 5.5, pal.skin, p.lean * 0.5);
  if (id === 'knuckles') {
    img.ellipse(bx + 2, by - 3, 3.5, 2.5, pal.accent);
    img.ellipse(bx + 2, by - 4.5, 3, 1.5, pal.main);
  }
  if (p.blurLegs === undefined) drawLeg(img, pal, hipX + 1, hipY, p.legF[0], p.legF[1], false);
  const hx = C + p.hx,
    hy = C + p.hy;
  if (id === 'sonic') sonicHead(img, pal, p, hx, hy);
  else if (id === 'tails') tailsHead(img, pal, p, hx, hy);
  else knucklesHead(img, pal, p, hx, hy);
  const [gx, gy] = drawArm(
    img,
    pal,
    shX + 1,
    shY,
    p.armF[0],
    p.armF[1],
    false,
    id === 'knuckles' ? 3.6 : 2.6,
  );
  if (id === 'knuckles') {
    // Spiked knuckles.
    img.set(gx + 3, gy - 1, WHITE);
    img.set(gx + 3, gy + 1, WHITE);
  }
  img.outline(pal.outline);
  return img;
}

/** Spinning ball frame (roll / jump / spindash). */
export function drawBall(id: CharId, pal: CharPalette, frame: number, r = 13): PixelImage {
  const img = new PixelImage(FRAME, FRAME);
  img.ox = C;
  img.oy = C;
  const rot = (frame % 4) * (Math.PI / 2) + (frame % 2 ? 0.3 : 0);
  img.circle(C, C, r, pal.main);
  // Spikes around the ball rotate with the frame.
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2;
    const tip: [number, number] = [C + Math.cos(a) * (r + 3), C + Math.sin(a) * (r + 3)];
    img.poly(
      [
        [C + Math.cos(a - 0.35) * (r - 1), C + Math.sin(a - 0.35) * (r - 1)],
        tip,
        [C + Math.cos(a + 0.35) * (r - 1), C + Math.sin(a + 0.35) * (r - 1)],
      ],
      pal.main,
    );
  }
  img.circle(C, C, r - 3, pal.mainDark);
  img.circle(C - 1, C - 1, r - 5, pal.main);
  // Curled-up body details: a sweep of skin/accent and a shoe.
  const a = rot + 2.2;
  img.ellipse(
    C + Math.cos(a) * 4,
    C + Math.sin(a) * 4,
    4.5,
    2.6,
    id === 'tails' ? pal.skin : pal.skin,
    a + 1.57,
  );
  img.ellipse(C + Math.cos(a + 2) * 6, C + Math.sin(a + 2) * 6, 3, 2, pal.shoe, a);
  img.ellipse(C - 3, C - 4, 3, 2, pal.mainLight, -0.6);
  if (id === 'tails') {
    // Tails' tails trail behind the ball.
    const ta = rot + Math.PI;
    img.circle(C + Math.cos(ta) * (r + 2), C + Math.sin(ta) * (r + 2), 4, pal.main);
    img.circle(C + Math.cos(ta) * (r + 4), C + Math.sin(ta) * (r + 4), 2.5, pal.skin);
  }
  img.outline(pal.outline);
  return img;
}

// ----------------------------------------------------------------------------
// Animation table
// ----------------------------------------------------------------------------

export type AnimFrames = PixelImage[];

function walkPoses(n: number, run: boolean): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const s = Math.sin(t);
    const amp = run ? 1.0 : 0.75;
    const bob = Math.abs(Math.cos(t)) * (run ? 1.5 : 1);
    out.push(
      pose({
        by: -4 - bob,
        hy: -15 - bob,
        hx: run ? 3 : 2,
        lean: run ? 0.6 : 0.25,
        legF: [s * amp, Math.max(0, -s) * 1.2 + 0.1],
        legB: [-s * amp, Math.max(0, s) * 1.2 + 0.1],
        armF: [-s * 0.9 + (run ? 0.5 : 0), -0.8],
        armB: [s * 0.9 + (run ? 0.5 : 0), -0.8],
      }),
    );
  }
  return out;
}

/** Builds every animation for a character with a given palette. */
export function buildAnimations(id: CharId, pal: CharPalette): Record<string, AnimFrames> {
  const D = (p: Partial<Pose>) => drawCharacter(id, pal, pose(p));
  const anims: Record<string, AnimFrames> = {};
  anims.idle = [D({})];
  anims.wait = [
    D({ eyes: 'closed', armF: [0.5, -2.2], armB: [-0.3, -0.4] }),
    D({ eyes: 'open', armF: [0.5, -2.2], armB: [-0.3, -0.4] }),
    D({ eyes: 'open', armF: [0.5, -2.2], armB: [-0.3, -0.4], legF: [0.35, -0.5] }),
    D({ eyes: 'open', armF: [0.5, -2.2], armB: [-0.3, -0.4] }),
  ];
  anims.walk = walkPoses(8, false).map((p) => drawCharacter(id, pal, p));
  anims.run = walkPoses(4, true).map((p) => drawCharacter(id, pal, p));
  anims.dash = [0, 1, 2, 3].map((i) =>
    D({
      lean: 0.8,
      hx: 4,
      hy: -15,
      by: -5,
      blurLegs: (i * Math.PI) / 2,
      armF: [1.6, -0.2],
      armB: [1.3, -0.2],
    }),
  );
  anims.roll = [0, 1, 2, 3].map((i) => drawBall(id, pal, i));
  anims.spindash = [0, 1, 2, 3].map((i) => drawBall(id, pal, i, 12));
  anims.skid = [
    D({
      lean: -0.5,
      hx: -2,
      by: -3,
      legF: [0.9, -0.3],
      legB: [0.3, 0.2],
      armF: [-0.8, -0.5],
      armB: [-1.2, -0.5],
      mouth: 'open',
    }),
  ];
  anims.push = [0, 1, 2, 3].map((i) =>
    D({
      lean: 0.7,
      hx: 4,
      hy: -13,
      by: -3,
      legF: [-0.2 + (i % 2) * 0.3, 0.3],
      legB: [-0.7 + (i % 2) * -0.2, 0.3],
      armF: [2.1, 0],
      armB: [2.0, 0],
    }),
  );
  anims.lookUp = [D({ hy: -16, hx: 0, eyes: 'up', armF: [0.2, -0.4] })];
  anims.crouch = [
    D({ by: 2, hy: -6, hx: 3, legF: [1.3, -2.2], legB: [1.0, -2.0], armF: [0.9, -0.6], eyes: 'down' }),
  ];
  anims.balance = [0, 1].map((i) =>
    D({
      lean: -0.4,
      hx: -1,
      legF: [-0.4, 0],
      legB: [0.3, 0],
      armF: [-2.4 + i * 0.4, -0.5],
      armB: [2.2 - i * 0.4, -0.5],
      mouth: 'open',
      eyes: 'down',
    }),
  );
  anims.spring = [0, 1].map((i) =>
    D({
      by: -6,
      hy: -18,
      legF: [0.1, 0],
      legB: [-0.1, 0],
      armF: [2.9 + i * 0.1, 0],
      armB: [2.8, 0],
      eyes: 'up',
    }),
  );
  anims.hurt = [
    D({
      lean: -0.5,
      hx: -2,
      legF: [-0.8, 0.5],
      legB: [-1.2, 0.4],
      armF: [-2.4, 0],
      armB: [-2.8, 0],
      eyes: 'hurt',
      mouth: 'open',
    }),
  ];
  anims.death = [
    D({
      lean: 0,
      legF: [0.6, 0],
      legB: [-0.6, 0],
      armF: [2.6, 0.3],
      armB: [-2.6, -0.3],
      eyes: 'hurt',
      mouth: 'open',
    }),
  ];
  anims.drown = [
    D({ legF: [0.3, 0], legB: [-0.3, 0], armF: [2.8, 0], armB: [-2.8, 0], eyes: 'hurt', mouth: 'open' }),
  ];
  anims.victory = [D({ armF: [3.0, 0.2], eyes: 'wink', mouth: 'open' })];
  anims.carried = [
    D({ armF: [3.1, 0], armB: [3.0, 0], legF: [0.2, 0], legB: [-0.2, 0], hy: -14, eyes: 'up' }),
  ];
  anims.breathe = [D({ mouth: 'open', eyes: 'up' })];

  if (id === 'tails') {
    anims.fly = [0, 1, 2, 3].map((i) =>
      D({
        tailPhase: i * 1.6,
        legF: [0.4, 0.2],
        legB: [0.1, 0.3],
        armF: [2.6, 0.2],
        armB: [2.5, 0],
        eyes: 'up',
        by: -4,
      }),
    );
    anims.flyTired = [0, 1].map((i) =>
      D({
        tailPhase: i * 0.7,
        legF: [0.2, 0],
        legB: [-0.1, 0],
        armF: [2.6, 0.2],
        eyes: 'closed',
        mouth: 'open',
      }),
    );
    for (const k of Object.keys(anims)) {
      if (k === 'fly' || k === 'flyTired' || k === 'roll' || k === 'spindash') continue;
      // Re-draw ordinary frames with animated tails swishing.
      anims[k] = anims[k]!.map((_, i) => anims[k]![i]!);
    }
  }
  if (id === 'knuckles') {
    anims.glide = [0, 1].map((i) =>
      D({
        lean: 1.4,
        hx: 8,
        hy: -9,
        by: -2,
        legF: [-1.4, 0.2],
        legB: [-1.5, 0.3],
        armF: [2.0 + i * 0.05, 0],
        armB: [1.9, 0],
        eyes: 'open',
      }),
    );
    anims.glideFall = [
      D({ armF: [2.8, 0.2], armB: [2.6, 0], legF: [0.4, 0.2], legB: [-0.2, 0.2], eyes: 'down' }),
    ];
    anims.slide = [
      D({
        lean: 1.2,
        by: 4,
        hx: 9,
        hy: -2,
        legF: [-1.4, 0],
        legB: [-1.5, 0],
        armF: [1.7, 0],
        armB: [1.6, 0],
      }),
    ];
    anims.climb = [0, 1, 2, 3].map((i) =>
      D({
        hx: 1,
        hy: -14,
        lean: 0.2,
        armF: [2.2 + (i % 2 ? 0.6 : -0.2), 0.5],
        armB: [2.2 + (i % 2 ? -0.2 : 0.6), 0.5],
        legF: [0.6 + (i % 2 ? -0.3 : 0.3), -0.8],
        legB: [0.6 + (i % 2 ? 0.3 : -0.3), -0.8],
      }),
    );
    anims.ledgeClimb = [
      D({ by: -8, hy: -18, armF: [2.6, 0], armB: [2.4, 0], legF: [0.8, -1.2], legB: [0.4, -1.0] }),
      D({ by: -12, hy: -22, armF: [1.8, 0], armB: [1.6, 0], legF: [1.2, -1.6], legB: [0.6, -1.2] }),
    ];
  }
  return anims;
}
