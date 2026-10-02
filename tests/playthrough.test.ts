import { describe, expect, it } from 'vitest';
import { Act } from '../src/game/act';
import { SpecialStageScene } from '../src/scenes/special-stage';
import { ZONES } from '../src/zones/all';
import { frames, playAct } from './act-helpers';
import { Bot } from './bot';

/**
 * Plays every act from start to finish with the autopilot. The bot is made
 * invincible so the test checks that each act's route is completable (pits,
 * walls, platforms, water, tubes, bosses), not how hard the enemies are.
 * Special stages entered along the way are skipped (failed on purpose).
 */
describe.each(ZONES.flatMap((z) => z.acts.map((_, i) => [`${z.name} act ${i + 1}`, z, i] as const)))(
  '%s',
  (_name, zone, actIndex) => {
    it('can be played through to the end', { timeout: 60_000 }, () => {
      const { game, act } = playAct(zone, 'sonic', actIndex);
      let a: Act = act;
      let bot = new Bot(a);
      let cleared = false;
      for (let f = 0; f < 60 * 60 * 6 && !cleared; f++) {
        if (game.scene instanceof SpecialStageScene) {
          game.scene.logic.state = 'fail';
          frames(game, 1);
          continue;
        }
        if (game.scene !== a) {
          if (!(game.scene instanceof Act)) {
            frames(game, 1);
            continue;
          }
          a = game.scene;
          bot = new Bot(a);
        }
        if (a.state === 'play') a.leader.invincible = 600;
        frames(game, 1, bot.next());
        cleared = a.state === 'clear';
      }
      expect(cleared).toBe(true);
      expect(game.session.lives).toBeGreaterThan(0);
    });
  },
);
