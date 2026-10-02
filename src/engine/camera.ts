import { SCREEN_H, SCREEN_W } from './constants';
import type { Player } from '../player/Player';

/**
 * Sonic 2 style camera: a 16px horizontal focus window, an airborne vertical
 * window of 64px, ground snapping at 96px from the top, and look up/down panning.
 */
export class Camera {
  x = 0;
  y = 0;
  minX = 0;
  minY = 0;
  maxX = 0;
  maxY = 0;
  /** Vertical look offset from holding up/down. */
  look = 0;
  private lookTimer = 0;
  /** Screen shake frames remaining. */
  shake = 0;
  /** When set, the camera's left edge cannot go back past this X (boss arenas). */
  lockLeft = -Infinity;
  /** Disable horizontal following (act end). */
  frozenX = false;

  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = Math.max(minX, maxX - SCREEN_W);
    this.maxY = Math.max(minY, maxY - SCREEN_H);
  }

  /** Jump straight to the player (spawn, respawn). */
  snap(p: Player): void {
    this.x = p.x - 152;
    this.y = Math.max(this.minY, Math.min(this.maxY, p.y - 96));
    this.clamp();
  }

  update(p: Player): void {
    if (!this.frozenX && p.cameraLag === 0) {
      const left = this.x + 144,
        right = this.x + 160;
      if (p.x > right) this.x += Math.min(p.x - right, 16);
      else if (p.x < left) this.x -= Math.min(left - p.x, 16);
    }
    // Look up / down after holding for two seconds.
    const looking = p.lookingUp ? -1 : p.crouching ? 1 : 0;
    if (looking !== 0) {
      if (++this.lookTimer > 120) {
        const target = looking < 0 ? -104 : 88;
        this.look += Math.sign(target - this.look) * Math.min(2, Math.abs(target - this.look));
      }
    } else {
      this.lookTimer = 0;
      this.look -= Math.sign(this.look) * Math.min(2, Math.abs(this.look));
    }
    const py = p.y + this.look;
    if (!p.grounded || p.dead) {
      const top = this.y + 64,
        bottom = this.y + 128;
      if (py < top) this.y -= Math.min(top - py, 16);
      else if (py > bottom) this.y += Math.min(py - bottom, 16);
    } else {
      const target = this.y + 96;
      const max = Math.abs(p.gsp) >= 8 ? 16 : 6;
      if (py !== target) this.y += Math.sign(py - target) * Math.min(Math.abs(py - target), max);
    }
    this.clamp();
  }

  clamp(): void {
    const minX = Math.max(this.minX, this.lockLeft);
    this.x = Math.max(minX, Math.min(this.maxX, this.x));
    // Ease into new vertical limits instead of jumping (boss arenas).
    if (this.y < this.minY) this.y = Math.min(this.minY, this.y + 4);
    if (this.y > this.maxY) this.y = Math.max(this.maxY, this.y - 4);
  }

  /** Integer render position including shake. */
  get rx(): number {
    return Math.floor(this.x) + (this.shake > 0 ? ((this.shake * 7) % 5) - 2 : 0);
  }
  get ry(): number {
    return Math.floor(this.y) + (this.shake > 0 ? ((this.shake * 3) % 5) - 2 : 0);
  }
}
