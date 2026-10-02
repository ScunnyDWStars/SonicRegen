import { NullSound, type Sound } from './audio/sound';
import { WebAudioSound } from './audio/webaudio';
import { SCREEN_H, SCREEN_W } from './engine/constants';
import { DEFAULT_KEYS, InputManager } from './engine/input';
import { GameLoop } from './engine/loop';
import { Renderer } from './engine/renderer';
import { flow, startAct } from './game/flow';
import { Game } from './game/game';
import { loadOptions, saveOptions, type Options } from './game/save';
import type { Team } from './game/session';
import { installMenus, saveSession } from './scenes/menus';
import { SpecialStageScene } from './scenes/special-stage';
import { ZONES, zoneById } from './zones/all';
import './objects';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new InputManager();
input.attach(window);

const params = new URLSearchParams(location.search);
let sound: Sound;
try {
  sound = params.has('mute') ? new NullSound() : new WebAudioSound();
} catch {
  sound = new NullSound();
}

const opts = loadOptions();
function applyOptions(o: Options): void {
  input.keys = o.keys ? { ...o.keys } : { ...DEFAULT_KEYS };
  sound.volumes.music = o.music / 10;
  sound.volumes.sfx = o.sfx / 10;
  sound.applyVolumes();
  fit();
  saveOptions(o);
}

function fit(): void {
  const maxScale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_W, innerHeight / SCREEN_H)));
  const scale = opts.scale > 0 ? Math.min(opts.scale, maxScale) : maxScale;
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
}
addEventListener('resize', fit);

const game = new Game(sound, { update() {}, render() {} });
game.onSave = saveSession;
installMenus(opts, applyOptions);
applyOptions(opts);

if (params.has('debug')) game.debug = true;
const team = params.get('team') as Team | null;
const zoneParam = zoneById(params.get('zone') ?? '');
if (params.has('special')) {
  // Jump straight into a special stage: ?special=3
  game.goto(new SpecialStageScene(Number(params.get('special')) || 0, 'sonic', (g) => flow.toTitle(g)), 0);
} else if (zoneParam || team) {
  // Direct start for testing: ?zone=palm-coast&act=2&team=knuckles
  game.session.team = team ?? 'sonic';
  game.session.unlocked = ZONES.length;
  startAct(game, zoneParam ?? ZONES[0]!, Number(params.get('act') ?? 1) - 1, 0);
} else {
  flow.toTitle(game);
}

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
