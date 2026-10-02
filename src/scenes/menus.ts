import { flow, startAct } from '../game/flow';
import type { Game } from '../game/game';
import type { Options } from '../game/save';
import { writeSlot } from '../game/save';
import type { ZoneDef } from '../zones';
import { CharacterSelect } from './character-select';
import { ContinueScene } from './continue';
import { EndingScene } from './ending';
import { MessageScene } from './message';
import { OptionsScene } from './options';
import { SaveSelect } from './save-select';
import { TitleScene } from './title';
import { ZoneSelect } from './zone-select';

/** Wire the front-end scenes together and into the game flow. */
export function installMenus(opts: Options, applyOptions: (o: Options) => void): void {
  const zones = () => flow.zones;

  const toTitle = (game: Game) => game.goto(new TitleScene({ play: toSaveSelect, options: toOptions }), 30);

  const toOptions = (game: Game) => game.goto(new OptionsScene(opts, applyOptions, toTitle), 16);

  const toZoneSelect = (game: Game) =>
    game.goto(
      new ZoneSelect(
        zones(),
        (g, zi) => startAct(g, zones()[zi]!, 0),
        toSaveSelect,
        Math.min(game.session.zone, zones().length - 1),
      ),
      16,
    );

  const toSaveSelect = (game: Game) =>
    game.goto(
      new SaveSelect(
        zones().map((z) => z.name),
        {
          newGame(g, slot) {
            g.goto(
              new CharacterSelect((gg, team) => {
                gg.session.resetForNewGame(team);
                gg.session.slot = slot;
                gg.session.unlocked = 1;
                gg.onSave(gg);
                startAct(gg, zones()[0]!, 0);
              }, toSaveSelect),
              16,
            );
          },
          load(g, slot, data) {
            g.session.resetForNewGame(data.team);
            g.session.load(data);
            g.session.slot = slot;
            if (g.session.zone >= zones().length) g.session.zone = 0;
            toZoneSelect(g);
          },
          back: toTitle,
        },
      ),
      16,
    );

  flow.toTitle = toTitle;
  flow.toEnding = (game) => game.goto(new EndingScene(toTitle), 60);
  flow.toGameOver = (game: Game, zone: ZoneDef, act: number) => {
    const s = game.session;
    const gameOver = () =>
      game.goto(
        new MessageScene(
          ['GAME', 'OVER'],
          (gg) => {
            gg.onSave(gg);
            toTitle(gg);
          },
          'gameOver',
          90,
          600,
        ),
        30,
      );
    if (s.continues > 0) {
      game.goto(
        new ContinueScene(
          (g) => {
            g.session.continues--;
            g.session.lives = 3;
            startAct(g, zone, act);
          },
          () => gameOver(),
        ),
        30,
      );
    } else gameOver();
  };
}

/** Persist the session to its save slot (if it has one). */
export function saveSession(game: Game): void {
  const s = game.session;
  if (s.slot !== null) writeSlot(s.slot, s.toJSON());
}
