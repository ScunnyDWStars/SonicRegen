import { mix, PixelImage, rgb, type Color } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import { gradient, lineScroll, rng, silhouette, tileH } from '../bg';
import { hash2, type ZoneTheme } from '../theme';

/**
 * Jungle Isle theme. It has two moods: lush, and burnt after the jungle is
 * fire-bombed (switched at runtime by the act script, like the original).
 */
export const jungleState = { burnt: false, burnT: 0 };

const LUSH = {
  grassHi: rgb(136, 232, 72),
  grass: rgb(56, 176, 48),
  grassDk: rgb(24, 112, 40),
  soilA: rgb(176, 104, 48),
  soilB: rgb(144, 80, 36),
  soilDk: rgb(96, 52, 24),
  root: rgb(208, 152, 88),
  stone: rgb(150, 150, 160),
  stoneDk: rgb(100, 100, 116),
  moss: rgb(64, 160, 72),
  wood: rgb(176, 112, 56),
  woodDk: rgb(112, 68, 32),
  back: rgb(24, 72, 40),
  backDk: rgb(16, 48, 28),
};

const BURNT = {
  grassHi: rgb(232, 120, 48),
  grass: rgb(96, 72, 64),
  grassDk: rgb(56, 44, 44),
  soilA: rgb(120, 72, 48),
  soilB: rgb(96, 56, 40),
  soilDk: rgb(56, 32, 24),
  root: rgb(160, 96, 56),
  stone: rgb(112, 104, 108),
  stoneDk: rgb(72, 64, 72),
  moss: rgb(120, 96, 72),
  wood: rgb(120, 76, 44),
  woodDk: rgb(64, 40, 24),
  back: rgb(48, 28, 28),
  backDk: rgb(32, 20, 20),
};

type Pal = typeof LUSH;

function soil(P: Pal, x: number, y: number, up: number, down: number): Color {
  const blade = 4 + Math.floor(hash2(x >> 1, 3) * 4);
  if (up < blade) {
    if (up === 0) return hash2(x, 5) < 0.4 ? P.grass : P.grassHi;
    if (up === blade - 1) return P.grassDk;
    return (x + up) % 4 === 0 ? P.grassDk : P.grass;
  }
  if (down === 0) return P.soilDk;
  // Embedded stones and wavy roots.
  const sx = Math.floor(x / 20),
    sy = Math.floor(y / 18);
  const h = hash2(sx, sy);
  const cx = sx * 20 + 10 + (h - 0.5) * 8,
    cy = sy * 18 + 9;
  if (h > 0.72 && (x - cx) ** 2 / 36 + (y - cy) ** 2 / 16 < 1) return y - cy < -1 ? P.stone : P.stoneDk;
  const rootLine = Math.sin(x / 13 + Math.floor(y / 24)) * 4 + (y % 24);
  if (Math.abs(rootLine - 12) < 1.2) return P.root;
  return ((y >> 3) + (x >> 4)) & 1 ? P.soilA : P.soilB;
}

function stone(P: Pal, x: number, y: number, up: number, down: number): Color {
  if (up < 3) return up === 0 ? P.moss : mix(P.moss, P.stone, 0.5);
  if (down === 0) return P.stoneDk;
  const lx = (((x + (Math.floor(y / 20) % 2) * 14) % 28) + 28) % 28,
    ly = ((y % 20) + 20) % 20;
  if (lx === 0 || ly === 0) return P.stoneDk;
  return hash2(x >> 2, y >> 2) < 0.12 ? P.stoneDk : P.stone;
}

function wood(P: Pal, x: number, y: number, up: number, down: number): Color {
  if (up === 0) return mix(P.wood, rgb(255, 255, 255), 0.25);
  if (down === 0) return P.woodDk;
  return ((x >> 1) + (y >> 3)) % 7 === 0 ? P.woodDk : P.wood;
}

export const JUNGLE_ISLE: ZoneTheme = {
  id: 'jungle-isle',
  name: 'JUNGLE ISLE',
  music: 'jungleIsle',
  flavor: 'jungle',
  water: { tint: rgb(96, 176, 255), surface: rgb(200, 240, 255), alpha: 1 },
  paint(mat, x, y, up, down) {
    const P = jungleState.burnt ? BURNT : LUSH;
    switch (mat) {
      case 1:
        return soil(P, x, y, up, down);
      case 2:
        return stone(P, x, y, up, down);
      case 3:
        return wood(P, x, y, up, down);
      case 4: {
        if (up === 0 || down === 0) return P.woodDk;
        const v = Math.sin(x / 6 + y / 9) > 0.6;
        return v ? P.grass : P.wood;
      }
      case 5: {
        const crack = Math.abs(((x * 3 - y * 2) % 29) - 14) < 1 || Math.abs(((x + y * 3) % 23) - 11) < 1;
        return crack ? P.stoneDk : stone(P, x, y, up, down);
      }
      case 6: {
        const leaf = Math.sin(x / 9) * Math.cos(y / 7) > 0.3;
        return leaf ? P.back : P.backDk;
      }
      default:
        return soil(P, x, y, up, down);
    }
  },
  drawBackground(r, camX, camY, frame) {
    drawJungleBackground(r, camX, camY, frame);
  },
};

// ---------------------------------------------------------------------------

interface BgSet {
  islands: PixelImage;
  sea: PixelImage;
  canopy: PixelImage;
  trunks: PixelImage;
}
const bgs: { lush?: BgSet; burnt?: BgSet } = {};

function makeBg(burnt: boolean): BgSet {
  const R = rng(4242);
  const islands = new PixelImage(512, 40);
  silhouette(
    islands,
    (x) =>
      30 -
      Math.max(0, Math.sin((x / 512) * Math.PI * 3) * 22) -
      Math.max(0, Math.sin((x / 512) * Math.PI * 7 + 2) * 10),
    (_x, y, top) =>
      y - top < 2
        ? burnt
          ? rgb(120, 64, 64)
          : rgb(96, 168, 96)
        : burnt
          ? rgb(80, 40, 48)
          : rgb(56, 120, 88),
  );
  const sea = new PixelImage(256, 48);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 256; x++) {
      const sp = hash2(x >> 1, y) > 0.93 && y > 2;
      const base = burnt ? rgb(120 + y, 48 + y, 48) : rgb(32, 112 + y, 200);
      sea.set(x, y, sp ? (burnt ? rgb(255, 160, 96) : rgb(200, 240, 255)) : base);
    }
  const canopy = new PixelImage(512, 96);
  for (let i = 0; i < 40; i++) {
    const cx = R() * 512,
      cy = 30 + R() * 50,
      rr = 14 + R() * 18;
    for (const dx of [-512, 0, 512]) {
      canopy.ellipse(cx + dx, cy, rr, rr * 0.7, burnt ? rgb(64, 32, 32) : rgb(32, 112, 56));
      canopy.ellipse(
        cx + dx - rr * 0.3,
        cy - rr * 0.3,
        rr * 0.5,
        rr * 0.3,
        burnt ? rgb(96, 48, 40) : rgb(64, 160, 72),
      );
    }
  }
  canopy.rect(0, 80, 512, 16, burnt ? rgb(48, 24, 24) : rgb(24, 80, 40));
  const trunks = new PixelImage(512, 128);
  for (let x = 20; x < 512; x += 64 + Math.floor(R() * 40)) {
    const w = 10 + Math.floor(R() * 8);
    trunks.rect(x, 0, w, 128, burnt ? rgb(40, 24, 20) : rgb(72, 48, 32));
    trunks.rect(x + 2, 0, 2, 128, burnt ? rgb(72, 40, 32) : rgb(112, 76, 48));
  }
  return { islands, sea, canopy, trunks };
}

function drawJungleBackground(r: Renderer, camX: number, camY: number, frame: number): void {
  const burnt = jungleState.burnt;
  const set = burnt ? (bgs.burnt ??= makeBg(true)) : (bgs.lush ??= makeBg(false));
  const horizon = Math.round(Math.max(70, Math.min(130, 112 - camY * 0.03)));
  if (burnt) {
    gradient(r, 0, horizon, [rgb(96, 16, 24), rgb(152, 32, 24), rgb(208, 72, 32), rgb(240, 136, 48)]);
  } else {
    gradient(r, 0, horizon, [rgb(48, 120, 232), rgb(80, 152, 240), rgb(120, 184, 248), rgb(176, 216, 252)]);
  }
  tileH(r, set.islands, camX * 0.06, horizon - 30);
  lineScroll(r, set.sea, camX, horizon + 8, 0.1, 0.3, Math.sin(frame / 24));
  tileH(r, set.canopy, camX * 0.3, horizon + 20);
  tileH(r, set.trunks, camX * 0.45, horizon + 100);
  if (burnt) {
    // Rising embers.
    for (let i = 0; i < 24; i++) {
      const x = ((i * 97 + frame * (1 + (i % 3))) % 340) - 10;
      const y = 224 - ((frame * (1 + (i % 4)) + i * 53) % 260);
      r.rect(x, y, 2, 2, i % 2 ? rgb(255, 160, 48) : rgb(255, 224, 96));
    }
  }
  if (jungleState.burnT > 0) r.fade(jungleState.burnT / 40, rgb(255, 200, 96));
}
