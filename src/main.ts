import { NullSound } from './audio/sound';
import { SCREEN_H, SCREEN_W } from './engine/constants';
import { InputManager } from './engine/input';
import { GameLoop } from './engine/loop';
import { Renderer } from './engine/renderer';
import { startAct } from './game/flow';
import { Game } from './game/game';
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
game.session.team = 'sonic';
const params = new URLSearchParams(location.search);
const zone = zoneById(params.get('zone') ?? '') ?? ZONES[0]!;
startAct(game, zone, Number(params.get('act') ?? 1) - 1, 0);

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
