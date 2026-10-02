import { NullSound } from '../src/audio/sound';
import { Btn, Pad } from '../src/engine/input';
import { Act } from '../src/game/act';
import { hooks } from '../src/game/flow';
import { Game } from '../src/game/game';
import type { Team } from '../src/game/session';
import { LevelBuilder } from '../src/level/builder';
import '../src/objects';
import type { ZoneDef } from '../src/zones';
import { PALM_COAST } from '../src/zones/palm-coast/theme';

export { Btn };

export const G = 600;

/** A flat level, customised by `fn`, wrapped in a one-act zone. */
export function flatZone(fn: (b: LevelBuilder) => void, width = 4000): ZoneDef {
  return {
    id: 'unit',
    name: 'UNIT',
    game: 'SONIC 1',
    theme: PALM_COAST,
    acts: [
      {
        build() {
          const b = new LevelBuilder(width, 1024);
          b.terrain([
            [0, G],
            [width, G],
          ]);
          b.start = { x: 100, y: G - 20 };
          fn(b);
          return b.build();
        },
      },
    ],
  };
}

/** Creates a headless game playing `zone` (title card skipped). */
export function playAct(zone: ZoneDef, team: Team = 'sonic', act = 0) {
  const sound = new NullSound();
  const game = new Game(sound, { update() {}, render() {} });
  game.session.team = team;
  const a = new Act(game, zone, act, hooks);
  game.goto(a, 0);
  a.state = 'play';
  // Let the player drop onto the ground first.
  frames(game, 10);
  return { game, act: a, sound };
}

/** Run frames with a held-button mask (or function of frame index). */
const pads = new WeakMap<Game, Pad>();

export function frames(game: Game, n: number, held: number | ((f: number) => number) = 0): void {
  let pad = pads.get(game);
  if (!pad) pads.set(game, (pad = new Pad()));
  for (let f = 0; f < n; f++) {
    pad.latch(typeof held === 'function' ? held(f) : held);
    game.update(pad);
  }
}

/** Hold right at top speed and press jump once the leader passes `jumpAt` (if given). */
export function runRight(game: Game, n: number, jumpAt = Infinity): void {
  const act = game.scene as Act;
  act.leader.gsp = Math.max(act.leader.gsp, 6);
  let jumped = false;
  frames(game, n, () => {
    if (!jumped && act.leader.x >= jumpAt && act.leader.grounded) {
      jumped = true;
      return Btn.Right | Btn.A;
    }
    return jumped ? Btn.Right | Btn.A : Btn.Right;
  });
}

/** Drop the leader from above onto (x, y). */
export function dropAt(game: Game, x: number, y: number): void {
  const p = (game.scene as Act).leader;
  p.x = x;
  p.y = y;
  p.xsp = p.ysp = p.gsp = 0;
  p.grounded = false;
  p.onObject = null;
}
