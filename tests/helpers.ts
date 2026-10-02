import { Pad, Btn } from '../src/engine/input';
import { CollisionView } from '../src/level/collision';
import type { LevelData } from '../src/level/builder';
import { Player, type CharacterDef } from '../src/player/Player';
import type { PlayerWorld, Sfx } from '../src/player/types';
import { SONIC } from '../src/player/sonic';

export { Btn };

/** Minimal world for running the player physics without the full game. */
export class SimWorld implements PlayerWorld {
  col: CollisionView;
  waterY: number;
  boundLeft = 0;
  boundRight: number;
  boundBottom: number;
  cameraTop = 0;
  frame = 0;
  sounds: Sfx[] = [];
  scattered = 0;
  constructor(public level: LevelData) {
    this.col = new CollisionView(level.map);
    this.waterY = level.waterY;
    this.boundRight = level.width;
    this.boundBottom = level.bottom;
  }
  sfx(s: Sfx): void {
    this.sounds.push(s);
  }
  scatterRings(_x: number, _y: number, n: number): void {
    this.scattered += n;
  }
  effect(): void {}
}

export function makePlayer(level: LevelData, def: CharacterDef = SONIC, x?: number, y?: number): Player {
  const p = new Player(def, x ?? level.start.x, y ?? level.start.y);
  return p;
}

/** Runs `frames` frames holding `held` (a Btn mask, or a function of the frame number). */
export function run(
  p: Player,
  w: SimWorld,
  frames: number,
  held: number | ((f: number) => number) = 0,
  each?: (f: number) => void,
): void {
  const pad = new Pad();
  for (let f = 0; f < frames; f++) {
    pad.latch(typeof held === 'function' ? held(f) : held);
    w.frame++;
    p.update(pad, w);
    applySwappers(p, w);
    each?.(f);
  }
}

/** Path swappers, as the real game applies them. */
let lastX = new WeakMap<Player, number>();
export function applySwappers(p: Player, w: SimWorld): void {
  const px = lastX.get(p) ?? p.x;
  for (const s of w.level.swappers) {
    if (p.y < s.y0 || p.y > s.y1) continue;
    if (px < s.x && p.x >= s.x) p.layer = 0;
    else if (px >= s.x && p.x < s.x) p.layer = 1;
  }
  lastX.set(p, p.x);
}
export function resetSwapperState(): void {
  lastX = new WeakMap();
}
