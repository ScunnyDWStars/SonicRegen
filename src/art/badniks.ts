import { cached, canvas, OUTLINE } from './objects';
import { PixelImage, rgb, shade } from './pixels';

/**
 * Original robot designs. Each nods to a classic badnik's role (ground patroller,
 * flying shooter, crab gunner...) without copying the originals.
 */

const WHITE = rgb(255, 255, 255);
const BLACK = rgb(16, 16, 32);
const STEEL = rgb(176, 184, 208);
const STEEL_DK = rgb(96, 104, 136);
const YELLOW = rgb(252, 216, 48);
const ORANGE = rgb(252, 140, 32);
const RED = rgb(228, 44, 44);

function eye(img: PixelImage, x: number, y: number, r = 2.5, col = RED): void {
  img.circle(x, y, r + 1, BLACK);
  img.circle(x, y, r, col);
  img.set(Math.round(x - r / 2), Math.round(y - r / 2), WHITE);
}

// ---------------------------------------------------------------- Palm Coast

/** "Beetlewheel": a shelled beetle rolling on one big wheel. Faces left. */
export function beetleWheel(frame: number): PixelImage {
  const f = frame & 3;
  return cached(`beetle:${f}`, () => {
    const img = canvas(44, 32, 22, 18);
    const shell = rgb(32, 168, 152);
    // Wheel
    img.circle(26, 24, 7, BLACK);
    img.circle(26, 24, 5, STEEL);
    const a = (f * Math.PI) / 4;
    img.line(
      26 + Math.cos(a) * 5,
      24 + Math.sin(a) * 5,
      26 - Math.cos(a) * 5,
      24 - Math.sin(a) * 5,
      1.5,
      STEEL_DK,
    );
    img.circle(26, 24, 1.5, YELLOW);
    // Body
    img.ellipse(24, 13, 15, 10, shell);
    img.ellipse(22, 9, 9, 5, shade(shell, 1.3));
    img.line(24, 4, 24, 22, 1, shade(shell, 0.6));
    for (const [x, y] of [
      [17, 11],
      [30, 10],
      [20, 17],
      [31, 17],
    ] as const)
      img.circle(x, y, 2, YELLOW);
    // Head and antenna
    img.ellipse(9, 16, 6, 5, STEEL_DK);
    eye(img, 7, 15, 2);
    img.line(10, 11, 4 + (f & 1), 3, 1, STEEL);
    img.circle(4 + (f & 1), 3, 1.5, RED);
    // Exhaust
    img.rect(37, 14, 5, 3, STEEL_DK);
    img.outline(OUTLINE);
    return img;
  });
}

/** "Waspjet": a jet-propelled wasp drone. Faces left. */
export function waspJet(frame: number, firing: boolean): PixelImage {
  const f = frame & 1;
  return cached(`wasp:${f}:${firing}`, () => {
    const img = canvas(48, 32, 24, 16);
    // Wings
    const wing = rgb(200, 232, 255);
    img.ellipse(24, f ? 6 : 9, 10, f ? 4 : 2, wing);
    img.ellipse(30, f ? 7 : 10, 8, f ? 3 : 2, shade(wing, 0.8));
    // Body: head, thorax, striped abdomen (stinger points down when firing)
    img.ellipse(12, 15, 7, 6, STEEL);
    eye(img, 9, 14, 2.5, YELLOW);
    img.ellipse(22, 16, 6, 5, STEEL_DK);
    const ab: [number, number][] = firing
      ? [
          [26, 12],
          [40, 14],
          [34, 28],
          [26, 20],
        ]
      : [
          [26, 12],
          [44, 13],
          [44, 19],
          [26, 20],
        ];
    img.poly(ab, YELLOW);
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const x0 = 26 + (ab[1]![0] - 26) * t,
        y0 = 12 + (ab[1]![1] - 12) * t;
      const x1 = 26 + (ab[2]![0] - 26) * t,
        y1 = 20 + (ab[2]![1] - 20) * t;
      img.line(x0, y0, x1, y1, 2, BLACK);
    }
    // Jet flame
    if (!firing) img.ellipse(46, 16, 2, 1.5, f ? ORANGE : YELLOW);
    img.outline(OUTLINE);
    return img;
  });
}

/** "Clawtank": a crab gunner. Symmetric. `arms` 0 = down, 1 = raised (firing). */
export function clawTank(frame: number, arms: number): PixelImage {
  const f = frame & 1;
  return cached(`crab:${f}:${arms}`, () => {
    const img = canvas(48, 36, 24, 20);
    const body = rgb(236, 92, 44);
    // Legs
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const x = 24 + s * (6 + i * 5);
        img.line(x, 24, x + s * 4, 33 - ((f + i) & 1) * 2, 2, STEEL_DK);
      }
    }
    img.ellipse(24, 19, 12, 8, body);
    img.ellipse(22, 16, 7, 3, shade(body, 1.25));
    eye(img, 19, 10, 2.5, YELLOW);
    eye(img, 29, 10, 2.5, YELLOW);
    img.line(19, 13, 19, 16, 1, STEEL);
    img.line(29, 13, 29, 16, 1, STEEL);
    // Claws
    for (const s of [-1, 1]) {
      const cx = 24 + s * 18,
        cy = arms ? 6 : 20;
      img.line(24 + s * 10, 18, cx, cy + 4, 3, body);
      img.circle(cx, cy, 5, body);
      img.poly(
        [
          [cx, cy - 1],
          [cx + s * 6, cy - 4],
          [cx + s * 3, cy + 1],
        ],
        STEEL,
      );
    }
    img.outline(OUTLINE);
    return img;
  });
}

/** "Snapfish": leaps out of the water. Faces up when leaping. */
export function snapFish(frame: number): PixelImage {
  const f = frame & 1;
  return cached(`fish:${f}`, () => {
    const img = canvas(32, 32, 16, 16);
    const c = rgb(64, 120, 232);
    img.ellipse(16, 16, 9, 12, c);
    img.ellipse(13, 13, 4, 7, shade(c, 1.3));
    img.poly(
      [
        [16, 26],
        [8, 31],
        [24, 31],
      ],
      shade(c, 0.7),
    );
    eye(img, 12, 10, 2.5, YELLOW);
    // Jaw
    img.poly(
      [
        [10, 4 + f * 2],
        [22, 4 + f * 2],
        [16, 8],
      ],
      BLACK,
    );
    for (let x = 11; x < 22; x += 3) img.set(x, 5 + f * 2, WHITE);
    img.outline(OUTLINE);
    return img;
  });
}

export function shotImg(frame: number, color = ORANGE): PixelImage {
  return cached(`shot:${frame & 1}:${color}`, () => {
    const img = canvas(10, 10);
    img.circle(5, 5, frame & 1 ? 4 : 3.5, color);
    img.circle(4, 4, 1.8, YELLOW);
    img.circle(4, 4, 0.8, WHITE);
    return img;
  });
}

// ---------------------------------------------------------------- the villain

/**
 * The doctor in his hover pod. Faces left. `mood`: 0 normal, 1 hit (grimace),
 * 2 defeated (smoke, sweat).
 */
export function eggPod(frame: number, mood: number): PixelImage {
  const f = frame & 1;
  return cached(`pod:${f}:${mood}`, () => {
    const img = canvas(64, 56, 32, 32);
    const skin = rgb(252, 200, 148);
    const coat = rgb(220, 36, 36);
    // Doctor (behind the cockpit rim)
    img.ellipse(30, 14, 11, 10, coat);
    img.circle(26, 8, 8, skin);
    img.ellipse(23, 3, 7, 3, rgb(232, 232, 240)); // bald shine
    // Goggles on forehead
    img.rect(20, 2, 14, 3, rgb(48, 48, 64));
    img.circle(22, 4, 2.2, rgb(128, 200, 255));
    img.circle(29, 4, 2.2, rgb(128, 200, 255));
    // Big moustache
    img.ellipse(18, 13, 7, 3, rgb(120, 60, 24));
    img.ellipse(28, 13, 6, 3, rgb(120, 60, 24));
    img.circle(19, 10, 2.5, rgb(255, 160, 140));
    if (mood === 0) {
      img.set(21, 8, BLACK);
      img.set(26, 8, BLACK);
    } else {
      img.line(20, 7, 23, 9, 1, BLACK);
      img.line(25, 9, 28, 7, 1, BLACK);
      if (mood === 2) img.circle(32, 4, 1.5, rgb(160, 208, 255));
    }
    // Pod
    img.ellipse(32, 34, 28, 14, STEEL);
    img.ellipse(32, 28, 26, 5, STEEL_DK);
    img.ellipse(26, 36, 14, 4, rgb(220, 224, 240));
    img.rect(6, 26, 52, 3, rgb(64, 72, 96));
    img.ellipse(32, 45, 10, 4, STEEL_DK);
    // Thruster
    img.ellipse(32, 50, 4, 2 + f, mood === 2 ? rgb(96, 96, 96) : ORANGE);
    // Windscreen
    img.poly(
      [
        [8, 26],
        [14, 12],
        [20, 26],
      ],
      rgb(160, 216, 255),
    );
    img.outline(OUTLINE);
    return img;
  });
}

/** Spiked wrecking ball and chain link. */
export function wreckBall(): PixelImage {
  return cached('wreck', () => {
    const img = canvas(40, 40);
    img.circle(20, 20, 16, rgb(72, 64, 96));
    img.circle(15, 15, 6, rgb(136, 128, 168));
    img.circle(13, 13, 2, WHITE);
    for (let i = 0; i < 16; i += 2) {
      const a = (i / 16) * Math.PI * 2;
      img.set(20 + Math.cos(a) * 13, 20 + Math.sin(a) * 13, rgb(40, 32, 56));
    }
    img.outline(OUTLINE);
    return img;
  });
}

export function chainLink(): PixelImage {
  return cached('link', () => {
    const img = canvas(8, 8);
    img.circle(4, 4, 3, STEEL);
    img.circle(4, 4, 1.2, 0);
    img.outline(OUTLINE);
    return img;
  });
}

// ---------------------------------------------------------------- Neon Refinery

/** "Crawlbot": a domed crawler on treads with a spike launcher. Faces left. */
export function crawlBot(frame: number): PixelImage {
  const f = frame & 1;
  return cached(`crawl:${f}`, () => {
    const img = canvas(40, 32, 20, 18);
    // Treads
    img.rect(6, 22, 28, 7, BLACK);
    for (let x = 8 + f * 2; x < 34; x += 4) img.rect(x, 23, 2, 5, STEEL_DK);
    // Dome
    img.ellipse(20, 17, 14, 9, rgb(160, 56, 200));
    img.ellipse(17, 13, 7, 4, rgb(208, 120, 240));
    eye(img, 10, 17, 2.5, YELLOW);
    // Spikes on top
    for (const dx of [-6, 0, 6])
      img.poly(
        [
          [20 + dx - 3, 10],
          [20 + dx, 2 - (dx === 0 ? 2 : 0)],
          [20 + dx + 3, 10],
        ],
        STEEL,
      );
    img.outline(OUTLINE);
    return img;
  });
}

/** "Clampspider": a spider drone that drops on a thread. */
export function clampSpider(frame: number): PixelImage {
  const f = frame & 1;
  return cached(`spider:${f}`, () => {
    const img = canvas(40, 32, 20, 14);
    for (const s of [-1, 1])
      for (let i = 0; i < 2; i++) {
        const x0 = 20 + s * 6,
          y0 = 14 + i * 3;
        const kx = 20 + s * (14 + i * 2),
          ky = 8 + i * 6 + f;
        img.line(x0, y0, kx, ky, 2, STEEL_DK);
        img.line(kx, ky, kx + s * 3, ky + 10, 2, STEEL_DK);
      }
    img.ellipse(20, 14, 9, 8, STEEL);
    img.ellipse(18, 11, 4, 3, WHITE);
    eye(img, 20, 16, 3, RED);
    img.outline(OUTLINE);
    return img;
  });
}

/** "Drillbot": a tracked tank with a spinning drill. Faces left. */
export function drillBot(frame: number, charging: boolean): PixelImage {
  const f = frame & 3;
  return cached(`drill:${f}:${charging}`, () => {
    const img = canvas(48, 32, 24, 18);
    img.rect(14, 22, 26, 7, BLACK);
    for (let x = 16 + (f & 1) * 2; x < 40; x += 4) img.rect(x, 23, 2, 5, STEEL_DK);
    img.rect(16, 8, 24, 15, rgb(232, 168, 32));
    img.rect(16, 8, 24, 3, rgb(255, 224, 96));
    for (let x = 18; x < 40; x += 6) img.rect(x, 13, 3, 8, BLACK);
    img.rect(28, 2, 10, 7, STEEL_DK);
    eye(img, 33, 5, 2, charging ? RED : YELLOW);
    // Drill cone
    img.poly(
      [
        [16, 9],
        [2, 15],
        [16, 21],
      ],
      STEEL,
    );
    for (let i = 0; i < 3; i++) {
      const x = 14 - i * 4 - (f % 2) * 2;
      img.line(x, 10 + i * 1.5, x - 1, 20 - i * 1.5, 1, STEEL_DK);
    }
    img.outline(OUTLINE);
    return img;
  });
}

/** A blob of chemical (boss drop). */
export function chemBlob(size: number, frame: number): PixelImage {
  const f = frame & 1;
  return cached(`blob:${size}:${f}`, () => {
    const s = size;
    const img = canvas(s * 2 + 4, s * 2 + 4);
    img.ellipse(s + 2, s + 2, s * (f ? 1 : 0.9), s * (f ? 0.9 : 1), rgb(255, 96, 208));
    img.ellipse(s, s, s * 0.4, s * 0.3, rgb(255, 200, 240));
    img.outline(rgb(96, 16, 80));
    return img;
  });
}
