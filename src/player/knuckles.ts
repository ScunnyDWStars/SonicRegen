import { Btn, JUMP } from '../engine/input';
import { DOWN, LEFT, RIGHT, UP } from '../level/collision';
import type { CharacterDef, Player } from './Player';
import { shieldAbility } from './sonic';
import type { PlayerWorld } from './types';

const GLIDE_START = 4;
const GLIDE_ACCEL = 0.015625;
const GLIDE_MAX = 24;
const GLIDE_TURN = 5.625; // degrees per frame
const SLIDE_FRICTION = 0.125;
const CLIMB_SPEED = 1;

function startGlide(p: Player, w: PlayerWorld): void {
  p.action = 'glide';
  p.abilityUsed = true;
  p.aux = GLIDE_START; // glide speed
  p.aux2 = p.facing > 0 ? 0 : 180; // glide direction angle
  if (p.ysp < 0) p.ysp = 0;
  p.xsp = GLIDE_START * p.facing;
  w.sfx('glide');
}

function glideStep(p: Player, w: PlayerWorld): void {
  if (!p.pad.isHeld(JUMP)) {
    // Let go: drop.
    p.action = 'glideFall';
    p.xsp *= 0.25;
    if (p.ball) p.setBall(false);
    return;
  }
  // Turning sweeps the glide angle around; speed builds only when not turning.
  const want = p.pad.isHeld(Btn.Left) ? 180 : p.pad.isHeld(Btn.Right) ? 0 : p.aux2 < 90 ? 0 : 180;
  if (Math.abs(p.aux2 - want) > 0.01) {
    p.aux2 += Math.sign(want - p.aux2) * Math.min(GLIDE_TURN, Math.abs(want - p.aux2));
  } else if (p.aux < GLIDE_MAX) {
    p.aux = Math.min(GLIDE_MAX, p.aux + GLIDE_ACCEL);
  }
  const cos = Math.cos((p.aux2 * Math.PI) / 180);
  p.xsp = p.aux * cos;
  if (Math.abs(cos) > 0.1) p.facing = cos > 0 ? 1 : -1;
  // Glide gravity pulls the fall speed toward 0.5.
  const grv = p.ysp < 0.5 ? 0.125 : -0.125;
  p.airMoveAndCollide(w, grv);
}

function slideStep(p: Player, w: PlayerWorld): void {
  p.gsp -= Math.min(Math.abs(p.gsp), SLIDE_FRICTION) * Math.sign(p.gsp);
  if (p.gsp === 0 || !p.pad.isHeld(JUMP)) {
    p.action = 'normal';
    p.gsp = Math.sign(p.gsp) * Math.min(Math.abs(p.gsp), 1);
  }
  p.groundMove(w);
}

/** Wall distance on the side Knuckles is facing, at a vertical offset from his centre. */
function wallDist(p: Player, w: PlayerWorld, dy: number): number {
  return w.col.dist(p.x + p.facing * 10, p.y + dy, p.facing > 0 ? RIGHT : LEFT, p.layer, false);
}

function climbStep(p: Player, w: PlayerWorld): void {
  p.xsp = p.ysp = p.gsp = 0;
  if (p.pad.isPressed(JUMP)) {
    // Kick off the wall.
    p.facing = p.facing > 0 ? -1 : 1;
    p.xsp = 4 * p.facing;
    p.ysp = -4;
    p.action = 'jump';
    p.jumping = true;
    p.abilityUsed = false;
    p.setBall(true);
    w.sfx('jump');
    return;
  }
  const up = p.pad.isHeld(Btn.Up),
    down = p.pad.isHeld(Btn.Down);
  if (up) {
    const ceil = w.col.dist(p.x, p.y - p.hr, UP, p.layer, false);
    if (ceil > 0) p.y -= CLIMB_SPEED;
  } else if (down) {
    p.y += CLIMB_SPEED;
  }
  if (up || down) p.animTimer++;
  // Reached the top of the wall: climb over the ledge.
  if (wallDist(p, w, -p.hr + 2) > 1) {
    p.action = 'ledgeClimb';
    p.actionTimer = 16;
    return;
  }
  // Bottom of the wall: stand on the floor, or fall if the wall ends.
  const floor = w.col.dist(p.x, p.y + p.hr, DOWN, p.layer, true);
  if (floor <= 0) {
    p.y += floor;
    p.action = 'normal';
    p.grounded = true;
    p.angle = 0;
    return;
  }
  if (wallDist(p, w, p.hr - 4) > 1) {
    p.action = 'glideFall';
    p.grounded = false;
  }
}

function ledgeStep(p: Player, w: PlayerWorld): void {
  p.xsp = p.ysp = 0;
  if (--p.actionTimer > 0) return;
  // Move onto the top of the ledge.
  const nx = p.x + p.facing * 20;
  let top = p.y - p.hr - 8;
  const d = w.col.dist(nx, top, DOWN, p.layer, true);
  if (d < 32) top += d;
  p.x = nx;
  p.y = top - p.hr;
  p.action = 'normal';
  p.grounded = true;
  p.angle = 0;
  p.gsp = 0;
}

export const KNUCKLES: CharacterDef = {
  id: 'knuckles',
  name: 'KNUCKLES',
  jump: 6,
  standHr: 19,
  standWr: 9,
  rollHr: 14,
  rollWr: 7,
  airAbility(p, w) {
    if (shieldAbility(p, w)) return;
    startGlide(p, w);
  },
  updateAction(p, w) {
    switch (p.action) {
      case 'glide':
        glideStep(p, w);
        return true;
      case 'slide':
        if (!p.grounded) {
          p.action = 'glideFall';
          return false;
        }
        slideStep(p, w);
        return true;
      case 'climb':
        climbStep(p, w);
        return true;
      case 'ledgeClimb':
        ledgeStep(p, w);
        return true;
      default:
        return false;
    }
  },
  onAirWall(p, w, side) {
    if (p.action !== 'glide' || side !== p.facing) return;
    p.action = 'climb';
    if (p.ball) p.setBall(false);
    p.xsp = p.ysp = 0;
    w.sfx('grab');
  },
};
