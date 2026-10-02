import { PixelImage, rgb, shade, type Color } from './pixels';

/** Procedurally drawn sprites for common objects. All original art. */

const cache = new Map<string, PixelImage>();
export function cached(key: string, make: () => PixelImage): PixelImage {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

export function canvas(w: number, h: number, ox = w >> 1, oy = h >> 1): PixelImage {
  const img = new PixelImage(w, h);
  img.ox = ox;
  img.oy = oy;
  return img;
}

export const OUTLINE = rgb(16, 16, 40);
const WHITE = rgb(255, 255, 255);
const SILVER = rgb(200, 204, 220);
const SILVER_DK = rgb(120, 124, 148);
const GOLD = rgb(252, 216, 48);
const RED = rgb(228, 36, 36);
const BLUE = rgb(36, 84, 232);
const YELLOW = rgb(252, 232, 48);

// --------------------------------------------------------------------------- monitors

export type MonitorKind =
  'rings' | 'life' | 'shield' | 'fire' | 'bubble' | 'lightning' | 'invincible' | 'shoes' | 'eggman';

function drawIcon(img: PixelImage, kind: MonitorKind, cx: number, cy: number, lifeColor: Color): void {
  switch (kind) {
    case 'rings':
      img.ellipse(cx, cy, 5, 5, GOLD);
      img.ellipse(cx, cy, 2.6, 2.6, 0);
      img.set(cx - 3, cy - 3, WHITE);
      break;
    case 'life':
      img.circle(cx, cy, 5, lifeColor);
      img.poly(
        [
          [cx - 4, cy - 2],
          [cx - 9, cy - 4],
          [cx - 5, cy + 2],
        ],
        lifeColor,
      );
      img.ellipse(cx + 1, cy - 1, 2, 2.5, WHITE);
      img.ellipse(cx + 3, cy + 2.5, 3, 1.6, rgb(252, 200, 148));
      img.set(cx + 2, cy - 1, OUTLINE);
      break;
    case 'shield':
      img.circle(cx, cy, 6, rgb(96, 176, 255));
      img.circle(cx, cy, 4, rgb(200, 232, 255));
      img.circle(cx - 1, cy - 1, 2, WHITE);
      break;
    case 'fire':
      img.poly(
        [
          [cx, cy - 7],
          [cx + 5, cy + 1],
          [cx + 3, cy + 5],
          [cx - 3, cy + 5],
          [cx - 5, cy + 1],
        ],
        rgb(255, 96, 16),
      );
      img.poly(
        [
          [cx, cy - 2],
          [cx + 2.5, cy + 3],
          [cx - 2.5, cy + 3],
        ],
        YELLOW,
      );
      break;
    case 'bubble':
      img.circle(cx, cy, 6, rgb(64, 160, 255));
      img.circle(cx, cy, 4.5, rgb(160, 216, 255));
      img.circle(cx + 2, cy + 2, 1.5, WHITE);
      img.circle(cx - 2, cy - 2, 1.5, WHITE);
      break;
    case 'lightning':
      img.circle(cx, cy, 6, rgb(255, 240, 96));
      img.poly(
        [
          [cx + 1, cy - 6],
          [cx - 3, cy + 1],
          [cx, cy + 1],
          [cx - 1, cy + 6],
          [cx + 3, cy - 1],
          [cx, cy - 1],
        ],
        rgb(64, 64, 200),
      );
      break;
    case 'invincible':
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const x = cx + Math.cos(a) * 3.5,
          y = cy + Math.sin(a) * 3.5;
        img.line(x - 2, y, x + 2, y, 1, i & 1 ? YELLOW : WHITE);
        img.line(x, y - 2, x, y + 2, 1, i & 1 ? YELLOW : WHITE);
      }
      break;
    case 'shoes':
      img.ellipse(cx, cy + 1, 6, 3.5, RED);
      img.rect(cx - 6, cy + 3, 12, 2, WHITE);
      img.rect(cx - 1, cy - 2, 2, 4, WHITE);
      break;
    case 'eggman':
      img.circle(cx, cy, 5.5, rgb(252, 200, 148));
      img.rect(cx - 6, cy - 6, 12, 3, rgb(232, 40, 40));
      img.ellipse(cx, cy + 2, 5, 1.6, rgb(120, 60, 24));
      img.set(cx - 2, cy - 1, OUTLINE);
      img.set(cx + 2, cy - 1, OUTLINE);
      break;
  }
}

export function monitorImg(kind: MonitorKind, frame: number, lifeColor: Color = BLUE): PixelImage {
  const f = frame % 8;
  return cached(`mon:${kind}:${f}:${lifeColor}`, () => {
    const img = canvas(28, 32, 14, 16);
    img.rect(2, 2, 24, 26, SILVER);
    img.rect(2, 2, 24, 2, WHITE);
    img.rect(2, 26, 24, 2, SILVER_DK);
    img.rect(4, 26, 4, 4, SILVER_DK);
    img.rect(20, 26, 4, 4, SILVER_DK);
    img.rect(5, 5, 18, 18, rgb(16, 24, 48));
    if (f === 7) {
      // Static flash
      for (let y = 5; y < 23; y++)
        for (let x = 5; x < 23; x++) if ((x * 7 + y * 13 + f) % 5 < 2) img.set(x, y, SILVER);
    } else {
      drawIcon(img, kind, 14, 14, lifeColor);
    }
    img.rect(5, 5, 18, 1, rgb(64, 80, 128));
    img.outline(OUTLINE);
    return img;
  });
}

export function brokenMonitorImg(): PixelImage {
  return cached('mon:broken', () => {
    const img = canvas(28, 32, 14, 16);
    img.poly(
      [
        [2, 20],
        [8, 16],
        [12, 20],
        [18, 15],
        [26, 21],
        [26, 28],
        [2, 28],
      ],
      SILVER_DK,
    );
    img.rect(4, 26, 4, 4, SILVER_DK);
    img.rect(20, 26, 4, 4, SILVER_DK);
    img.outline(OUTLINE);
    return img;
  });
}

/** Icon that rises out of a broken monitor. */
export function monitorIconImg(kind: MonitorKind, lifeColor: Color = BLUE): PixelImage {
  return cached(`icon:${kind}:${lifeColor}`, () => {
    const img = canvas(18, 18);
    img.rect(0, 0, 18, 18, rgb(16, 24, 48));
    drawIcon(img, kind, 9, 9, lifeColor);
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- springs

/** Spring pointing up. `red` = strong. `compressed` = pressed frame. */
export function springImg(red: boolean, compressed: boolean): PixelImage {
  return cached(`spring:${red}:${compressed}`, () => {
    const img = canvas(32, 32, 16, 24);
    const col = red ? RED : YELLOW;
    const dk = shade(col, 0.65);
    img.rect(2, 26, 28, 6, SILVER_DK);
    img.rect(2, 26, 28, 2, SILVER);
    const top = compressed ? 20 : 8;
    // Coil
    for (let y = top + 4; y < 26; y += 3) img.rect(8, y, 16, 2, y % 2 ? SILVER : SILVER_DK);
    img.rect(0, top, 32, 6, col);
    img.rect(0, top, 32, 2, shade(col, 1.25));
    img.rect(0, top + 5, 32, 1, dk);
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- spikes

export function spikesImg(count: number): PixelImage {
  return cached(`spikes:${count}`, () => {
    const w = count * 8;
    const img = canvas(w, 32, w / 2, 16);
    img.rect(0, 26, w, 6, SILVER_DK);
    for (let i = 0; i < count; i++) {
      const x = i * 8;
      img.poly(
        [
          [x, 27],
          [x + 4, 1],
          [x + 8, 27],
        ],
        SILVER,
      );
      img.line(x + 4, 3, x + 4, 26, 1, WHITE);
      img.line(x + 6, 14, x + 7, 26, 1, SILVER_DK);
    }
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- starpost

export function starpostImg(active: boolean, spin: number): PixelImage {
  return cached(`star:${active}:${spin % 8}`, () => {
    const img = canvas(16, 64, 8, 48);
    img.rect(6, 16, 4, 48, BLUE);
    img.rect(6, 16, 1, 48, rgb(120, 160, 255));
    img.rect(3, 60, 10, 4, SILVER_DK);
    const a = (spin % 8) * (Math.PI / 4);
    const bx = 8 + Math.sin(a) * 4,
      by = 8 - Math.cos(a) * 4 + 4;
    img.circle(bx, by, 4.5, active ? rgb(96, 160, 255) : RED);
    img.set(Math.round(bx) - 1, Math.round(by) - 2, WHITE);
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- signpost

/** `face`: 0 = villain, 1 = character. `turn` 0..1 width squash. */
export function signpostImg(face: 0 | 1, turn: number, charColor: Color): PixelImage {
  const q = Math.round(turn * 4);
  return cached(`sign:${face}:${q}:${charColor}`, () => {
    const img = canvas(48, 64, 24, 48);
    img.rect(22, 32, 4, 32, SILVER_DK);
    img.rect(22, 32, 1, 32, SILVER);
    const w = Math.max(1, 22 * (q / 4));
    img.ellipse(24, 18, w, 16, SILVER);
    if (q >= 2) {
      img.ellipse(24, 18, w - 3, 13, WHITE);
      const sx = (x: number) => 24 + (x - 24) * (q / 4);
      if (face === 0) {
        img.ellipse(24, 20, 9 * (q / 4), 9, rgb(252, 200, 148));
        img.rect(sx(15), 10, 18 * (q / 4), 4, RED);
        img.ellipse(24, 24, 9 * (q / 4), 2, rgb(120, 60, 24));
        img.set(sx(21), 18, OUTLINE);
        img.set(sx(27), 18, OUTLINE);
      } else {
        img.circle(24, 18, 9 * Math.max(0.3, q / 4), charColor);
        img.ellipse(sx(27), 17, 3 * (q / 4), 4, WHITE);
        img.ellipse(sx(28), 22, 4 * (q / 4), 2, rgb(252, 200, 148));
        img.set(sx(28), 17, OUTLINE);
      }
    }
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- capsule

export function capsuleImg(open: boolean): PixelImage {
  return cached(`capsule:${open}`, () => {
    const img = canvas(64, 64, 32, 40);
    img.rect(4, 40, 56, 22, SILVER_DK);
    img.rect(4, 40, 56, 3, SILVER);
    img.ellipse(32, 30, 26, 18, open ? SILVER_DK : rgb(232, 56, 56));
    if (!open) {
      img.ellipse(26, 22, 10, 6, rgb(255, 128, 128));
      img.rect(28, 6, 8, 6, SILVER);
    } else {
      img.ellipse(32, 30, 20, 12, rgb(24, 24, 40));
    }
    for (let x = 10; x < 56; x += 8) img.rect(x, 46, 4, 12, rgb(80, 84, 104));
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- giant ring

export function giantRingImg(frame: number): PixelImage {
  const f = frame % 8;
  return cached(`giant:${f}`, () => {
    const img = canvas(72, 72);
    const wf = Math.abs(Math.cos((f / 8) * Math.PI));
    const rx = Math.max(3, 30 * wf);
    img.ellipse(36, 36, rx, 32, GOLD);
    if (rx > 10) img.ellipse(36, 36, rx - 9, 22, 0);
    img.ellipse(36 - rx * 0.4, 26, Math.max(1, rx * 0.2), 8, rgb(255, 252, 184));
    if (rx > 10) img.ellipse(36 + rx * 0.55, 46, Math.max(1, rx * 0.15), 7, rgb(200, 128, 16));
    img.outline(rgb(96, 48, 8));
    return img;
  });
}

// --------------------------------------------------------------------------- animals

export function animalImg(kind: number, frame: number): PixelImage {
  const f = frame & 1;
  return cached(`animal:${kind}:${f}`, () => {
    const img = canvas(16, 16, 8, 8);
    if (kind % 2 === 0) {
      // Little bird
      const c = kind === 0 ? rgb(64, 128, 255) : rgb(255, 96, 160);
      img.ellipse(8, 9, 5, 4, c);
      img.circle(11, 6, 3, c);
      img.set(12, 5, WHITE);
      img.rect(14, 6, 2, 1, YELLOW);
      img.ellipse(6, f ? 5 : 11, 4, 2, shade(c, 0.7));
    } else {
      // Rabbit
      const c = kind === 1 ? rgb(232, 232, 240) : rgb(212, 160, 96);
      img.ellipse(8, 10, 5, 4, c);
      img.circle(11, 7, 3, c);
      img.rect(10, f ? 0 : 1, 2, 5, c);
      img.set(12, 6, OUTLINE);
      img.rect(4, 13, 3, f ? 3 : 2, c);
    }
    img.outline(OUTLINE);
    return img;
  });
}

// --------------------------------------------------------------------------- misc

export function bubbleVentImg(frame: number): PixelImage {
  return cached(`vent:${frame & 3}`, () => {
    const img = canvas(16, 8, 8, 8);
    img.ellipse(8, 7, 7, 3, SILVER_DK);
    img.ellipse(8, 6, 4, 1.5, rgb(40, 40, 64));
    if (frame & 1) img.circle(8, 3, 1.5, rgb(200, 232, 255));
    img.outline(OUTLINE);
    return img;
  });
}

export function bigBubbleImg(): PixelImage {
  return cached('bigbubble', () => {
    const img = canvas(32, 32);
    img.circle(16, 16, 14, rgb(160, 208, 255));
    img.circle(16, 16, 12, 0);
    img.circle(10, 10, 2.5, WHITE);
    return img;
  });
}
