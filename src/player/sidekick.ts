import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { Btn, JUMP, Pad } from '../engine/input';
import type { Act } from '../game/act';
import type { Player } from './Player';
import { FLIGHT_TIME } from './tails';

const DELAY = 16;
const HISTORY = 64;

interface Frame {
  held: number;
  x: number;
  y: number;
}

type Mode = 'follow' | 'respawn' | 'carry';

/**
 * Sonic 2 style partner AI: replays the leader's input from 16 frames ago while
 * steering toward where the leader was, flies back in when lost, and can carry
 * the leader (hold Up and press Jump while standing next to Tails).
 */
export class SidekickAI {
  private readonly hist: Frame[] = [];
  private readonly pad = new Pad();
  mode: Mode = 'follow';
  private offscreen = 0;
  private stuck = 0;
  private jumpHold = 0;

  constructor(
    private readonly act: Act,
    private readonly me: Player,
  ) {
    act.afterPlayers.push(() => this.afterPlayers());
  }

  private get leader(): Player {
    return this.act.leader;
  }

  /** Called when the sidekick is about to update; returns its controller state. */
  next(): Pad {
    const L = this.leader;
    this.hist.push({ held: L.pad.held, x: L.x, y: L.y });
    if (this.hist.length > HISTORY) this.hist.shift();
    const me = this.me;

    if (this.mode === 'carry') {
      // The player's directions steer; holding Up climbs.
      let held = L.pad.held & (Btn.Left | Btn.Right);
      if (L.pad.isHeld(Btn.Up) && this.act.frame % 8 === 0) held |= Btn.A;
      this.pad.latch(held);
      return this.pad;
    }

    if (this.mode === 'respawn') {
      this.flyIn();
      this.pad.latch(0);
      return this.pad;
    }

    // Lost? Dead, or off-screen for five seconds.
    const cam = this.act.camera;
    const onScreen =
      me.x > cam.x - 32 && me.x < cam.x + SCREEN_W + 32 && me.y > cam.y - 32 && me.y < cam.y + SCREEN_H + 32;
    this.offscreen = onScreen ? 0 : this.offscreen + 1;
    if ((me.dead && me.deathTimer > 60) || this.offscreen > 300) {
      this.startRespawn();
      this.pad.latch(0);
      return this.pad;
    }
    if (me.dead || L.dead) {
      this.pad.latch(0);
      return this.pad;
    }

    const past = this.hist[Math.max(0, this.hist.length - 1 - DELAY)]!;
    let held = past.held & ~(Btn.Left | Btn.Right);
    const dx = past.x - me.x;
    // Steer toward the leader's old position; only brake when clearly overshooting.
    const dir = past.held & (Btn.Left | Btn.Right);
    const overshoot = dir === Btn.Right ? dx < -48 : dir === Btn.Left ? dx > 48 : false;
    if (overshoot || (!dir && Math.abs(dx) > 16)) held |= dx > 0 ? Btn.Right : Btn.Left;
    else if (dir) held |= dir;
    else if (Math.abs(dx) > 16) held |= dx > 0 ? Btn.Right : Btn.Left;
    // Pushing a wall or far below the leader: jump.
    this.stuck = me.grounded && Math.abs(me.gsp) < 0.5 && Math.abs(dx) > 32 ? this.stuck + 1 : 0;
    if (
      (this.stuck > 30 || (me.grounded && past.y < me.y - 64 && Math.abs(dx) < 64)) &&
      this.jumpHold === 0
    ) {
      this.jumpHold = 20;
      this.stuck = 0;
    }
    if (this.jumpHold > 0) {
      this.jumpHold--;
      held |= Btn.A;
      if (this.jumpHold === 19) held &= ~JUMP; // make sure it registers as a fresh press next frame
    }
    // Don't copy Up+Jump (that is the carry request).
    if (L.pad.isHeld(Btn.Up)) held &= ~Btn.Up;
    this.pad.latch(held);
    return this.pad;
  }

  private startRespawn(): void {
    const me = this.me;
    const cam = this.act.camera;
    this.mode = 'respawn';
    me.action = 'fly';
    me.noClip = true;
    me.grounded = false;
    me.onObject = null;
    me.x = this.leader.x;
    me.y = cam.y - 32;
    me.xsp = me.ysp = me.gsp = 0;
    me.layer = this.leader.layer;
    if (me.ball) me.setBall(false);
  }

  /** Fly straight toward the leader, ignoring terrain, then resume following. */
  private flyIn(): void {
    const me = this.me;
    const L = this.leader;
    const tx = L.x - 24 * L.facing,
      ty = L.y - 32;
    const dx = tx - me.x,
      dy = ty - me.y;
    me.x += Math.sign(dx) * Math.min(Math.abs(dx), 2 + Math.abs(L.xsp));
    me.y += Math.sign(dy) * Math.min(Math.abs(dy), 2);
    me.facing = dx >= 0 ? 1 : -1;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && !L.dead) {
      this.mode = 'follow';
      me.noClip = false;
      me.action = 'normal';
      me.grounded = false;
      me.ysp = 0;
      me.xsp = L.xsp;
      me.invuln = 0;
      this.offscreen = 0;
    }
  }

  private afterPlayers(): void {
    const me = this.me;
    const L = this.leader;
    if (this.mode === 'follow') {
      // Carry request: leader jumped while holding Up next to Tails.
      const near = Math.abs(me.x - L.x) < 48 && Math.abs(me.y - L.y) < 48;
      if (
        near &&
        !me.dead &&
        L.action === 'jump' &&
        L.pad.isPressed(JUMP) &&
        L.pad.isHeld(Btn.Up) &&
        L.jumping
      ) {
        this.mode = 'carry';
        me.action = 'fly';
        me.grounded = false;
        me.onObject = null;
        if (me.ball) me.setBall(false);
        me.actionTimer = FLIGHT_TIME;
        me.aux = 1;
        me.x = L.x;
        me.y = L.y - 30;
        me.xsp = L.xsp;
        me.ysp = -1;
        if (L.ball) L.setBall(false);
        L.action = 'carried';
      }
      return;
    }
    if (this.mode === 'carry') {
      const release = L.pad.isPressed(JUMP) || me.grounded || me.dead || L.dead || me.action !== 'fly';
      if (release || L.action !== 'carried') {
        this.mode = 'follow';
        if (L.action === 'carried') {
          L.action = 'jump';
          L.jumping = L.pad.isPressed(JUMP);
          L.abilityUsed = false;
          L.setBall(true);
          L.grounded = false;
          L.xsp = me.xsp;
          L.ysp = L.pad.isPressed(JUMP) ? -4 : me.ysp;
        }
        return;
      }
      L.x = me.x;
      L.y = me.y + 30;
      L.xsp = me.xsp;
      L.ysp = me.ysp;
      L.facing = me.facing;
      L.grounded = false;
    }
  }
}

/** Factory registered with the game flow. */
export function makeSidekick(act: Act, p: Player): () => Pad {
  const ai = new SidekickAI(act, p);
  return () => ai.next();
}
