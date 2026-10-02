import { roundShot } from '../../art/badniks';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { DOWN } from '../../level/collision';
import { GameObject, registerObject } from '../../objects/base';
import { Boss } from '../../objects/bosses/boss';
import type { Player } from '../../player/Player';
import { Flame } from './objects';

/** A firebomb that bursts into ground flames on impact. */
class Firebomb extends GameObject {
  constructor(
    x: number,
    y: number,
    private vx: number,
    private vy: number,
  ) {
    super(x, y);
    this.hw = 6;
    this.hh = 6;
    this.depth = 7;
    this.alwaysActive = true;
  }
  override update(act: Act): void {
    this.vy = Math.min(8, this.vy + 0.15);
    this.x += this.vx;
    this.y += this.vy;
    const d = act.col.dist(this.x, this.y + 6, DOWN, 0, true);
    if (d < 0 && this.vy > 0) {
      this.dead = true;
      act.effect('explosion', this.x, this.y);
      act.sfx('explode');
      const gy = this.y + 6 + d - 10;
      for (const off of [-24, 0, 24]) act.spawn(new Flame(this.x + off, gy));
    }
    if (this.y > act.camera.y + 300) this.dead = true;
  }
  override touch(act: Act, p: Player): void {
    if (p.shield === 'fire') return;
    if (p.hurt(act, this.x)) this.dead = true;
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(roundShot('fire', act.frame >> 2), this.x - cx, this.y - cy);
  }
}

/**
 * Jungle Isle boss: patrols high above the arena dropping firebombs, then swoops
 * low across the arena (the moment to strike) and climbs back up.
 */
export class JungleBoss extends Boss {
  private readonly highY: number;
  private readonly lowY: number;
  private phase: 'patrol' | 'dive' | 'sweep' | 'climb' = 'patrol';
  private phaseT = 0;
  private bombs = 0;
  constructor(arenaX: number, arenaW: number, groundY: number) {
    super(arenaX + arenaW + 48, groundY - 180, arenaX, arenaW, groundY);
    this.highY = groundY - 176;
    this.lowY = groundY - 72;
  }
  enter(): boolean {
    this.x -= 2;
    this.y = this.highY;
    return this.x <= this.arenaX + this.arenaW - 64;
  }
  fight(act: Act): void {
    this.phaseT++;
    const left = this.arenaX + 48,
      right = this.arenaX + this.arenaW - 48;
    const fast = this.hp <= 4;
    switch (this.phase) {
      case 'patrol':
        this.x += this.facing * (fast ? 1.5 : 1);
        if (this.x < left) this.facing = 1;
        if (this.x > right) this.facing = -1;
        this.y = this.highY + Math.sin(this.t / 16) * 3;
        if (this.phaseT % (fast ? 70 : 100) === 0) {
          const p = act.leader;
          const vx = Math.max(-2.5, Math.min(2.5, (p.x - this.x) / 60));
          act.spawn(new Firebomb(this.x, this.y + 24, vx, -1));
          act.sfx('pop');
          this.bombs++;
        }
        if (this.bombs >= 3) {
          this.bombs = 0;
          this.phase = 'dive';
          this.phaseT = 0;
        }
        break;
      case 'dive':
        this.y += 2;
        if (this.y >= this.lowY) {
          this.y = this.lowY;
          this.phase = 'sweep';
          this.phaseT = 0;
          this.facing = this.x > (left + right) / 2 ? -1 : 1;
        }
        break;
      case 'sweep':
        this.x += this.facing * (fast ? 3 : 2.25);
        if ((this.facing < 0 && this.x < left) || (this.facing > 0 && this.x > right)) {
          this.phase = 'climb';
          this.phaseT = 0;
        }
        if (this.phaseT % 8 === 0) act.effect('smoke', this.x - this.facing * 24, this.y + 16);
        break;
      case 'climb':
        this.y -= 1.5;
        if (this.y <= this.highY) {
          this.phase = 'patrol';
          this.phaseT = 0;
        }
        break;
    }
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    // Bomb bay underneath the pod.
    r.rect(this.x - cx - 12, this.y - cy + 18, 24, 6, 0xff404048);
    this.drawPod(r, cx, cy);
  }
}

registerObject(
  'jungleBoss',
  (_x, _y, p) => new JungleBoss(p.arenaX as number, p.arenaW as number, p.groundY as number),
);
