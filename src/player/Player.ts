import { Btn, JUMP, Pad } from '../engine/input';
import { angleDiff, DOWN, LEFT, normAngle, RIGHT, UP, type Dir, type SensorHit } from '../level/collision';
import {
  CONTROL_LOCK_FRAMES,
  FALL_SPEED_THRESHOLD,
  HURT_GRV,
  MAX_FALL,
  physicsFor,
  PUSH_RADIUS,
  ROLL_TOP,
  SLP,
  SLP_ROLL_DOWN,
  SLP_ROLL_UP,
  type PhysicsConsts,
} from '../physics/constants';
import type { CharId, PlayerWorld, ShieldType, SolidRef } from './types';

export type Action =
  | 'normal'
  | 'roll'
  | 'jump'
  | 'spindash'
  | 'hurt'
  | 'dead'
  | 'drown'
  | 'spring'
  | 'fly'
  | 'glide'
  | 'glideFall'
  | 'slide'
  | 'climb'
  | 'ledgeClimb'
  | 'carried'
  | 'bubbleBounce'
  | 'victory'
  | 'frozen';

/** Ground mode, chosen from the ground angle. */
export const enum Mode {
  Floor = 0,
  RightWall = 1,
  Ceiling = 2,
  LeftWall = 3,
}

export function modeOf(angle: number): Mode {
  const a = normAngle(angle);
  if (a <= 45 || a >= 315) return Mode.Floor;
  if (a < 135) return Mode.RightWall;
  if (a <= 225) return Mode.Ceiling;
  return Mode.LeftWall;
}

const MODE_DOWN: readonly Dir[] = [DOWN, RIGHT, UP, LEFT];
const MODE_RIGHT: readonly Dir[] = [RIGHT, UP, LEFT, DOWN];

/** Rotates a floor-mode local offset (x right, y down) into world space for mode m. */
function rot(m: Mode, lx: number, ly: number): [number, number] {
  switch (m) {
    case Mode.Floor:
      return [lx, ly];
    case Mode.RightWall:
      return [ly, -lx];
    case Mode.Ceiling:
      return [-lx, -ly];
    case Mode.LeftWall:
      return [-ly, lx];
  }
}

const D2R = Math.PI / 180;
const sinD = (a: number) => Math.sin(a * D2R);
const cosD = (a: number) => Math.cos(a * D2R);

/** Per-character tuning and ability hooks. */
export interface CharacterDef {
  id: CharId;
  name: string;
  jump: number;
  standHr: number;
  standWr: number;
  rollHr: number;
  rollWr: number;
  /** Jump pressed again in mid-air after a jump. */
  airAbility(p: Player, w: PlayerWorld): void;
  /** Runs for character-specific actions (fly, glide, climb...). Return true if handled. */
  updateAction?(p: Player, w: PlayerWorld): boolean;
  /** Airborne wall contact (Knuckles grabs walls while gliding). */
  onAirWall?(p: Player, w: PlayerWorld, side: -1 | 1): void;
}

export interface SensorDebug {
  x: number;
  y: number;
  dir: Dir;
  hit: SensorHit;
}

export class Player {
  // ---- physics state ----
  x = 0;
  y = 0;
  xsp = 0;
  ysp = 0;
  gsp = 0;
  /** Ground angle, degrees counter-clockwise (0 = flat). */
  angle = 0;
  grounded = true;
  /** Collision path: 0 = A, 1 = B. */
  layer = 0;
  facing: 1 | -1 = 1;
  hr: number;
  wr: number;
  /** Curled into a ball (rolling, jumping, spindashing). */
  ball = false;
  action: Action = 'normal';
  controlLock = 0;
  /** Airborne because of a jump (enables variable height and abilities). */
  jumping = false;
  abilityUsed = false;
  spinrev = 0;
  pushing = false;
  skidding = false;
  crouching = false;
  lookingUp = false;
  /** Rolling is forced (tubes): speed cannot drop to zero. */
  forceRoll = false;
  onObject: SolidRef | null = null;
  /** Generic timer for the current action (ability durations etc.). */
  actionTimer = 0;
  /** Character-specific numeric state (e.g. flight gravity, glide turn). */
  aux = 0;
  aux2 = 0;

  // ---- status ----
  rings = 0;
  shield: ShieldType | null = null;
  invincible = 0;
  speedShoes = 0;
  /** Post-hit invulnerability (flashing). */
  invuln = 0;
  superForm = false;
  superRingTimer = 0;
  canGoSuper = false;
  underwater = false;
  air = 1800;
  /** Frames the instant shield hitbox stays active. */
  instaShield = 0;
  /** Horizontal camera lag after a spindash release. */
  cameraLag = 0;
  /** Set when an attack (ball, glide, invincibility) should hurt enemies. */
  get attacking(): boolean {
    return (
      this.ball ||
      this.invincible > 0 ||
      this.superForm ||
      this.action === 'glide' ||
      this.action === 'slide' ||
      this.instaShield > 0
    );
  }
  get dead(): boolean {
    return this.action === 'dead' || this.action === 'drown';
  }
  /** Ignore input (cutscenes, results). */
  frozenInput = false;

  // ---- animation ----
  anim = 'idle';
  animFrame = 0;
  animTimer = 0;
  idleTimer = 0;
  /** Sprite display angle (degrees) — smoothed in the air. */
  drawAngle = 0;
  deathTimer = 0;

  readonly pad = new Pad();
  /** Last frame's sensors, for the debug overlay. */
  readonly debugSensors: SensorDebug[] = [];
  c: PhysicsConsts;

  constructor(
    public def: CharacterDef,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.hr = def.standHr;
    this.wr = def.standWr;
    this.c = this.consts();
  }

  consts(): PhysicsConsts {
    return physicsFor({
      underwater: this.underwater,
      superForm: this.superForm,
      speedShoes: this.speedShoes > 0,
      jump: this.def.jump,
    });
  }

  get mode(): Mode {
    return this.grounded ? modeOf(this.angle) : Mode.Floor;
  }

  // ======================================================================
  // Frame update
  // ======================================================================

  update(input: Pad, w: PlayerWorld): void {
    if (this.frozenInput) this.pad.clear();
    else this.pad.copyFrom(input);
    this.debugSensors.length = 0;
    this.c = this.consts();

    if (this.action === 'dead' || this.action === 'drown') {
      this.updateDead(w);
      this.animate();
      return;
    }

    if (this.def.updateAction?.(this, w)) {
      // character-specific action handled the frame
    } else if (this.action === 'hurt') {
      this.hurtStep(w);
    } else if (this.grounded) {
      if (this.action === 'spindash') this.spindashStep(w);
      else if (this.ball) this.rollStep(w);
      else this.groundStep(w);
    } else {
      this.airStep(w);
    }

    this.updateWater(w);
    this.updateTimers(w);
    this.animate();
  }

  // ---------------------------------------------------------------- ground

  private groundStep(w: PlayerWorld): void {
    const c = this.c;
    const pad = this.pad;
    this.lookingUp = false;
    // Crouch / spindash
    this.crouching = this.onFlatEnough() && Math.abs(this.gsp) < 0.5 && pad.isHeld(Btn.Down);
    if (this.crouching && pad.isPressed(JUMP)) {
      this.startSpindash(w);
      return;
    }
    if (!this.crouching && pad.isPressed(JUMP) && this.canJump(w)) {
      this.jump(w);
      return;
    }
    this.applySlope(SLP);
    this.groundInput(c, w);
    // Roll
    if (
      pad.isHeld(Btn.Down) &&
      !pad.isHeld(Btn.Left | Btn.Right) &&
      Math.abs(this.gsp) >= 1.03125 &&
      this.controlLock === 0
    ) {
      this.setBall(true);
      this.action = 'roll';
      w.sfx('roll');
    }
    if (Math.abs(this.gsp) < 0.5 && pad.isHeld(Btn.Up) && !this.crouching && this.onFlatEnough()) {
      this.lookingUp = true;
    }
    this.groundMove(w);
  }

  private onFlatEnough(): boolean {
    return angleDiff(this.angle, 0) < 23 && this.grounded;
  }

  private groundInput(c: PhysicsConsts, w: PlayerWorld): void {
    const pad = this.pad;
    this.skidding = false;
    if (this.crouching) {
      this.gsp -= Math.min(Math.abs(this.gsp), c.frc) * Math.sign(this.gsp);
      return;
    }
    const left = pad.isHeld(Btn.Left) && this.controlLock === 0;
    const right = pad.isHeld(Btn.Right) && this.controlLock === 0;
    if (left) {
      if (this.gsp > 0) {
        this.gsp -= c.dec;
        if (this.gsp <= 0) this.gsp = -0.5;
        this.markSkid(w);
      } else if (this.gsp > -c.top) {
        this.gsp -= c.acc;
        if (this.gsp <= -c.top) this.gsp = -c.top;
      }
    }
    if (right) {
      if (this.gsp < 0) {
        this.gsp += c.dec;
        if (this.gsp >= 0) this.gsp = 0.5;
        this.markSkid(w);
      } else if (this.gsp < c.top) {
        this.gsp += c.acc;
        if (this.gsp >= c.top) this.gsp = c.top;
      }
    }
    if (!left && !right) this.gsp -= Math.min(Math.abs(this.gsp), c.frc) * Math.sign(this.gsp);
    if (this.gsp > 0 && right) this.facing = 1;
    else if (this.gsp < 0 && left) this.facing = -1;
    else if (this.gsp === 0 || Math.abs(this.gsp) < 0.5) {
      if (right) this.facing = 1;
      if (left) this.facing = -1;
    }
  }

  private markSkid(w: PlayerWorld): void {
    if (Math.abs(this.gsp) >= 4 && modeOf(this.angle) === Mode.Floor) {
      if (this.anim !== 'skid') w.sfx('skid');
      this.skidding = true;
    }
  }

  private applySlope(factor: number): void {
    const s = factor * sinD(this.angle);
    // Sonic 3 behaviour: slopes do not move a standing player on gentle ground.
    if (this.gsp !== 0 || Math.abs(s) >= 0.05078125) this.gsp -= s;
  }

  private rollStep(w: PlayerWorld): void {
    const c = this.c;
    const pad = this.pad;
    this.crouching = this.lookingUp = this.skidding = false;
    if (pad.isPressed(JUMP) && this.canJump(w)) {
      this.jump(w);
      return;
    }
    // Rolling slope factor: weaker uphill, stronger downhill.
    const uphill = Math.sign(this.gsp) === Math.sign(sinD(this.angle));
    this.applySlope(uphill ? SLP_ROLL_UP : SLP_ROLL_DOWN);
    if (this.controlLock === 0) {
      if (pad.isHeld(Btn.Left) && this.gsp > 0) this.gsp = Math.max(0, this.gsp - c.rollDec);
      if (pad.isHeld(Btn.Right) && this.gsp < 0) this.gsp = Math.min(0, this.gsp + c.rollDec);
    }
    this.gsp -= Math.min(Math.abs(this.gsp), c.rollFrc) * Math.sign(this.gsp);
    if (this.forceRoll) {
      if (Math.abs(this.gsp) < 2) this.gsp = (this.facing || 1) * 4;
    } else if (Math.abs(this.gsp) < 0.5) {
      this.setBall(false);
      this.action = 'normal';
    }
    this.gsp = Math.max(-ROLL_TOP, Math.min(ROLL_TOP, this.gsp));
    if (this.gsp > 0) this.facing = 1;
    else if (this.gsp < 0) this.facing = -1;
    this.groundMove(w);
  }

  private startSpindash(w: PlayerWorld): void {
    this.action = 'spindash';
    this.spinrev = 0;
    this.gsp = 0;
    this.setBall(true);
    w.sfx('spindash');
  }

  private spindashStep(w: PlayerWorld): void {
    const pad = this.pad;
    this.spinrev -= Math.trunc(this.spinrev / 0.125) / 256;
    if (pad.isPressed(JUMP)) {
      this.spinrev = Math.min(8, this.spinrev + 2);
      w.sfx('spindash');
    }
    if (!pad.isHeld(Btn.Down)) {
      const base = this.superForm ? 11 : 8;
      this.gsp = (base + Math.floor(this.spinrev) / 2) * this.facing;
      this.cameraLag = Math.max(0, 24 - Math.floor(this.spinrev * 2));
      this.action = 'roll';
      w.sfx('release');
      this.groundMove(w);
      return;
    }
    this.gsp = 0;
    this.groundMove(w);
  }

  /** Steps 7-12 of the grounded update: bounds, speed split, walls, move, floor, slipping. */
  private groundMove(w: PlayerWorld): void {
    this.xsp = this.gsp * cosD(this.angle);
    this.ysp = this.gsp * -sinD(this.angle);
    this.applyBounds(w);
    this.pushCollision(w);
    this.x += this.xsp;
    this.y += this.ysp;
    if (this.onObject) {
      if (!this.followObject()) this.leaveGround();
    } else {
      this.floorCollision(w);
    }
    if (this.grounded && !this.onObject) this.slipCheck();
    if (this.grounded && this.controlLock > 0) this.controlLock--;
  }

  private applyBounds(w: PlayerWorld): void {
    const nx = this.x + this.xsp;
    if (nx < w.boundLeft + 16) {
      this.x = w.boundLeft + 16;
      this.xsp = this.gsp = 0;
    } else if (nx > w.boundRight - 24) {
      this.x = w.boundRight - 24;
      this.xsp = this.gsp = 0;
    }
  }

  /** Grounded wall sensors, cast ahead using next frame's position. */
  private pushCollision(w: PlayerWorld): void {
    this.pushing = false;
    const a = normAngle(this.angle);
    if (!(a <= 90 || a >= 270) || this.gsp === 0) return;
    const m = modeOf(this.angle);
    const right = this.gsp > 0;
    const yOff = m === Mode.Floor && a === 0 ? 8 : 0;
    const [ox, oy] = rot(m, right ? PUSH_RADIUS : -PUSH_RADIUS, yOff);
    const d = right ? MODE_RIGHT[m]! : opposite(MODE_RIGHT[m]!);
    const sx = this.x + this.xsp + ox,
      sy = this.y + this.ysp + oy;
    const dist = w.col.dist(sx, sy, d, this.layer, false);
    this.debugSensors.push({ x: sx, y: sy, dir: d, hit: { dist, angle: 0, found: dist < 32 } });
    if (dist < 0) {
      this.xsp += d.dx * dist;
      this.ysp += d.dy * dist;
      this.gsp = 0;
    }
    if (dist <= 0 && this.pad.isHeld(right ? Btn.Right : Btn.Left) && !this.ball) this.pushing = true;
  }

  /** Cast both floor sensors for the current ground mode. */
  private floorSensors(w: PlayerWorld, m: Mode): SensorHit & { which: number } {
    const d = MODE_DOWN[m]!;
    const [ax, ay] = rot(m, -this.wr, this.hr);
    const [bx, by] = rot(m, this.wr, this.hr);
    const ha = w.col.sensor(this.x + ax, this.y + ay, d, this.layer, true);
    const hb = w.col.sensor(this.x + bx, this.y + by, d, this.layer, true);
    this.debugSensors.push({ x: this.x + ax, y: this.y + ay, dir: d, hit: ha });
    this.debugSensors.push({ x: this.x + bx, y: this.y + by, dir: d, hit: hb });
    this.balanceSide = ha.dist > 12 && hb.dist <= 2 ? -1 : hb.dist > 12 && ha.dist <= 2 ? 1 : 0;
    return ha.dist <= hb.dist ? { ...ha, which: 0 } : { ...hb, which: 1 };
  }
  /** -1 / 1 when standing on an edge with nothing under the left / right sensor. */
  balanceSide = 0;

  private floorCollision(w: PlayerWorld): void {
    const m = modeOf(this.angle);
    const hit = this.floorSensors(w, m);
    const sp = m === Mode.Floor || m === Mode.Ceiling ? Math.abs(this.xsp) : Math.abs(this.ysp);
    const limit = Math.min(sp + 4, 14);
    if (!hit.found || hit.dist > limit) {
      this.leaveGround();
      return;
    }
    if (hit.dist < -14) return;
    const d = MODE_DOWN[m]!;
    this.x += d.dx * hit.dist;
    this.y += d.dy * hit.dist;
    let ang = hit.angle;
    // Sonic 3: ignore sudden jumps of more than 45 degrees (snaps to the mode's cardinal angle).
    if (angleDiff(ang, this.angle) > 45) ang = normAngle(Math.round(this.angle / 90) * 90);
    this.angle = ang;
  }

  private slipCheck(): void {
    if (this.controlLock > 0) return;
    if (Math.abs(this.gsp) >= FALL_SPEED_THRESHOLD) return;
    const a = normAngle(this.angle);
    if (a < 35 || a > 326) return;
    if (a >= 69 && a <= 291) {
      this.leaveGround();
    } else {
      this.gsp += a < 180 ? -0.5 : 0.5;
    }
    this.controlLock = CONTROL_LOCK_FRAMES;
  }

  /** Detach from the ground (walking off a ledge, falling off a wall). */
  leaveGround(): void {
    this.grounded = false;
    this.onObject = null;
    this.jumping = false;
    if (this.action === 'spindash') this.action = 'roll';
    if (this.action === 'slide') this.action = 'normal';
  }

  /** Keep a standing player attached to their object; returns false if they walked off. */
  private followObject(): boolean {
    const o = this.onObject!;
    const lx = this.x - o.x;
    if (Math.abs(lx) > o.hw + this.wr) return false;
    const top = o.y - o.hh + (o.surface ? o.surface(lx) : 0);
    this.y = top - this.hr;
    this.angle = 0;
    return true;
  }

  canJump(w: PlayerWorld): boolean {
    // Need at least 6px of headroom (Sonic Physics Guide).
    const m = modeOf(this.angle);
    const up = opposite(MODE_DOWN[m]!);
    const [cx, cy] = rot(m, -this.wr, -this.hr);
    const [dx, dy] = rot(m, this.wr, -this.hr);
    const a = w.col.dist(this.x + cx, this.y + cy, up, this.layer, false);
    const b = w.col.dist(this.x + dx, this.y + dy, up, this.layer, false);
    return Math.min(a, b) >= 6;
  }

  jump(w: PlayerWorld): void {
    const j = this.c.jump;
    this.xsp -= j * sinD(this.angle);
    this.ysp -= j * cosD(this.angle);
    this.grounded = false;
    this.onObject = null;
    this.jumping = true;
    this.abilityUsed = false;
    this.action = 'jump';
    this.crouching = this.lookingUp = false;
    if (!this.ball) this.setBall(true);
    w.sfx('jump');
  }

  /** Switch between standing and curled hitbox, keeping the feet in place. */
  setBall(on: boolean): void {
    if (this.ball === on) return;
    this.ball = on;
    const nh = on ? this.def.rollHr : this.def.standHr;
    const diff = this.hr - nh;
    this.hr = nh;
    this.wr = on ? this.def.rollWr : this.def.standWr;
    if (this.grounded) {
      const [dx, dy] = rot(modeOf(this.angle), 0, diff);
      this.x += dx;
      this.y += dy;
    } else {
      this.y += diff;
    }
  }

  // ---------------------------------------------------------------- air

  airStep(w: PlayerWorld): void {
    const c = this.c;
    const pad = this.pad;
    // Variable jump height.
    if (this.jumping && this.action === 'jump' && !pad.isHeld(JUMP) && this.ysp < -c.jumpRelease) {
      this.ysp = -c.jumpRelease;
    }
    if (this.jumping && pad.isPressed(JUMP) && !this.abilityUsed && this.action === 'jump') {
      if (this.canGoSuper && !this.superForm && this.rings >= 50) {
        this.transformSuper(w);
      } else {
        this.def.airAbility(this, w);
      }
    }
    this.airControl(c);
    this.airDrag();
    this.airMoveAndCollide(w, this.action === 'bubbleBounce' ? 0 : c.grv);
  }

  airControl(c: PhysicsConsts, scale = 1): void {
    const pad = this.pad;
    const air = c.air * scale;
    if (pad.isHeld(Btn.Left)) {
      if (this.xsp > -c.top) {
        this.xsp -= air;
        if (this.xsp <= -c.top) this.xsp = -c.top;
      }
      this.facing = -1;
    }
    if (pad.isHeld(Btn.Right)) {
      if (this.xsp < c.top) {
        this.xsp += air;
        if (this.xsp >= c.top) this.xsp = c.top;
      }
      this.facing = 1;
    }
  }

  airDrag(): void {
    if (this.ysp < 0 && this.ysp > -4) this.xsp -= Math.trunc(this.xsp / 0.125) / 256;
  }

  /** Move, apply gravity, rotate the angle back to flat and resolve air collisions. */
  airMoveAndCollide(w: PlayerWorld, grv: number): void {
    this.applyBounds(w);
    this.x += this.xsp;
    this.y += this.ysp;
    this.ysp = Math.min(this.ysp + grv, MAX_FALL);
    // Return ground angle toward 0 (2.8125 degrees per frame).
    if (this.angle !== 0) {
      const a = normAngle(this.angle);
      if (a < 180) this.angle = Math.max(0, a - 2.8125);
      else this.angle = normAngle(Math.min(360, a + 2.8125));
      if (this.angle >= 360) this.angle = 0;
    }
    this.airCollision(w);
  }

  airCollision(w: PlayerWorld): void {
    const motion = normAngle(Math.atan2(-this.ysp, this.xsp) / D2R);
    const dirMode =
      motion <= 45 || motion > 315 ? 'right' : motion <= 135 ? 'up' : motion <= 225 ? 'left' : 'down';
    // Walls.
    const checkLeft = dirMode !== 'right';
    const checkRight = dirMode !== 'left';
    const wallY = this.y;
    if (checkLeft) {
      const dist = w.col.dist(this.x - PUSH_RADIUS, wallY, LEFT, this.layer, false);
      this.debugSensors.push({
        x: this.x - PUSH_RADIUS,
        y: wallY,
        dir: LEFT,
        hit: { dist, angle: 270, found: dist < 32 },
      });
      if (dist < 0) {
        this.x -= dist;
        if (this.xsp < 0) this.xsp = 0;
        this.def.onAirWall?.(this, w, -1);
      }
    }
    if (checkRight) {
      const dist = w.col.dist(this.x + PUSH_RADIUS, wallY, RIGHT, this.layer, false);
      this.debugSensors.push({
        x: this.x + PUSH_RADIUS,
        y: wallY,
        dir: RIGHT,
        hit: { dist, angle: 90, found: dist < 32 },
      });
      if (dist < 0) {
        this.x += dist;
        if (this.xsp > 0) this.xsp = 0;
        this.def.onAirWall?.(this, w, 1);
      }
    }
    // Ceiling.
    if (dirMode !== 'down' && (dirMode === 'up' || this.ysp < 0)) {
      const hc = w.col.sensor(this.x - this.wr, this.y - this.hr, UP, this.layer, false);
      const hd = w.col.sensor(this.x + this.wr, this.y - this.hr, UP, this.layer, false);
      this.debugSensors.push({ x: this.x - this.wr, y: this.y - this.hr, dir: UP, hit: hc });
      this.debugSensors.push({ x: this.x + this.wr, y: this.y - this.hr, dir: UP, hit: hd });
      const h = hc.dist <= hd.dist ? hc : hd;
      if (h.found && h.dist < 0) {
        const a = normAngle(h.angle);
        if (dirMode === 'up' && ((a >= 91 && a <= 135) || (a >= 225 && a <= 269)) && this.canStick()) {
          // Land on a steep ceiling.
          this.y -= h.dist;
          this.angle = a;
          this.gsp = this.ysp * -Math.sign(sinD(a));
          this.landed(w);
          return;
        }
        this.y -= h.dist;
        if (this.ysp < 0) this.ysp = 0;
      }
    }
    // Floor.
    if (dirMode === 'down' || ((dirMode === 'left' || dirMode === 'right') && this.ysp >= 0)) {
      const ha = w.col.sensor(this.x - this.wr, this.y + this.hr, DOWN, this.layer, true);
      const hb = w.col.sensor(this.x + this.wr, this.y + this.hr, DOWN, this.layer, true);
      this.debugSensors.push({ x: this.x - this.wr, y: this.y + this.hr, dir: DOWN, hit: ha });
      this.debugSensors.push({ x: this.x + this.wr, y: this.y + this.hr, dir: DOWN, hit: hb });
      const h = ha.dist <= hb.dist ? ha : hb;
      if (h.found && h.dist < 0 && h.dist >= -(this.ysp + 8)) {
        this.y += h.dist;
        this.landOnFloor(w, h.angle, dirMode === 'down');
      }
    }
  }

  private canStick(): boolean {
    return this.action !== 'hurt' && this.action !== 'glide' && this.action !== 'fly';
  }

  /** Convert air velocity to ground speed using the landing angle. */
  landOnFloor(w: PlayerWorld, angle: number, mostlyDown: boolean): void {
    const a = normAngle(angle);
    const flat = a <= 23 || a >= 339;
    const slope = (a >= 24 && a <= 45) || (a >= 316 && a <= 338);
    this.angle = a;
    if (flat || !mostlyDown) {
      this.gsp = this.xsp;
    } else if (slope) {
      this.gsp = this.ysp * 0.5 * -Math.sign(sinD(a));
    } else {
      this.gsp = this.ysp * -Math.sign(sinD(a));
    }
    if (flat && !mostlyDown) this.gsp = this.xsp;
    this.landed(w);
  }

  /** Common landing bookkeeping. */
  landed(w: PlayerWorld): void {
    this.grounded = true;
    this.jumping = false;
    this.abilityUsed = false;
    this.instaShield = 0;
    const prev = this.action;
    if (prev === 'bubbleBounce') {
      // Bubble shield: bounce back up instead of landing.
      this.grounded = false;
      const b = this.underwater ? 4 : 7.5;
      this.xsp -= b * sinD(this.angle);
      this.ysp = -b * cosD(this.angle);
      this.angle = 0;
      this.action = 'jump';
      this.jumping = true;
      w.sfx('bubbleBounce');
      w.effect('bubbleBounce', this.x, this.y + this.hr);
      return;
    }
    if (prev === 'hurt') {
      this.gsp = this.xsp = 0;
      this.invuln = 120;
    }
    if (this.forceRoll) {
      this.action = 'roll';
    } else {
      if (this.ball) this.setBall(false);
      if (prev === 'glide') {
        this.action = 'slide';
        return;
      }
      this.action = 'normal';
    }
    this.xsp = this.gsp * cosD(this.angle);
    this.ysp = this.gsp * -sinD(this.angle);
  }

  // ---------------------------------------------------------------- hurt / death

  private hurtStep(w: PlayerWorld): void {
    this.airMoveAndCollide(w, this.underwater ? HURT_GRV / 3 : HURT_GRV);
  }

  /** Damage the player. Returns true if it had an effect. */
  hurt(w: PlayerWorld, sourceX: number): boolean {
    if (this.dead || this.action === 'hurt' || this.invuln > 0 || this.invincible > 0 || this.superForm)
      return false;
    if (this.shield) {
      this.shield = null;
      w.sfx('hurt');
    } else if (this.rings > 0) {
      w.scatterRings(this.x, this.y, this.rings);
      this.rings = 0;
      w.sfx('ringLoss');
    } else {
      this.die(w);
      return true;
    }
    if (this.ball) this.setBall(false);
    this.action = 'hurt';
    this.grounded = false;
    this.onObject = null;
    this.jumping = false;
    const dir = this.x >= sourceX ? 1 : -1;
    this.xsp = 2 * dir;
    this.ysp = -4;
    if (this.underwater) {
      this.xsp /= 2;
      this.ysp /= 2;
    }
    return true;
  }

  die(w: PlayerWorld, drown = false): void {
    if (this.dead) return;
    this.superForm = false;
    this.shield = null;
    if (this.ball) this.setBall(false);
    this.action = drown ? 'drown' : 'dead';
    this.grounded = false;
    this.onObject = null;
    this.xsp = 0;
    this.ysp = drown ? 0 : -7;
    this.deathTimer = 0;
    w.sfx(drown ? 'drown' : 'death');
  }

  private updateDead(w: PlayerWorld): void {
    this.deathTimer++;
    this.x += this.xsp;
    this.y += this.ysp;
    this.ysp = Math.min(this.ysp + (this.action === 'drown' ? 0.0625 : 0.21875), MAX_FALL);
    void w;
  }

  // ---------------------------------------------------------------- water / timers

  private updateWater(w: PlayerWorld): void {
    const under = this.y > w.waterY;
    if (under !== this.underwater && !this.dead) {
      this.underwater = under;
      w.effect('splash', this.x, w.waterY);
      w.sfx('splash');
      if (under) {
        this.xsp *= 0.5;
        this.ysp *= 0.25;
        this.gsp *= 0.5;
        if (this.shield === 'fire' || this.shield === 'lightning') this.shield = null;
      } else {
        if (this.ysp < 0) this.ysp = Math.max(this.ysp * 2, -16);
        this.air = 1800;
      }
    }
    if (this.underwater && !this.dead && this.shield !== 'bubble' && !this.superForm) {
      this.air--;
      if (this.air === 1500 || this.air === 1200 || this.air === 900) w.sfx('drownWarn');
      if (this.air <= 0) this.die(w, true);
    } else {
      this.air = 1800;
    }
  }

  /** Called by air bubbles. */
  breathe(w: PlayerWorld): void {
    this.air = 1800;
    w.sfx('breath');
    if (!this.grounded) {
      this.xsp = 0;
      this.ysp = 0;
    }
  }

  private updateTimers(w: PlayerWorld): void {
    if (this.invuln > 0 && this.action !== 'hurt') this.invuln--;
    if (this.invincible > 0) this.invincible--;
    if (this.speedShoes > 0) this.speedShoes--;
    if (this.instaShield > 0) this.instaShield--;
    if (this.cameraLag > 0) this.cameraLag--;
    if (this.superForm) {
      if (++this.superRingTimer >= 60) {
        this.superRingTimer = 0;
        this.rings--;
        if (this.rings <= 0) {
          this.rings = 0;
          this.superForm = false;
        }
      }
    }
    if (this.y > w.boundBottom && !this.dead) this.die(w);
  }

  transformSuper(w: PlayerWorld): void {
    this.superForm = true;
    this.superRingTimer = 0;
    this.abilityUsed = true;
    this.invincible = 0;
    w.sfx('super');
    w.effect('superFlash', this.x, this.y);
  }

  // ---------------------------------------------------------------- springs and pushes

  /** Launch upward/downward from a spring (vertical) — `power` in px/frame. */
  springVertical(w: PlayerWorld, power: number): void {
    this.ysp = power;
    this.grounded = false;
    this.onObject = null;
    this.jumping = false;
    this.angle = 0;
    if (this.ball) this.setBall(false);
    this.action = 'spring';
    w.sfx('spring');
  }

  springHorizontal(w: PlayerWorld, power: number): void {
    if (this.grounded) this.gsp = power;
    this.xsp = power;
    this.facing = power > 0 ? 1 : -1;
    this.controlLock = 16;
    w.sfx('spring');
  }

  // ---------------------------------------------------------------- animation

  private animate(): void {
    const prev = this.anim;
    let anim: string;
    let speed = 8; // frames per animation frame
    const g = Math.abs(this.gsp);
    switch (this.action) {
      case 'dead':
        anim = 'death';
        break;
      case 'drown':
        anim = 'drown';
        break;
      case 'hurt':
        anim = 'hurt';
        break;
      case 'spindash':
        anim = 'spindash';
        speed = 1;
        break;
      case 'spring':
        anim = 'spring';
        speed = 4;
        if (this.ysp > 0) {
          this.action = 'normal';
          anim = 'walk';
        }
        break;
      case 'fly':
      case 'glide':
      case 'glideFall':
      case 'slide':
      case 'climb':
      case 'ledgeClimb':
      case 'carried':
      case 'victory':
        anim = this.action;
        speed = this.action === 'fly' ? 2 : 6;
        break;
      default:
        if (this.ball) {
          anim = 'roll';
          speed = Math.max(1, Math.floor(5 - g));
          if (!this.grounded) speed = Math.max(1, Math.floor(5 - Math.abs(this.xsp)));
        } else if (this.grounded) {
          if (this.skidding) anim = 'skid';
          else if (this.pushing) {
            anim = 'push';
            speed = 16;
          } else if (g === 0 || (g < 0.2 && !this.pad.isHeld(Btn.Left | Btn.Right))) {
            if (this.crouching) anim = 'crouch';
            else if (this.lookingUp) anim = 'lookUp';
            else if (this.balanceSide !== 0 && modeOf(this.angle) === Mode.Floor) anim = 'balance';
            else anim = this.idleTimer > 180 ? 'wait' : 'idle';
            speed = anim === 'wait' ? 20 : 8;
          } else if (g >= (this.superForm ? 8 : 10)) {
            anim = 'dash';
            speed = 1;
          } else if (g >= 6) {
            anim = 'run';
            speed = Math.max(1, Math.floor(8 - g));
          } else {
            anim = 'walk';
            speed = Math.max(1, Math.floor(8 - g));
          }
        } else {
          anim = prev === 'run' || prev === 'dash' ? prev : 'walk';
          speed = Math.max(1, Math.floor(8 - Math.abs(this.xsp)));
        }
    }
    if (anim === 'idle' && this.grounded && g === 0) this.idleTimer++;
    else this.idleTimer = 0;
    if (anim !== prev) {
      this.anim = anim;
      this.animFrame = 0;
      this.animTimer = 0;
    } else if (++this.animTimer >= speed) {
      this.animTimer = 0;
      this.animFrame++;
    }
    // Display angle: follow the ground while moving; ease toward upright in the air.
    if (this.grounded && !this.ball && (g > 0 || modeOf(this.angle) !== Mode.Floor)) {
      this.drawAngle = this.angle;
    } else if (this.grounded) {
      this.drawAngle = angleDiff(this.angle, 0) < 24 ? 0 : this.angle;
    } else {
      this.drawAngle = this.angle;
    }
  }
}

function opposite(d: Dir): Dir {
  return d === DOWN ? UP : d === UP ? DOWN : d === LEFT ? RIGHT : LEFT;
}
