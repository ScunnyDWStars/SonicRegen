import { chainLink, wreckBall } from '../../art/badniks';
import type { Renderer } from '../../engine/renderer';
import type { Act } from '../../game/act';
import { GameObject, registerObject } from '../../objects/base';
import { Boss } from '../../objects/bosses/boss';
import type { Player } from '../../player/Player';

/** The wrecking ball the Palm Coast boss swings. Always harmful. */
class WreckingBall extends GameObject {
  falling = false;
  vy = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 14;
    this.hh = 14;
    this.depth = 6;
    this.alwaysActive = true;
  }
  override update(act: Act): void {
    if (!this.falling) return;
    this.vy += 0.21875;
    this.y += this.vy;
    if (this.y > act.camera.y + 300) this.dead = true;
  }
  override touch(act: Act, p: Player): void {
    if (!this.falling) p.hurt(act, this.x);
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(wreckBall(), this.x - cx, this.y - cy);
  }
}

/** Palm Coast boss: drops in, lowers a wrecking ball and swings it while pacing. */
export class PalmBoss extends Boss {
  private chain = 0;
  private readonly ball: WreckingBall;
  private readonly hoverY: number;
  constructor(arenaX: number, arenaW: number, groundY: number, act: Act) {
    super(arenaX + arenaW - 64, act.camera.y - 48, arenaX, arenaW, groundY);
    this.hoverY = groundY - 120;
    this.ball = new WreckingBall(this.x, this.y);
    act.spawn(this.ball);
  }

  private swing(): number {
    return Math.sin((this.t / 160) * Math.PI * 2) * 1.1;
  }

  private placeBall(): void {
    const a = this.state === 'fight' ? this.swing() : 0;
    const L = this.chain + 16;
    this.ball.x = this.x + Math.sin(a) * L;
    this.ball.y = this.y + 20 + Math.cos(a) * L;
  }

  enter(): boolean {
    if (this.y < this.hoverY) {
      this.y = Math.min(this.hoverY, this.y + 1.5);
      this.placeBall();
      return false;
    }
    this.chain = Math.min(64, this.chain + 1.5);
    this.placeBall();
    return this.chain >= 64;
  }

  fight(): void {
    const left = this.arenaX + 80,
      right = this.arenaX + this.arenaW - 80;
    this.x += this.facing * 0.75;
    if (this.x < left) this.facing = 1;
    if (this.x > right) this.facing = -1;
    this.placeBall();
  }

  override onDefeated(): void {
    this.ball.falling = true;
  }

  override draw(r: Renderer, cx: number, cy: number): void {
    if (!this.ball.falling) {
      const a = this.state === 'fight' ? this.swing() : 0;
      for (let L = 8; L < this.chain + 8; L += 12) {
        r.image(chainLink(), this.x + Math.sin(a) * L - cx, this.y + 20 + Math.cos(a) * L - cy);
      }
    }
    this.drawPod(r, cx, cy);
  }
}

registerObject(
  'palmBoss',
  (_x, _y, p, act) => new PalmBoss(p.arenaX as number, p.arenaW as number, p.groundY as number, act),
);
