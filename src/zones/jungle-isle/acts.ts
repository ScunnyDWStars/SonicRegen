import type { Act } from '../../game/act';
import { LevelBuilder, Mat, type TerrainPoint } from '../../level/builder';
import { jungleState } from './theme';

/**
 * Jungle Isle: a tropical island jungle of ziplines, coconut-throwing robots and
 * secret ledges, set ablaze halfway through — a homage to the third game's
 * opening zone.
 */

function groundRings(b: LevelBuilder, x: number, n: number, lift = 24, dx = 24, fromY = 0): void {
  for (let i = 0; i < n; i++) b.onGround('ring', x + i * dx, lift, {}, fromY);
}

/** A climbable rock pillar with a passage at its base and a ledge route on top. */
function knucklesLedge(
  b: LevelBuilder,
  ground: TerrainPoint[],
  x: number,
  x1: number,
  top: number,
  floor: number,
): void {
  b.rect(x, top, 64, floor - top + 200, { material: Mat.Rock });
  b.terrain(
    [
      [x + 64, top],
      [x1, top],
    ],
    { depth: 56, material: Mat.Ground },
  );
  b.carveAbove(ground, x - 4, x + 68, 72, Mat.Decor);
}

export function buildJungleAct1() {
  const G = 1500;
  const b = new LevelBuilder(11264, 2304);
  const main: TerrainPoint[] = [
    [0, G],
    [600, G],
    [900, G - 80],
    [1200, G - 80],
    [1500, G + 20],
    [1700, G + 20],
    [1900, G - 160],
    [2100, G - 160],
    [2300, G + 100],
    [2700, G + 100],
    [2900, G],
    [5000, G],
    [5400, G + 60],
    [6700, G + 60],
    [7000, G + 60, 'step'],
    [7001, G - 40],
    [7700, G - 40],
    [8000, G - 120],
    [8200, G - 120],
  ];
  b.terrain(main);
  b.terrain([
    [8700, G - 40],
    [9200, G - 40],
    [9500, G + 40],
    [11264, G + 40],
  ]);

  // --- Opening jungle
  groundRings(b, 220, 5);
  b.onGround('monitor', 520, 16, { kind: 'rings' });
  b.onGround('rhinoDash', 1060, 14);
  b.onGround('bloomGun', 1380, 0);
  for (const x of [320, 1100, 1650]) b.onGround('jungleTree', x, 0);

  // --- Zipline over a dip
  b.place('zipline', 2080, G - 270, { x1: 2760, y1: G - 40 });
  groundRings(b, 2350, 8, 24, 32);
  b.onGround('rhinoDash', 2500, 14);
  b.onGround('starpost', 2950, 32, { id: 1 });

  // --- Coconut grove
  for (const x of [3200, 3560]) {
    b.onGround('jungleTree', x, 0);
    b.onGround('cocoBot', x + 2, 110);
  }
  groundRings(b, 3300, 6);
  b.onGround('monitor', 3700, 16, { kind: 'bubble' });

  // --- Knuckles' ledge route (Tails can fly up too)
  knucklesLedge(b, main, 3900, 5000, G - 320, G);
  b.rings(4000, G - 350, 10, 32);
  b.onGround('monitor', 4600, 16, { kind: 'life' }, G - 400);
  b.onGround('monitor', 4700, 16, { kind: 'fire' }, G - 400);
  b.onGround('bloomGun', 4300, 0);
  b.onGround('rhinoDash', 4600, 14);

  // --- The jungle burns from here (script at x = 5300)
  b.onGround('starpost', 5700, 32, { id: 2 });
  b.onGround('rhinoDash', 6000, 14);
  b.loop(6400, G + 60, 96);
  b.ringArc(6400, G + 60 - 96, 64, -60, 240, 12);
  b.onGround('bloomGun', 6800, 0);
  // Secret cave in the cliff face behind a Knuckles-only wall, with a giant ring.
  b.onGround('spring', 6940, 8, { dir: 'up' });
  b.carveRect(7000, G - 20, 400, 80);
  b.rect(7000, G - 20, 400, 80, { material: Mat.Decor, solid: false });
  b.place('breakableWall', 7016, G + 20, { w: 32, h: 80, knucklesOnly: true });
  b.place('giantRing', 7300, G + 16);
  b.rings(7100, G + 36, 5, 36);
  b.onGround('breakableWall', 7560, 32, { w: 32, h: 64 });
  b.onGround('monitor', 7640, 16, { kind: 'lightning' });

  // --- Second zipline across a pit, with log platforms as a fallback
  b.place('zipline', 8120, G - 230, { x1: 8760, y1: G - 110 });
  b.rect(8300, G - 100, 80, 16, { material: Mat.Platform, topOnly: true });
  b.rect(8480, G - 110, 80, 16, { material: Mat.Platform, topOnly: true });
  b.place('platform', 8640, G - 90, { w: 64, motion: 'h', range: 40, period: 160 });
  b.onGround('starpost', 9100, 32, { id: 3 });
  b.onGround('rhinoDash', 9700, 14);
  b.onGround('bloomGun', 9950, 0);
  for (const x of [9400, 10200]) {
    b.onGround('jungleTree', x, 0);
    b.onGround('cocoBot', x + 2, 110);
  }
  groundRings(b, 9800, 6);
  b.onGround('signpost', 10600, 48);

  b.start = { x: 96, y: G - 40 };
  return b.build();
}

export function setupJungleAct1(act: Act): void {
  jungleState.burnt = false;
  jungleState.burnT = 0;
  let burnTimer = 0;
  // Restarting from a checkpoint past the fire keeps the jungle burnt.
  if ((act.game.session.checkpoint?.id ?? 0) >= 2) jungleState.burnt = true;
  act.scripts.push((a) => {
    if (jungleState.burnT > 0) jungleState.burnT--;
    if (!jungleState.burnt && a.leader.x > 5300) {
      // Fire-bombing run: flash, explosions, then everything is scorched.
      jungleState.burnt = true;
      jungleState.burnT = 40;
      burnTimer = 120;
      a.terrain?.clear();
      a.game.sound.music('jungleIsleFire');
      a.camera.shake = 30;
    }
    if (burnTimer > 0) {
      burnTimer--;
      if (burnTimer % 6 === 0) {
        a.effect('explosion', a.camera.x + Math.random() * 320, a.camera.y + 20 + Math.random() * 120);
        a.sfx('explode');
      }
    }
  });
}

export function buildJungleAct2() {
  const G = 1300;
  const b = new LevelBuilder(11776, 2560);
  const main: TerrainPoint[] = [
    [0, G],
    [800, G],
    [1200, G + 120],
    [1500, G + 160],
    [1800, G + 480],
    [3000, G + 480],
    [3400, G + 100],
    [5000, G + 100],
    [5100, G + 100, 'step'],
    [5101, G + 420],
    [6300, G + 420],
    [6900, G + 60],
    [7600, G + 60],
    [7900, G - 20],
    [11776, G - 20],
  ];
  b.terrain(main);
  b.waterY = G + 180;

  // --- Down into the flooded ruins
  groundRings(b, 200, 6);
  b.onGround('rhinoDash', 700, 14);
  b.onGround('bloomGun', 1100, 0);
  b.onGround('monitor', 1400, 16, { kind: 'bubble' });
  b.onGround('bubbleVent', 2000, 4);
  b.onGround('bubbleVent', 2700, 4);
  b.onGround('rhinoDash', 2300, 14);
  groundRings(b, 2100, 8, 24, 32);
  b.rect(2400, G + 300, 120, 16, { material: Mat.Platform, topOnly: true });
  b.onGround('monitor', 2450, 16, { kind: 'rings' }, G + 200);
  b.onGround('starpost', 3600, 32, { id: 1 });

  // --- Knuckles ledge above the main path
  knucklesLedge(b, main, 3800, 4900, G - 220, G + 100);
  b.rings(3900, G - 250, 8, 32);
  b.onGround('monitor', 4500, 16, { kind: 'life' }, G - 300);
  for (const x of [4100, 4500]) {
    b.onGround('jungleTree', x, 0);
    b.onGround('cocoBot', x + 2, 110);
  }

  // --- Zipline over the lake (or swim it)
  b.place('zipline', 4980, G + 10, { x1: 6250, y1: G + 120 });
  b.onGround('bubbleVent', 5600, 4);
  b.rect(5500, G + 300, 96, 16, { material: Mat.Platform, topOnly: true });
  b.place('platform', 5800, G + 260, { w: 64, motion: 'v', range: 60, period: 200 });
  b.onGround('monitor', 5700, 16, { kind: 'lightning' });
  b.onGround('bubbleVent', 6150, 4);
  b.onGround('spring', 6290, 12, { dir: 'upRight', red: true });

  // --- Burnt hills, loop and the run to the boss
  b.onGround('starpost', 6960, 32, { id: 2 });
  b.loop(7200, G + 60, 96);
  b.ringArc(7200, G + 60 - 96, 64, -60, 240, 12);
  b.onGround('bloomGun', 8200, 0);
  b.onGround('rhinoDash', 8500, 14);
  for (const x of [8800, 9200]) {
    b.onGround('jungleTree', x, 0);
    b.onGround('cocoBot', x + 2, 110);
  }
  b.onGround('breakableWall', 9500, 32, { w: 32, h: 64 });
  b.onGround('monitor', 9700, 16, { kind: 'fire' });
  b.onGround('monitor', 9740, 16, { kind: 'rings' });
  groundRings(b, 9800, 6);
  b.place('giantRing', 8000, G - 140);
  b.place('bossTrigger', 10240, G - 20, { w: 448, boss: 'jungleBoss' });
  b.onGround('capsule', 10950, 32);

  b.start = { x: 96, y: G - 40 };
  return b.build();
}

export function setupJungleAct2(): void {
  jungleState.burnt = true;
  jungleState.burnT = 0;
}
