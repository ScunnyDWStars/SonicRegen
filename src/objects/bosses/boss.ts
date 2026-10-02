import { eggPod } from '../../art/badniks';
import { SCREEN_H, SCREEN_W } from '../../engine/constants';
import type { Renderer } from '../../engine/renderer';
import type { Player } from '../../player/Player';
import type { Act } from '../../game/act';
import { createObject, GameObject, registerObject } from '../base';

export type BossState = 'enter' | 'fight' | 'defeated' | 'flee';

/**
 * Shared boss behaviour: eight hits, invulnerability flashing, defeat explosions,
 * fleeing and unlocking the camera. Subclasses implement enter() and fight().
 */
export abstract class Boss extends GameObject {
  hp = 8;
  flash = 0;
  state: BossState = 'enter';
  t = 0;
  stateT = 0;
  facing: 1 | -1 = -1;
  mood = 0;

  constructor(
    x: number,
    y: number,
    readonly arenaX: number,
    readonly arenaW: number,
    readonly groundY: number,
  ) {
    super(x, y);
    this.hw = 24;
    this.hh = 16;
    this.depth = 5;
    this.alwaysActive = true;
  }

  /** Called every frame while entering. Return true when ready to fight. */
  abstract enter(act: Act): boolean;
  abstract fight(act: Act): void;

  override update(act: Act): void {
    this.t++;
    this.stateT++;
    if (this.flash > 0) this.flash--;
    this.mood = this.flash > 0 ? 1 : 0;
    switch (this.state) {
      case 'enter':
        if (this.enter(act)) this.setState('fight');
        break;
      case 'fight':
        this.fight(act);
        break;
      case 'defeated':
        this.mood = 2;
        if (this.stateT % 6 === 0) {
          act.effect('explosion', this.x + (Math.random() - 0.5) * 48, this.y + (Math.random() - 0.5) * 32);
          act.sfx('explode');
        }
        this.y += 0.25;
        if (this.stateT > 150) this.setState('flee');
        break;
      case 'flee':
        this.mood = 2;
        this.facing = 1;
        this.x += 2.5;
        this.y -= this.stateT < 60 ? 0.5 : 1;
        if (this.stateT % 10 === 0) act.effect('smoke', this.x - 20, this.y + 10);
        if (this.x > act.camera.x + SCREEN_W + 80) {
          this.dead = true;
          this.onGone(act);
        }
        break;
    }
  }

  setState(s: BossState): void {
    this.state = s;
    this.stateT = 0;
  }

  /** Is the pod currently vulnerable/harmful? */
  get active(): boolean {
    return this.state === 'fight' || this.state === 'enter';
  }

  override touch(act: Act, p: Player): void {
    if (!this.active || p.dead) return;
    if (p.attacking) {
      // Rebound off the pod, as in the originals.
      p.xsp = -p.xsp;
      p.ysp = -p.ysp;
      if (p.grounded) p.gsp = -p.gsp;
      if (Math.abs(p.xsp) < 2) p.xsp = p.x < this.x ? -2 : 2;
      if (this.flash === 0) this.hit(act);
    } else if (this.flash === 0) {
      p.hurt(act, this.x);
    }
  }

  hit(act: Act): void {
    this.hp--;
    this.flash = 32;
    act.sfx('bossHit');
    if (this.hp <= 0) {
      this.setState('defeated');
      act.addScore(1000, this.x, this.y - 32);
      this.onDefeated(act);
    }
  }

  /** Hook for subclasses (drop weapons etc.). */
  onDefeated(_act: Act): void {}

  /** Boss has left the screen: free the camera and bring back the zone music. */
  onGone(act: Act): void {
    act.bossActive = false;
    act.camera.maxX = act.level.width - SCREEN_W;
    act.camera.minY = 0;
    act.camera.maxY = Math.max(0, act.level.cameraBottom - SCREEN_H);
    act.game.sound.music(act.music);
  }

  drawPod(r: Renderer, cx: number, cy: number): void {
    if (this.flash > 0 && this.flash & 2) {
      r.image(eggPod(this.t >> 2, 1), this.x - cx, this.y - cy, { flipX: this.facing > 0, alpha: 0.4 });
      return;
    }
    r.image(eggPod(this.t >> 2, this.mood), this.x - cx, this.y - cy, { flipX: this.facing > 0 });
  }
}

/** Locks the camera on a boss arena and spawns the boss when the player arrives. */
class BossTrigger extends GameObject {
  private fired = false;
  constructor(
    x: number,
    y: number,
    readonly w: number,
    readonly boss: string,
  ) {
    super(x, y);
    this.hw = 0;
    this.alwaysActive = true;
  }
  override update(act: Act): void {
    if (this.fired || act.leader.x < this.x + SCREEN_W / 2 - 16 || act.leader.dead) return;
    this.fired = true;
    act.camera.lockLeft = this.x;
    act.camera.maxX = this.x + this.w - SCREEN_W;
    // Fix the view so the arena floor sits near the bottom of the screen.
    act.camera.minY = act.camera.maxY = this.y - 200;
    act.bossActive = true;
    act.game.sound.music('boss');
    const b = createObject(
      this.boss,
      this.x,
      this.y,
      { arenaX: this.x, arenaW: this.w, groundY: this.y },
      act,
    );
    if (b) act.spawn(b);
  }
}

registerObject(
  'bossTrigger',
  (x, y, p) => new BossTrigger(x, y, (p.w as number) ?? SCREEN_W, (p.boss as string) ?? 'palmBoss'),
);
