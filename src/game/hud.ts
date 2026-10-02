import { rgb } from '../art/pixels';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import type { Renderer } from '../engine/renderer';
import { sprites, type Act } from './act';
import type { Game } from './game';

const YELLOW = rgb(252, 228, 48);
const RED = rgb(240, 32, 32);
const WHITE = rgb(255, 255, 255);

export function formatTime(frames: number): string {
  const s = Math.floor(frames / 60);
  const cs = Math.floor(((frames % 60) * 100) / 60);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"${String(cs).padStart(2, '0')}`;
}

export function drawHud(r: Renderer, act: Act, game: Game): void {
  const p = act.leader;
  const s = game.session;
  if (act.state !== 'card' || act.stateTimer > 40) {
    r.text('SCORE', 16, 9, YELLOW);
    r.text(String(s.score).padStart(7, ' '), 64, 9);
    r.text('TIME', 16, 25, YELLOW);
    r.text(formatTime(act.time), 64, 25, act.time >= 9 * 3600 && act.frame & 8 ? RED : WHITE);
    const flash = p.rings === 0 && act.frame & 16;
    r.text('RINGS', 16, 41, flash ? RED : YELLOW);
    r.text(String(p.rings).padStart(3, ' '), 72, 41);
    // Lives: the character's head, cropped from their idle frame.
    const head = r.source(sprites.frame(p.def.id, 'idle', 0));
    r.ctx.drawImage(head, 19, 3, 26, 24, 12, SCREEN_H - 30, 26, 24);
    r.text(p.def.name, 40, SCREEN_H - 26, YELLOW);
    r.text(`×${Math.min(99, s.lives)}`, 40, SCREEN_H - 17);
    // Air countdown
    if (p.underwater && p.air < 720 && p.air > 0 && !p.dead) {
      const n = Math.ceil(p.air / 120) - 1;
      r.textScaled(String(Math.max(0, n)), p.x - act.camera.rx - 8, p.y - act.camera.ry - 48, 2, WHITE);
    }
  }
  if (act.state === 'card') drawTitleCard(r, act, act.stateTimer);
  else if (act.state === 'play' && act.stateTimer < 30) drawTitleCard(r, act, 70 + act.stateTimer);
  if (act.state === 'clear' && act.results) drawResults(r, act);
  if (act.paused) r.textCentered('PAUSE', 100, YELLOW);
}

function drawTitleCard(r: Renderer, act: Act, t: number): void {
  // Slide in for 20 frames, hold, slide out from frame 70 to 100.
  const inT = Math.min(1, t / 20);
  const outT = Math.max(0, (t - 70) / 30);
  const slide = (1 - inT) * SCREEN_W + outT * SCREEN_W;
  const bandSlide = (1 - inT) * -SCREEN_W - outT * SCREEN_W;
  if (t < 70) r.fade(Math.min(1, 1 - (t - 10) / 30) * 1);
  // Blue band from the left
  r.rect(bandSlide, 0, 96, SCREEN_H, rgb(16, 48, 168));
  r.rect(bandSlide + 96, 0, 6, SCREEN_H, YELLOW);
  r.rect(bandSlide + 102, 0, 4, SCREEN_H, RED);
  const name = act.zone.name;
  const nx = SCREEN_W - name.length * 16 - 24 + slide;
  r.textScaled(name, nx, 72, 2, WHITE);
  r.textScaled('ZONE', SCREEN_W - 4 * 16 - 24 + slide * 1.3, 96, 2, WHITE);
  r.rect(SCREEN_W - 72 + slide * 1.6, 124, 40, 32, YELLOW);
  r.textScaled(String(act.actIndex + 1), SCREEN_W - 60 + slide * 1.6, 128, 3, RED);
  r.text(act.zone.game, bandSlide + 8, SCREEN_H - 20, YELLOW);
}

function drawResults(r: Renderer, act: Act): void {
  const res = act.results!;
  const t = act.stateTimer;
  const slide = Math.max(0, 1 - t / 40) * SCREEN_W;
  const name = act.leader.def.name;
  r.textScaled(`${name} GOT`, 40 + slide, 52, 2, YELLOW);
  r.textScaled('THROUGH', 64 - slide, 72, 2, WHITE);
  r.textScaled(`ACT ${act.actIndex + 1}`, 112 + slide, 92, 2, WHITE);
  if (t < 60) return;
  r.text('TIME BONUS', 64, 128, YELLOW);
  r.text(String(res.timeBonus).padStart(6, ' '), 200, 128);
  r.text('RING BONUS', 64, 144, YELLOW);
  r.text(String(res.ringBonus).padStart(6, ' '), 200, 144);
  r.text('TOTAL', 64, 168, YELLOW);
  r.text(String(res.total).padStart(6, ' '), 200, 168);
}
