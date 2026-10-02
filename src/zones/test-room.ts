import { LevelBuilder, Mat } from '../level/builder';
import { PALM_COAST } from './palm-coast/theme';
import type { ZoneDef } from './index';

/** A playground for checking physics: slopes, a loop, walls, ceilings and pipes. */
function buildTestRoom() {
  const G = 800;
  const b = new LevelBuilder(7000, 1200);
  b.terrain([
    [0, G],
    [600, G],
    [900, G - 120],
    [1200, G - 40],
    [1500, G],
    [2600, G, 'linear'],
    [2700, G],
    [3000, G - 160, 'linear'],
    [3200, G - 160],
    [3500, G - 160],
    [3800, G],
    [7000, G],
  ]);
  b.loop(2100, G, 112);
  // A wall and a ledge
  b.rect(4100, G - 64, 48, 64, { material: Mat.Rock });
  // Low ceiling tunnel
  b.rect(4400, G - 120, 400, 70, { material: Mat.Rock });
  // Floating semi-solid platforms
  b.rect(4900, G - 90, 96, 12, { material: Mat.Platform, topOnly: true });
  b.rect(5050, G - 160, 96, 12, { material: Mat.Platform, topOnly: true });
  // Half pipe
  b.quarterPipe(5600, G, 160, -1);
  b.quarterPipe(6200, G, 160, 1);
  b.rect(6360, 0, 640, G, { material: Mat.Rock });
  b.rings(300, G - 40, 6);
  const kinds = ['rings', 'shield', 'fire', 'bubble', 'lightning', 'invincible', 'shoes', 'life'];
  kinds.forEach((kind, i) => b.onGround('monitor', 1560 + i * 40, 16, { kind }));
  b.onGround('starpost', 1530, 32, { id: 1 });
  b.onGround('spring', 4000, 8, { dir: 'up' });
  b.onGround('spring', 4060, 8, { dir: 'up', red: true });
  b.onGround('spring', 4250, 16, { dir: 'left' });
  b.onGround('spikes', 4320, 16, { count: 4 });
  b.place('platform', 5300, G - 200, { w: 64, motion: 'h', range: 64 });
  b.place('platform', 5450, G - 260, { w: 64, motion: 'fall' });
  b.place('collapsingLedge', 4880, G - 220, { w: 96, h: 24 });
  b.onGround('breakableWall', 3400, 32, { w: 32, h: 64 });
  b.place('giantRing', 3300, G - 260);
  b.onGround('signpost', 6000, 48);
  b.ringArc(2100, G - 112, 80, 0, 360, 12);
  b.start = { x: 128, y: G - 40 };
  return b.build();
}

export const TEST_ZONE: ZoneDef = {
  id: 'test',
  name: 'TEST ROOM',
  game: 'SONIC 1',
  theme: PALM_COAST,
  acts: [{ build: buildTestRoom }],
};
