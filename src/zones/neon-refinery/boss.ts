import { chemBlob } from '../../art/badniks';
import { rgb } from '../../art/pixels';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { GameObject, registerObject } from '../../objects/base';
import { Boss } from '../../objects/bosses/boss';
import type { Player } from '../../player/Player';
import { DOWN } from '../../level/collision';

/** A falling chemical blob that bursts into droplets when it lands. */
class Blob extends GameObject {
  private vy = 0;
  constructor(
    x: number,
    y: number,
    private readonly small = false,
    private vx = 0,
  ) {
    super(x, y);
    this.hw = small ? 5 : 10;
    this.hh = small ? 5 : 10;
    this.depth = 6;
    this.alwaysActive = true;
    if (small) this.vy = -3;
  }
  override update(act: Act): void {
    this.vy = Math.min(8, this.vy + (this.small ? 0.21875 : 0.15));
    this.x += this.vx;
    this.y += this.vy;
    const d = act.col.dist(this.x, this.y + this.hh, DOWN, 0, true);
    if (d < 0 && this.vy > 0) {
      this.dead = true;
      act.effect('splash', this.x, this.y + this.hh);
      if (!this.small) for (const vx of [-2.5, -1.2, 1.2, 2.5]) act.spawn(new Blob(this.x, this.y, true, vx));
    }
    if (this.y > act.camera.y + 300) this.dead = true;
  }
  override touch(act: Act, p: Player): void {
    p.hurt(act, this.x);
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(chemBlob(this.small ? 5 : 10, act.frame >> 3), this.x - cx, this.y - cy);
  }
}

/** Neon Refinery boss: shuttles overhead, lines up with the player and drops chemical. */
export class RefineryBoss extends Boss {
  private readonly hoverY: number;
  private dropTimer = 0;
  private fill = 0;
  constructor(arenaX: number, arenaW: number, groundY: number, act: Act) {
    super(arenaX + arenaW + 40, groundY - 150, arenaX, arenaW, groundY);
    this.hoverY = groundY - 118;
    void act;
  }
  enter(): boolean {
    this.x -= 2;
    this.y = this.hoverY;
    return this.x <= this.arenaX + this.arenaW - 80;
  }
  fight(act: Act): void {
    const p = act.leader;
    const left = this.arenaX + 48,
      right = this.arenaX + this.arenaW - 48;
    if (this.dropTimer > 0) {
      // Hold still while the tank fills, then drop.
      this.dropTimer--;
      this.fill = Math.min(1, this.fill + 1 / 40);
      if (this.dropTimer === 0) {
        act.spawn(new Blob(this.x, this.y + 30));
        act.sfx('splash');
        this.fill = 0;
      }
    } else {
      const target = Math.max(left, Math.min(right, p.x));
      const speed = this.hp <= 3 ? 2.5 : 1.5;
      this.x += Math.sign(target - this.x) * Math.min(speed, Math.abs(target - this.x));
      this.facing = target > this.x ? 1 : -1;
      if (Math.abs(target - this.x) < 2 && this.t % 30 === 0) this.dropTimer = this.hp <= 3 ? 30 : 50;
    }
    this.y = this.hoverY + Math.sin(this.t / 20) * 4;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    // Chemical tank under the pod.
    const tx = this.x - cx - 10,
      ty = this.y - cy + 20;
    r.rect(tx, ty, 20, 14, rgb(40, 40, 64));
    r.rect(tx + 2, ty + 2 + 10 * (1 - this.fill), 16, 10 * this.fill, rgb(255, 96, 208));
    this.drawPod(r, cx, cy);
  }
}

registerObject(
  'refineryBoss',
  (_x, _y, p, act) => new RefineryBoss(p.arenaX as number, p.arenaW as number, p.groundY as number, act),
);
