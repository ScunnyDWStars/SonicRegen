import { JUMP } from '../engine/input';
import type { CharacterDef, Player } from './Player';
import type { PlayerWorld } from './types';

/** Frames of flight before Tails gets tired (Sonic 3). */
export const FLIGHT_TIME = 480;
const FLY_GRV = 0.03125;
const FLY_UP_GRV = -0.125;

export function startFlight(p: Player, w: PlayerWorld): void {
  p.action = 'fly';
  p.abilityUsed = true;
  p.actionTimer = FLIGHT_TIME;
  p.aux = 0; // 1 while ascending
  if (p.ball) p.setBall(false);
  w.sfx('fly');
}

/** One frame of Tails' flight (also used for swimming underwater). */
export function flightStep(p: Player, w: PlayerWorld, input = true): void {
  const c = p.c;
  if (p.actionTimer > 0) p.actionTimer--;
  const canRise = p.actionTimer > 0 && p.y > w.cameraTop + 16;
  if (input && p.pad.isPressed(JUMP) && canRise && p.ysp >= -1) p.aux = 1;
  if (p.aux && (p.ysp < -1 || !canRise)) p.aux = 0;
  if (input) p.airControl(c);
  p.airMoveAndCollide(w, p.aux ? FLY_UP_GRV : FLY_GRV);
  if (p.y < w.cameraTop + 16 && p.ysp < 0) {
    p.y = w.cameraTop + 16;
    p.ysp = 0;
  }
  if (p.action === 'fly' && w.frame % (p.actionTimer > 0 ? 16 : 32) === 0) w.sfx('fly');
}

export const TAILS: CharacterDef = {
  id: 'tails',
  name: 'TAILS',
  jump: 6.5,
  standHr: 15,
  standWr: 9,
  rollHr: 14,
  rollWr: 7,
  airAbility(p, w) {
    // Tails cannot use elemental shield moves (Sonic 3 & Knuckles); he flies instead.
    startFlight(p, w);
  },
  updateAction(p, w) {
    if (p.action !== 'fly' || p.grounded) return false;
    flightStep(p, w);
    return true;
  },
};
