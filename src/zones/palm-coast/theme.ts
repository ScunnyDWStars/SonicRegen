import { PixelImage, rgb, type Color } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import { gradient, lineScroll, rng, silhouette, tileH } from '../bg';
import { hash2, type ZoneTheme } from '../theme';

// Palette
const GRASS_HI = rgb(120, 232, 64);
const GRASS = rgb(48, 184, 40);
const GRASS_DK = rgb(24, 120, 32);
const GRASS_EDGE = rgb(8, 72, 24);
const DIRT_A = rgb(212, 128, 48);
const DIRT_B = rgb(164, 84, 28);
const DIRT_LINE = rgb(104, 48, 16);
const DIRT_HI = rgb(236, 168, 80);
const STONE_A = rgb(148, 132, 172);
const STONE_B = rgb(108, 92, 140);
const STONE_LINE = rgb(60, 48, 92);
const LOOP_A = rgb(232, 160, 64);
const LOOP_B = rgb(196, 112, 40);
const DECOR_A = rgb(116, 64, 28);
const DECOR_B = rgb(92, 48, 20);

function ground(x: number, y: number, up: number, down: number): Color {
  // Grass cap with a ragged lower edge.
  const drip = 5 + Math.floor(hash2(x >> 2, 7) * 4) + ((x >> 2) % 3 === 0 ? 2 : 0);
  if (up < drip) {
    if (up === 0) return hash2(x, 1) < 0.3 ? GRASS : GRASS_HI;
    if (up === drip - 1) return GRASS_EDGE;
    if (up < 3) return GRASS;
    return (x + up) % 5 === 0 ? GRASS : GRASS_DK;
  }
  if (down === 0) return DIRT_LINE;
  // Classic two-tone checkerboard with dark seams and a highlight edge.
  const cx = Math.floor(x / 16),
    cy = Math.floor(y / 16);
  const lx = ((x % 16) + 16) % 16,
    ly = ((y % 16) + 16) % 16;
  if (lx === 15 || ly === 15) return DIRT_LINE;
  const a = (cx + cy) & 1;
  if (a && (lx === 0 || ly === 0)) return DIRT_HI;
  // Subtle vertical striping inside the light squares.
  if (a && lx % 4 === 1) return DIRT_A;
  return a ? DIRT_A : DIRT_B;
}

function stone(x: number, y: number, up: number, down: number): Color {
  if (up === 0 || down === 0) return STONE_LINE;
  const row = Math.floor(y / 12);
  const lx = (((x + (row & 1) * 12) % 24) + 24) % 24,
    ly = ((y % 12) + 12) % 12;
  if (lx === 0 || ly === 0) return STONE_LINE;
  if (ly === 1 || lx === 1) return rgb(180, 168, 200);
  return hash2(x >> 1, y >> 1) < 0.15 ? STONE_B : STONE_A;
}

export const PALM_COAST: ZoneTheme = {
  id: 'palm-coast',
  name: 'PALM COAST',
  music: 'palmCoast',
  flavor: 'palm',
  paint(mat, x, y, up, down) {
    switch (mat) {
      case 1:
        return ground(x, y, up, down);
      case 2:
        return stone(x, y, up, down);
      case 3: {
        if (up < 4) return up === 0 ? GRASS_HI : up === 3 ? GRASS_EDGE : GRASS;
        return stone(x, y, up, down);
      }
      case 4: {
        // Loops and ramps: warm checker with a dark rim.
        if (up === 0 || down === 0) return DIRT_LINE;
        const a = (Math.floor(x / 8) + Math.floor(y / 8)) & 1;
        return a ? LOOP_A : LOOP_B;
      }
      case 5: {
        const crack = Math.abs(((x - y) % 23) + ((x + y * 2) % 17)) < 2;
        return crack ? STONE_LINE : stone(x, y, up, down);
      }
      case 6: {
        const a = (Math.floor(x / 16) + Math.floor(y / 16)) & 1;
        return a ? DECOR_A : DECOR_B;
      }
      default:
        return ground(x, y, up, down);
    }
  },
  drawBackground(r, camX, camY, frame) {
    drawPalmBackground(r, camX, camY, frame);
  },
};

// ---------------------------------------------------------------------------
// Background art (generated once)
// ---------------------------------------------------------------------------

let bg: { clouds: PixelImage; mountains: PixelImage; hills: PixelImage; sea: PixelImage } | null = null;

function makeBackground() {
  const R = rng(1234);
  const clouds = new PixelImage(512, 40);
  for (let i = 0; i < 9; i++) {
    const cx = R() * 512,
      cy = 14 + R() * 16,
      w = 20 + R() * 30;
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * w * 0.35,
        rr = w * (0.25 + R() * 0.2);
      for (const dx of [-512, 0, 512])
        clouds.ellipse(cx + ox + dx, cy - rr * 0.3, rr, rr * 0.6, rgb(255, 255, 255));
    }
    for (const dx of [-512, 0, 512]) clouds.ellipse(cx + dx, cy + 4, w * 0.9, 3, rgb(200, 224, 255));
  }
  const mountains = new PixelImage(512, 64);
  silhouette(
    mountains,
    (x) => 20 + 14 * Math.sin((x / 512) * Math.PI * 6) + 8 * Math.sin((x / 512) * Math.PI * 14 + 1),
    (x, y, top) =>
      y - top < 3 ? rgb(196, 220, 255) : (x + y) % 9 === 0 ? rgb(112, 144, 208) : rgb(128, 160, 224),
  );
  const hills = new PixelImage(512, 56);
  silhouette(
    hills,
    (x) => 18 + 10 * Math.sin((x / 512) * Math.PI * 4) + 6 * Math.cos((x / 512) * Math.PI * 10),
    (x, y, top) => {
      const d = y - top;
      // Waterfalls on some slopes.
      if (x % 128 > 60 && x % 128 < 68 && d > 4)
        return (y + x) % 4 < 2 ? rgb(224, 240, 255) : rgb(160, 200, 255);
      if (d < 3) return rgb(96, 208, 80);
      if (d < 8) return rgb(40, 152, 64);
      return (Math.floor(x / 8) + Math.floor(y / 8)) & 1 ? rgb(152, 92, 40) : rgb(120, 68, 32);
    },
  );
  const sea = new PixelImage(256, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 256; x++) {
      const base = y < 4 ? rgb(176, 216, 255) : rgb(32, 96 + Math.floor(y / 2), 208);
      const sparkle = hash2(x >> 1, y) > 0.94 && y > 3;
      sea.set(x, y, sparkle ? rgb(200, 232, 255) : base);
    }
  }
  return { clouds, mountains, hills, sea };
}

function drawPalmBackground(r: Renderer, camX: number, camY: number, frame: number): void {
  bg ??= makeBackground();
  const horizon = Math.round(Math.max(96, Math.min(150, 136 - camY * 0.04)));
  gradient(r, 0, horizon - 40, [
    rgb(40, 96, 216),
    rgb(56, 112, 224),
    rgb(72, 128, 232),
    rgb(88, 148, 240),
    rgb(112, 168, 244),
    rgb(144, 192, 248),
  ]);
  r.rect(0, horizon - 40, 320, 40, rgb(144, 192, 248));
  tileH(r, bg.clouds, camX * 0.04 + frame * 0.06, horizon - 108);
  tileH(r, bg.mountains, camX * 0.1, horizon - 64);
  tileH(r, bg.hills, camX * 0.2, horizon - 56);
  lineScroll(r, bg.sea, camX, horizon, 0.24, 0.6, Math.sin(frame / 20) * 2);
  if (horizon + 64 < 224) r.rect(0, horizon + 64, 320, 224 - horizon - 64, rgb(32, 128, 208));
}
