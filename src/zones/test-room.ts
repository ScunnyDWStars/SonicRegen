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
