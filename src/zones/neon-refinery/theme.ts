import { PixelImage, rgb, type Color } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import { gradient, rng, tileH } from '../bg';
import { hash2, type ZoneTheme } from '../theme';

const PANEL = rgb(40, 64, 152);
const PANEL_DK = rgb(24, 40, 104);
const PANEL_HI = rgb(72, 104, 200);
const SEAM = rgb(12, 20, 64);
const NEON = rgb(64, 240, 255);
const NEON_DK = rgb(24, 160, 200);
const BOLT = rgb(160, 176, 224);
const HAZ_Y = rgb(252, 208, 32);
const HAZ_K = rgb(32, 32, 40);
const TEAL = rgb(32, 128, 136);
const TEAL_DK = rgb(16, 84, 96);
const PIPE = [rgb(24, 96, 200), rgb(48, 136, 232), rgb(120, 192, 255), rgb(48, 136, 232), rgb(24, 96, 200)];

function panel(x: number, y: number, up: number, down: number): Color {
  // Neon strip on walkable tops, dark trim underneath.
  if (up === 0) return NEON;
  if (up === 1) return NEON_DK;
  if (up === 2) return SEAM;
  if (down === 0) return SEAM;
  const lx = ((x % 32) + 32) % 32,
    ly = ((y % 32) + 32) % 32;
  if (lx === 0 || ly === 0) return SEAM;
  if (lx === 1 || ly === 1) return PANEL_HI;
  if ((lx === 4 || lx === 28) && (ly === 4 || ly === 28)) return BOLT;
  // Subtle diagonal sheen
  if ((lx + ly) % 16 === 0 && ly < 20) return PANEL_HI;
  return ((x >> 5) + (y >> 5)) & 1 ? PANEL : PANEL_DK;
}

function hazard(x: number, y: number, up: number, down: number): Color {
  if (up < 6) return ((x + y) >> 3) & 1 ? HAZ_Y : HAZ_K;
  if (down === 0 || up === 6) return SEAM;
  return panel(x, y, 8, down);
}

export const NEON_REFINERY: ZoneTheme = {
  id: 'neon-refinery',
  name: 'NEON REFINERY',
  music: 'neonRefinery',
  flavor: 'refinery',
  water: { tint: rgb(255, 128, 224), surface: rgb(255, 176, 240), alpha: 1 },
  paint(mat, x, y, up, down) {
    switch (mat) {
      case 1:
        return panel(x, y, up, down);
      case 2: {
        if (up === 0 || down === 0) return SEAM;
        const lx = ((x % 16) + 16) % 16;
        if (lx === 0) return TEAL_DK;
        return (y >> 2) & 1 ? TEAL : rgb(40, 144, 152);
      }
      case 3:
        return hazard(x, y, up, down);
      case 4: {
        // Pipe-like structures: bands across the thickness.
        const d = Math.min(up, down);
        if (d === 0) return SEAM;
        return PIPE[Math.min(4, d) % 5]!;
      }
      case 5: {
        const g = ((x % 8) + 8) % 8 < 2 || ((y % 8) + 8) % 8 < 2 ? SEAM : rgb(96, 104, 128);
        return up === 0 || down === 0 ? SEAM : g;
      }
      case 6: {
        // Back wall: dim machinery with vertical pipes.
        const lx = ((x % 48) + 48) % 48;
        if (lx < 10) return lx < 2 || lx > 7 ? rgb(16, 24, 56) : rgb(32, 48, 104);
        if (((y % 24) + 24) % 24 === 0) return rgb(16, 24, 56);
        return hash2(x >> 3, y >> 3) < 0.08 ? rgb(64, 32, 96) : rgb(24, 32, 72);
      }
      default:
        return panel(x, y, up, down);
    }
  },
  drawBackground(r, camX, camY, frame) {
    drawRefineryBackground(r, camX, camY, frame);
  },
};

let bg: { far: PixelImage; city: PixelImage; pipes: PixelImage } | null = null;

function makeBackground() {
  const R = rng(777);
  const far = new PixelImage(512, 96);
  // Distant towers
  for (let x = 0; x < 512;) {
    const w = 16 + Math.floor(R() * 24),
      h = 30 + Math.floor(R() * 60);
    for (let yy = 96 - h; yy < 96; yy++)
      for (let xx = x; xx < Math.min(512, x + w); xx++) {
        const win = (xx - x) % 6 > 2 && yy % 8 > 3 && R() > 0.3;
        far.set(xx, yy, win ? rgb(255, 160, 220) : rgb(56, 40, 104));
      }
    x += w + Math.floor(R() * 8);
  }
  const city = new PixelImage(512, 112);
  for (let x = 0; x < 512;) {
    const w = 24 + Math.floor(R() * 40),
      h = 40 + Math.floor(R() * 70);
    const lit = R() > 0.5 ? rgb(96, 240, 255) : rgb(255, 220, 96);
    for (let yy = 112 - h; yy < 112; yy++)
      for (let xx = x; xx < Math.min(512, x + w); xx++) {
        const edge = xx === x || xx === x + w - 1 || yy === 112 - h;
        const win = (xx - x) % 8 > 3 && yy % 10 > 4 && hash2(xx >> 3, yy >> 3) > 0.35;
        city.set(xx, yy, edge ? rgb(20, 16, 56) : win ? lit : rgb(36, 28, 84));
      }
    // Antenna
    if (R() > 0.5)
      for (let yy = 112 - h - 12; yy < 112 - h; yy++) city.set(x + (w >> 1), yy, rgb(255, 64, 96));
    x += w + 4 + Math.floor(R() * 12);
  }
  const pipes = new PixelImage(256, 64);
  for (let i = 0; i < 4; i++) {
    const y = 8 + i * 14;
    for (let x = 0; x < 256; x++) {
      for (let k = 0; k < 6; k++) pipes.set(x, y + k, k === 1 ? rgb(96, 120, 176) : rgb(40, 48, 96));
      if (x % 64 === i * 16) for (let k = -2; k < 8; k++) pipes.set(x, y + k, rgb(24, 24, 56));
    }
  }
  return { far, city, pipes };
}

function drawRefineryBackground(r: Renderer, camX: number, camY: number, frame: number): void {
  bg ??= makeBackground();
  const sky = Math.round(Math.max(40, Math.min(110, 96 - camY * 0.02)));
  gradient(r, 0, sky + 70, [
    rgb(24, 8, 64),
    rgb(56, 16, 96),
    rgb(104, 24, 120),
    rgb(176, 48, 128),
    rgb(232, 96, 112),
    rgb(252, 160, 96),
  ]);
  tileH(r, bg.far, camX * 0.08, sky - 26);
  tileH(r, bg.city, camX * 0.18, sky + 6);
  r.rect(0, sky + 118, 320, 224, rgb(20, 16, 48));
  tileH(r, bg.pipes, camX * 0.35, sky + 118);
  // Blinking beacon lights
  if ((frame >> 5) & 1)
    for (let i = 0; i < 3; i++)
      r.rect((((i * 137 - camX * 0.18) % 320) + 320) % 320, sky + 2, 2, 2, rgb(255, 64, 96));
}
