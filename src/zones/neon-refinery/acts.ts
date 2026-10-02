import type { Act } from '../../game/act';
import { LevelBuilder, Mat } from '../../level/builder';

/**
 * Neon Refinery: a night-time chemical works of neon decks, transport tubes,
 * speed boosters and a basin of rising pink chemical — a homage to the second
 * game's industrial zone.
 */

function groundRings(b: LevelBuilder, x: number, n: number, lift = 24, dx = 24, fromY = 0): void {
  for (let i = 0; i < n; i++) b.onGround('ring', x + i * dx, lift, {}, fromY);
}

/** A walkable slab `depth` px thick (decks, bridges). */
function deck(b: LevelBuilder, x0: number, x1: number, y: number, depth = 48, mat = Mat.Ground): void {
  b.terrain(
    [
      [x0, y],
      [x1, y],
    ],
    { depth, material: mat },
  );
}

/** Machinery back wall (drawn, not solid). */
function backWall(b: LevelBuilder, x: number, y: number, w: number, h: number): void {
  b.rect(x, y, w, h, { material: Mat.Decor, solid: false });
}

export function buildRefineryAct1() {
  const G = 1600;
  const b = new LevelBuilder(11264, 2560);

  // --- Start, ramp down to a booster and loop
  b.terrain([
    [0, G],
    [900, G],
    [1300, G + 120],
    [2000, G + 120],
    [2400, G - 40],
    [4400, G - 40],
    [4500, G - 40, 'step'],
    [4501, G + 260],
    [6100, G + 260],
  ]);
  backWall(b, 300, G - 260, 500, 260);
  groundRings(b, 200, 6);
  b.onGround('drillBot', 700, 14);
  b.onGround('monitor', 860, 16, { kind: 'rings' });
  b.onGround('speedBooster', 1420, 4, { dir: 1 });
  b.loop(1720, G + 120, 104, { material: Mat.Structure });
  b.ringArc(1720, G + 120 - 104, 72, -60, 240, 14);
  b.onGround('crawlBot', 2200, 12);

  // --- Lower corridor under a deck; a tube lifts you to the upper route
  deck(b, 2900, 4100, G - 380);
  backWall(b, 2900, G - 332, 1200, 292);
  b.place('tube', 2700, G - 60, {
    path: [
      [0, 0],
      [100, 0],
      [170, -50],
      [200, -300],
      [240, -340],
      [300, -340],
    ],
    speed: 12,
  });
  b.place('clampSpider', 3200, G - 316, { reach: 200 });
  b.place('clampSpider', 3700, G - 316, { reach: 200 });
  b.onGround('crawlBot', 3450, 12);
  b.onGround('drillBot', 3950, 14);
  groundRings(b, 3100, 8, 24, 28);
  // Upper route: boosters, rings and a shield
  b.onGround('speedBooster', 3050, 4, { dir: 1 }, G - 500);
  b.rings(3300, G - 420, 10, 28);
  b.onGround('monitor', 3900, 16, { kind: 'lightning' }, G - 500);
  b.onGround('monitor', 3940, 16, { kind: 'rings' }, G - 500);
  b.onGround('starpost', 4300, 32, { id: 1 });

  // --- Elevator pit up to a high walkway
  b.place('platform', 4620, G + 140, { w: 64, motion: 'v', range: 100, period: 240 });
  b.place('platform', 4840, G + 20, { w: 64, motion: 'v', range: 100, period: 240, phase: 0.5 });
  b.place('platform', 5060, G - 100, { w: 64, motion: 'v', range: 100, period: 240 });
  b.onGround('spring', 4950, 8, { dir: 'up', red: true });
  b.onGround('crawlBot', 4950, 12);
  deck(b, 5240, 6000, G - 260);
  // Fell to the pit floor? This spring launches you clear of the deck to the ramp.
  b.onGround('spring', 6084, 8, { dir: 'up', red: true }, G);
  b.onGround('drillBot', 5700, 14, {}, G - 400);
  groundRings(b, 5300, 6, 24, 24, G - 400);
  b.onGround('monitor', 5960, 16, { kind: 'shoes' }, G - 400);

  // --- Down a long ramp, through a second tube, to a booster run
  b.terrain([
    [6100, G - 260],
    [6200, G - 260],
    [6700, G + 160],
    [6900, G + 160],
  ]);
  b.place('tube', 6880, G + 140, {
    path: [
      [0, 0],
      [120, 0],
      [200, 60],
      [400, 60],
      [480, 0],
      [520, -200],
      [600, -260],
      [680, -260],
    ],
    speed: 14,
  });
  b.terrain([
    [7480, G - 100],
    [8300, G - 100],
    [8600, G + 40],
    [9300, G + 40],
    [9700, G - 20],
    [11264, G - 20],
  ]);
  b.onGround('crawlBot', 7800, 12);
  b.onGround('spikes', 8050, 16, { count: 4 });
  b.onGround('speedBooster', 8640, 4, { dir: 1 });
  b.loop(8960, G + 40, 104, { material: Mat.Structure });
  b.ringArc(8960, G + 40 - 104, 72, -60, 240, 14);
  b.onGround('drillBot', 9900, 14);
  b.onGround('crawlBot', 10200, 12);
  groundRings(b, 9800, 8);
  b.onGround('signpost', 10600, 48);
  b.place('giantRing', 5350, G - 380);
  backWall(b, 9800, G - 300, 700, 280);

  b.start = { x: 96, y: G - 40 };
  return b.build();
}

export function buildRefineryAct2() {
  const G = 1400;
  const b = new LevelBuilder(11264, 3072);

  // --- Top floor
  b.terrain(
    [
      [0, G],
      [1400, G],
    ],
    { depth: 64 },
  );
  b.rect(0, G + 64, 1400, 1100, { material: Mat.Rock });
  groundRings(b, 200, 6);
  b.onGround('drillBot', 600, 14);
  b.place('clampSpider', 900, G - 200, { reach: 150 });
  b.onGround('crawlBot', 1150, 12);

  // --- Drop into the chemical basin
  b.terrain([
    [1400, G + 900],
    [4200, G + 900],
  ]);
  backWall(b, 1400, G + 200, 2800, 700);
  b.rect(4200, G + 260, 600, 1200, { material: Mat.Rock });
  b.place('platform', 1600, G + 300, { w: 64, motion: 'fall' });
  b.place('platform', 1760, G + 480, { w: 64, motion: 'fall' });
  b.onGround('bubbleVent', 2400, 4);
  b.onGround('bubbleVent', 3300, 4);
  b.onGround('crawlBot', 2200, 12);
  b.onGround('drillBot', 2900, 14);
  b.onGround('monitor', 2050, 16, { kind: 'bubble' });
  groundRings(b, 2500, 8, 24, 28);
  b.onGround('starpost', 1900, 32, { id: 1 });
  // Escape route: a staircase of blocks up to a red spring by the exit.
  for (let k = 0; k < 5; k++) {
    const top = G + 900 - 80 * (k + 1);
    // The last step reaches the basin wall so there is no gap to fall into.
    b.rect(3300 + k * 160, top, k === 4 ? 4200 - (3300 + k * 160) : 160, G + 900 - top, {
      material: Mat.Platform,
    });
  }
  b.onGround('spring', 4184, 8, { dir: 'up', red: true }, G + 400);
  b.rings(3340, G + 790, 4, 28);
  b.rings(3660, G + 630, 4, 28);

  // --- Upper corridor, tubes and boosters
  b.terrain(
    [
      [4200, G + 260],
      [6200, G + 260],
      [6600, G + 100],
      [7400, G + 100],
    ],
    { depth: 96 },
  );
  b.onGround('starpost', 4400, 32, { id: 2 });
  b.onGround('speedBooster', 4600, 4, { dir: 1 });
  b.loop(5200, G + 260, 104, { material: Mat.Structure });
  b.onGround('drillBot', 5700, 14);
  b.place('clampSpider', 6000, G + 60, { reach: 140 });
  b.onGround('monitor', 6900, 16, { kind: 'rings' });
  b.place('tube', 7350, G + 80, {
    path: [
      [0, 0],
      [80, 0],
      [160, 120],
      [160, 360],
      [240, 440],
      [460, 440],
    ],
    speed: 13,
  });
  b.terrain([
    [7700, G + 560],
    [8600, G + 560],
    [9000, G + 400],
    [11264, G + 400],
  ]);
  b.onGround('crawlBot', 8100, 12);
  b.onGround('spikes', 8350, 16, { count: 4 });
  b.place('giantRing', 8700, G + 300);
  b.onGround('monitor', 9300, 16, { kind: 'shield' });
  groundRings(b, 9100, 6);
  b.place('bossTrigger', 9600, G + 400, { w: 448, boss: 'refineryBoss' });
  b.onGround('capsule', 10300, 32);

  b.start = { x: 96, y: G - 40 };
  b.waterY = G + 1000;
  return b.build();
}

/** Rising chemical: once the player is down in the basin it climbs toward the exit. */
export function setupRefineryAct2(act: Act): void {
  const G = 1400;
  let rising = false;
  act.scripts.push((a) => {
    const p = a.leader;
    if (!rising && p.x > 2000 && p.x < 4200 && p.y > G + 600) {
      rising = true;
      a.sfx('collapse');
    }
    if (rising && a.waterY > G + 300) a.waterY = Math.max(G + 300, a.waterY - 0.4);
    // Out of the basin: the liquid stays behind (it is off-screen by now).
    if (p.x > 4700 && p.y < G + 300) a.waterY = Infinity;
  });
}
