import { Pad } from '../engine/input';
import { MessageScene } from '../scenes/message';
import { SpecialStageScene } from '../scenes/special-stage';
import { CHARACTERS } from '../player/characters';
import { makeSidekick } from '../player/sidekick';
import type { ZoneDef } from '../zones';
import { Act, type ActHooks } from './act';
import type { Game } from './game';

/**
 * Glue between scenes: which act comes next, what happens on death and game over.
 * Scenes that need it (title, menus, special stage) register themselves here to
 * avoid import cycles.
 */
export const flow = {
  zones: [] as ZoneDef[],
  /** Show the title screen. */
  toTitle: (game: Game): void => {
    void game;
  },
  /** Enter the special stage for the next missing emerald. */
  toSpecialStage: (game: Game): void => {
    void game;
  },
  /** Ending after the last zone. */
  toEnding: (game: Game): void => {
    flow.toTitle(game);
  },
  /** Sidekick AI factory (registered by the Tails module). */
  sidekick: makeSidekick as ActHooks['makeSidekickPad'],
};

export const hooks: ActHooks = {
  characterDef: (id) => CHARACTERS[id],
  makeSidekickPad: (act, p) => (flow.sidekick ? flow.sidekick(act, p) : () => new Pad()),
  onDeath(act) {
    const g = act.game;
    const s = g.session;
    s.lives--;
    if (s.lives > 0) {
      const timeOver = act.time >= 9 * 3600 + 59 * 60 + 59;
      if (timeOver) {
        s.checkpoint = null;
        g.goto(
          new MessageScene(
            ['TIME', 'OVER'],
            (gg) => restartAct(gg, act.zone, act.actIndex),
            'gameOver',
            60,
            400,
          ),
        );
      } else {
        restartAct(g, act.zone, act.actIndex);
      }
    } else {
      s.checkpoint = null;
      g.goto(
        new MessageScene(
          ['GAME', 'OVER'],
          (gg) => {
            gg.onSave(gg);
            flow.toTitle(gg);
          },
          'gameOver',
          90,
          600,
        ),
        30,
      );
    }
  },
  onCleared(act) {
    const g = act.game;
    const s = g.session;
    s.checkpoint = null;
    s.usedGiantRings.clear();
    const zi = flow.zones.indexOf(act.zone);
    if (act.actIndex + 1 < act.zone.acts.length) {
      startAct(g, act.zone, act.actIndex + 1);
      return;
    }
    if (zi < 0) {
      // Test room or unknown zone: just replay it.
      startAct(g, act.zone, 0);
      return;
    }
    s.unlocked = Math.max(s.unlocked, Math.min(flow.zones.length, zi + 2));
    s.zone = zi + 1;
    g.onSave(g);
    if (zi + 1 < flow.zones.length) startAct(g, flow.zones[zi + 1]!, 0);
    else flow.toEnding(g);
  },
  onGiantRing(act) {
    const g = act.game;
    const p = act.leader;
    g.session.returnState = { x: p.x, y: p.y - 8, rings: p.rings, time: act.time, layer: p.layer };
    flow.toSpecialStage(g);
  },
};

/** Enter the special stage for the next missing emerald, then return to the act. */
export function enterSpecialStage(game: Game): void {
  const s = game.session;
  const idx = s.nextSpecialStage;
  const zone = flow.zones[s.zone];
  const team = s.team;
  const charId = team === 'tails' ? 'tails' : team === 'knuckles' ? 'knuckles' : 'sonic';
  game.goto(
    new SpecialStageScene(idx, charId, (g, won, rings) => {
      if (won) s.emeralds |= 1 << idx;
      if (rings > 0) g.session.addScore(rings * 100);
      g.onSave(g);
      if (zone) g.goto(new Act(g, zone, s.act, hooks), 30);
      else flow.toTitle(g);
    }),
    40,
  );
}
flow.toSpecialStage = enterSpecialStage;

export function startAct(game: Game, zone: ZoneDef, actIndex: number, fade = 24): void {
  const zi = flow.zones.indexOf(zone);
  if (zi >= 0) game.session.zone = zi;
  game.session.act = actIndex;
  game.session.checkpoint = null;
  game.session.usedGiantRings.clear();
  game.goto(new Act(game, zone, actIndex, hooks), fade);
}

/** Restart after a death, keeping the checkpoint. */
export function restartAct(game: Game, zone: ZoneDef, actIndex: number): void {
  game.goto(new Act(game, zone, actIndex, hooks), 24);
}
