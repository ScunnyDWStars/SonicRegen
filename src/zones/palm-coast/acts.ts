import { LevelBuilder, Mat, type TerrainPoint } from '../../level/builder';

/**
 * Palm Coast: a seaside zone of checkered hills, loops, log bridges and swinging
 * platforms — a homage to the first zone of the first game.
 */

/** Place decorations resting on the ground at each x. */
function decor(b: LevelBuilder, kind: string, xs: number[], depth = -1): void {
  xs.forEach((x, i) => b.onGround('decor', x, 0, { kind, depth, flip: i % 2 === 1 }));
}

/** Rings following the ground, `lift` px above it. */
function groundRings(b: LevelBuilder, x: number, n: number, lift = 24, dx = 24): void {
  for (let i = 0; i < n; i++) b.onGround('ring', x + i * dx, lift);
}

/** A floating island (finite thickness) with a grassy top. */
function island(b: LevelBuilder, pts: TerrainPoint[], depth = 48): void {
  b.terrain(pts, { depth, material: Mat.Ground });
}

export function buildPalmAct1() {
  const G = 1400;
  const b = new LevelBuilder(11264, 2048);

  // --- Opening hills
  b.terrain([
    [0, G],
    [700, G],
    [900, G - 64],
    [1100, G - 64],
    [1300, G],
    [1500, G + 32],
    [1700, G + 32],
    [2000, G + 160],
    [2700, G + 160],
    [3000, G + 40],
    [3200, G + 40],
  ]);
  b.loop(2350, G + 160, 112);
  b.ringArc(2350, G + 160 - 112, 80, -60, 240, 14);
  groundRings(b, 300, 5);
  groundRings(b, 880, 6, 24, 32);
  b.onGround('monitor', 620, 16, { kind: 'rings' });
  b.onGround('beetleWheel', 1000, 14);
  b.onGround('beetleWheel', 1620, 14);
  b.onGround('monitor', 1860, 16, { kind: 'shield' });
  b.place('waspJet', 2700, G + 20, { range: 160 });
  decor(b, 'palm', [180, 760, 1420, 2900]);
  decor(b, 'sunflower', [420, 520, 1180, 1560, 3050]);
  decor(b, 'tulip', [340, 980, 1240, 2780, 2840]);
  decor(b, 'totem', [1280]);

  // --- Log bridge over the sea, snapping fish below; upper island above
  b.place('logBridge', 3200, G + 40, { w: 384 });
  b.place('snapFish', 3330, G + 140);
  b.place('snapFish', 3460, G + 140);
  b.onGround('spring', 3150, 8, { dir: 'up' });
  island(b, [
    [3260, G - 170],
    [4000, G - 170],
  ]);
  b.rings(3320, G - 200, 8, 32);
  b.place('collapsingLedge', 4048, G - 158, { w: 96, h: 24 });
  b.onGround('monitor', 3900, 16, { kind: 'fire' }, G - 300);
  decor(b, 'palm', [3640]);

  // --- Hill with spikes, crab and checkpoint
  b.terrain([
    [3584, G + 40],
    [3900, G + 40],
    [4200, G - 40],
    [4600, G - 40],
    [4900, G + 60],
    [5200, G + 60],
  ]);
  b.onGround('beetleWheel', 3760, 14, {}, G - 100);
  b.onGround('clawTank', 4300, 16, {}, G - 100);
  b.onGround('spikes', 4480, 16, { count: 4 }, G - 100);
  b.onGround('starpost', 4720, 32, { id: 1 });
  b.place('waspJet', 4400, G - 170, { range: 120 });
  groundRings(b, 4560, 4, 64, 20);
  decor(b, 'sunflower', [4080, 4160, 4640], -1);

  // --- Swinging platforms over a pit, crumbling ledge at the edge
  b.place('swingPlatform', 5330, G - 100, { links: 6, amp: 1.0, phase: 0 });
  b.place('swingPlatform', 5540, G - 100, { links: 6, amp: 1.0, phase: 75 });
  b.rings(5320, G - 20, 3, 24);
  b.rings(5530, G - 20, 3, 24);

  // --- Hills, upper island with the giant ring, second loop
  const main3: TerrainPoint[] = [
    [5700, G + 60],
    [6000, G + 60],
    [6300, G - 60],
    [6600, G - 60],
    [6800, G + 100],
    [7600, G + 100],
    [7900, G],
    [8400, G - 80],
    [8700, G - 80],
    [9000, G + 40],
    [9300, G + 40],
    [9800, G + 120],
    [11264, G + 120],
  ];
  b.terrain(main3);
  b.onGround('beetleWheel', 5900, 14);
  b.onGround('clawTank', 6420, 16);
  b.onGround('spring', 6480, 8, { dir: 'up' });
  island(b, [
    [6260, G - 270],
    [6950, G - 270],
  ]);
  b.place('giantRing', 6620, G - 350);
  b.onGround('monitor', 6900, 16, { kind: 'life' }, G - 400);
  b.rings(6300, G - 300, 6, 28);
  b.loop(7200, G + 100, 96);
  b.ringArc(7200, G + 100 - 96, 64, -60, 240, 12);
  b.onGround('monitor', 7700, 16, { kind: 'shoes' });
  decor(b, 'palm', [5800, 6700, 7550]);
  decor(b, 'tulip', [5760, 5980, 6150, 7650, 7700]);
  decor(b, 'totem', [6150]);

  // --- Tunnel run through a hill
  b.terrain([
    [8560, G - 40],
    [8760, G - 260],
    [9200, G - 230],
    [9380, G + 80],
  ]);
  b.carveAbove(main3, 8600, 9380, 80);
  b.onGround('beetleWheel', 8100, 14);
  b.onGround('clawTank', 8500, 16);
  b.onGround('monitor', 9150, 16, { kind: 'invincible' });
  groundRings(b, 8720, 10, 24, 28);
  b.place('waspJet', 9700, G - 20, { range: 140 });

  // --- Goal
  b.onGround('beetleWheel', 10000, 14);
  b.onGround('signpost', 10600, 48);
  groundRings(b, 10100, 6);
  decor(b, 'palm', [9900, 10400, 10900]);
  decor(b, 'sunflower', [10200, 10300, 10700, 10800]);

  b.start = { x: 96, y: G - 40 };
  return b.build();
}

export function buildPalmAct2() {
  const G = 1300;
  const b = new LevelBuilder(11264, 2048);

  // --- Opening hills and a loop
  b.terrain([
    [0, G],
    [500, G],
    [800, G - 100],
    [1000, G - 100],
    [1300, G + 20],
    [1600, G + 20],
    [1900, G + 120],
    [2600, G + 120],
    [2900, G + 40],
    [3100, G + 40, 'step'],
    [3101, G + 300],
    [4250, G + 300],
    [4800, G + 60],
    [4900, G + 60],
  ]);
  b.loop(2250, G + 120, 112);
  b.ringArc(2250, G + 120 - 112, 80, -60, 240, 14);
  groundRings(b, 250, 6);
  b.onGround('beetleWheel', 700, 14);
  b.onGround('beetleWheel', 1450, 14);
  b.onGround('monitor', 1000, 16, { kind: 'rings' }, G - 200);
  b.place('waspJet', 1700, G - 100, { range: 160 });
  decor(b, 'palm', [150, 600, 1350, 2750]);
  decor(b, 'sunflower', [380, 470, 1150, 1700, 2650]);
  decor(b, 'totem', [1560]);

  // --- Down the cliff into the lower valley; a breakable wall hides a monitor
  b.rect(3700, G + 140, 300, 40, { material: Mat.Rock });
  b.onGround('breakableWall', 3500, 32, { w: 32, h: 64 });
  b.onGround('monitor', 3560, 16, { kind: 'lightning' });
  b.onGround('clawTank', 3300, 16);
  b.onGround('clawTank', 4000, 16);
  b.onGround('spring', 4200, 8, { dir: 'up', red: true });
  groundRings(b, 3150, 5);
  groundRings(b, 3820, 6, 24, 24);
  b.onGround('starpost', 4860, 32, { id: 1 });
  decor(b, 'rock', [3250, 4050]);

  // --- Moving platforms over a spike pit
  b.terrain([
    [4900, G + 300],
    [5700, G + 300],
  ]);
  for (let x = 4930; x < 5600; x += 64) b.onGround('spikes', x, 16, { count: 8 });
  b.onGround('spring', 5665, 8, { dir: 'up', red: true });
  b.place('platform', 5050, G + 60, { w: 64, motion: 'h', range: 70, period: 200 });
  b.place('platform', 5330, G + 30, { w: 64, motion: 'v', range: 40, period: 160 });
  b.place('platform', 5580, G + 60, { w: 64, motion: 'h', range: 70, period: 200, phase: 0.5 });
  b.rings(5260, G - 20, 5, 28);

  // --- Rolling hills to a double loop
  b.terrain([
    [5700, G + 60],
    [6000, G - 40],
    [6400, G - 40],
    [6700, G + 80],
    [8100, G + 80],
    [8400, G - 20],
    [8800, G - 20],
  ]);
  b.onGround('beetleWheel', 6200, 14);
  b.place('waspJet', 6500, G - 160, { range: 120 });
  b.loop(7050, G + 80, 96);
  b.loop(7650, G + 80, 96);
  b.ringArc(7050, G + 80 - 96, 64, 0, 180, 7);
  b.ringArc(7650, G + 80 - 96, 64, 0, 180, 7);
  b.onGround('monitor', 6800, 16, { kind: 'bubble' });
  b.place('giantRing', 6200, G - 240);
  b.onGround('spring', 6100, 8, { dir: 'up' });
  decor(b, 'palm', [5900, 6600, 8200]);
  decor(b, 'tulip', [6050, 6300, 6800, 7350, 7400, 8000]);

  // --- Swing platforms, last stretch, boss arena
  b.place('swingPlatform', 8960, G - 170, { links: 5, amp: 0.9, phase: 0 });
  b.place('swingPlatform', 9160, G - 170, { links: 5, amp: 0.9, phase: 75 });
  b.terrain([
    [9300, G - 20],
    [9700, G + 60],
    [11264, G + 60],
  ]);
  b.onGround('beetleWheel', 9500, 14);
  groundRings(b, 9800, 8);
  b.onGround('monitor', 9950, 16, { kind: 'rings' });
  b.onGround('monitor', 9990, 16, { kind: 'shield' });
  // Raised ledges at both sides of the arena help reach the boss.
  b.rect(10240, G + 12, 48, 48, { material: Mat.Platform });
  b.rect(10640, G + 12, 48, 48, { material: Mat.Platform });
  b.place('bossTrigger', 10240, G + 60, { w: 448, boss: 'palmBoss' });
  b.onGround('capsule', 10950, 32);
  decor(b, 'palm', [9400, 9900, 10300, 10600, 11100]);

  b.start = { x: 96, y: G - 40 };
  return b.build();
}
