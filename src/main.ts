import { NullSound } from './audio/sound';
import { SCREEN_H, SCREEN_W } from './engine/constants';
import { InputManager } from './engine/input';
import { GameLoop } from './engine/loop';
import { Renderer } from './engine/renderer';
import { startAct } from './game/flow';
import { Game } from './game/game';
import type { Team } from './game/session';
import { CharacterSelect } from './scenes/character-select';
import { ZONES, zoneById } from './zones/all';
import './objects';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new InputManager();
input.attach(window);

function fit(): void {
  const scale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_W, innerHeight / SCREEN_H)));
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
}
addEventListener('resize', fit);
fit();

const sound = new NullSound();
const placeholder = { update() {}, render() {} };
const game = new Game(sound, placeholder);
const params = new URLSearchParams(location.search);
const team = params.get('team') as Team | null;
const zoneParam = zoneById(params.get('zone') ?? '');
if (zoneParam || team) {
  // Direct start for testing: ?zone=palm-coast&act=2&team=knuckles
  game.session.team = team ?? 'sonic';
  startAct(game, zoneParam ?? ZONES[0]!, Number(params.get('act') ?? 1) - 1, 0);
} else {
  game.goto(
    new CharacterSelect((g, t) => {
      g.session.resetForNewGame(t);
      startAct(g, ZONES[0]!, 0);
    }),
    0,
  );
}

if (params.has('debug')) game.debug = true;

const loop = new GameLoop({
  update() {
    input.poll();
    if (input.fnPresses.has('F1') || input.fnPresses.has('Backquote')) game.debug = !game.debug;
    if (input.fnPresses.has('F2')) loop.paused = !loop.paused;
    if (input.fnPresses.has('F3')) loop.step();
    game.keyEvents = input.keyEvents;
    game.update(input.pad);
    input.endFrame();
  },
  render() {
    game.render(renderer);
  },
});
loop.start();

// Exposed for end-to-end tests and debugging in the console.
(window as unknown as { __game: Game }).__game = game;
