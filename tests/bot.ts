import { Btn } from '../src/engine/input';
import type { Act } from '../src/game/act';
import { Boss } from '../src/objects/bosses/boss';
import type { SolidBox } from '../src/objects/base';

/**
 * A simple autopilot that plays an act to the end: it runs right, jumps gaps and
 * walls, waits for moving platforms, spindashes up steep slopes and jumps at the
 * boss. Used by the playthrough tests to prove every act can be finished.
 */
export class Bot {
  private script: number[] = [];
  private lastX = 0;
  private stuck = 0;
  private tries = 0;
  private target: SolidBox | null = null;
  private airFrames = 0;
  waiting = 0;

  constructor(private readonly act: Act) {}

  /** Is there solid terrain under x, between fromY and fromY + depth? */
  private terrainAt(x: number, fromY: number, depth: number): boolean {
    const a = this.act;
    for (let y = Math.floor(fromY); y < fromY + depth; y += 2)
      if (a.col.solid(Math.floor(x), y, a.leader.layer, true)) return true;
    return false;
  }

  /** Terrain or a static (non-moving) solid object's top under x. */
  private groundAt(x: number, fromY: number, depth: number): boolean {
    if (this.terrainAt(x, fromY, depth)) return true;
    for (const o of this.act.objects) {
      const s = o.solid;
      if (!s || o.dead || s.predict || o.constructor.name === 'Spikes') continue;
      const top = s.y - s.hh;
      // Generous upward tolerance: bridges sag under the player.
      if (Math.abs(x - s.x) < s.hw && top >= fromY - 24 && top <= fromY + depth) return true;
    }
    return false;
  }

  /** Terrain or a solid object's top under x, between fromY and fromY + depth. */
  floorAt(x: number, fromY: number, depth: number): boolean {
    if (this.terrainAt(x, fromY, depth)) return true;
    for (const o of this.act.objects) {
      const s = o.solid;
      if (!s || o.dead) continue;
      const top = s.y - s.hh;
      if (Math.abs(x - s.x) < s.hw && top >= fromY - 8 && top <= fromY + depth) return true;
    }
    return false;
  }

  /** Platform position `f` frames ahead (exact for platforms that can predict themselves). */
  private future(s: SolidBox, f: number): { x: number; top: number } {
    const q = s.predict ? s.predict(f) : { x: s.x + s.dx * f, y: s.y + s.dy * f };
    return { x: q.x, top: q.y - s.hh };
  }

  /**
   * A platform we can land on if we jump now: simulate the jump arc frame by frame
   * and check that, when we come down to the platform's height, it is within the
   * range we can steer to.
   */
  private pickPlatform(plats: SolidBox[]): SolidBox | null {
    const p = this.act.leader;
    const c = p.c;
    for (const s of plats) {
      let y = p.y + p.hr,
        vy = -c.jump;
      for (let t = 1; t < 90; t++) {
        y += vy;
        vy += c.grv;
        const f = this.future(s, t);
        if (vy > 0 && y >= f.top - 2) {
          if (y - f.top > 12) break; // fell past it
          const maxX = p.x + Math.min(c.top * t, Math.max(p.xsp, 0) * t + (c.air * t * t) / 2);
          const minX = p.x + Math.max(-c.top * t, Math.min(p.xsp, 0) * t - (c.air * t * t) / 2);
          if (f.x + s.hw - 8 > minX && f.x - s.hw + 8 < maxX && f.x > p.x + 8) return s;
          break;
        }
      }
    }
    return null;
  }

  /** Solid objects that could be landed on ahead of the player. */
  private platformsAhead(): SolidBox[] {
    const p = this.act.leader;
    const feet = p.y + p.hr;
    const out: SolidBox[] = [];
    for (const o of this.act.objects) {
      const s = o.solid;
      if (!s || o.dead || s === p.onObject) continue;
      if (o.constructor.name === 'Spikes') continue;
      const top = s.y - s.hh;
      if (s.x > p.x + 8 && s.x < p.x + 320 && top > feet - 100 && top < feet + 160) out.push(s);
    }
    return out.sort((a, b) => a.x - b.x);
  }

  next(): number {
    const a = this.act;
    const p = a.leader;

    // Boss fight: stay under the pod and keep jumping into it.
    const boss = a.objects.find((o): o is Boss => o instanceof Boss);
    if (boss && boss.active) {
      const dx = boss.x - p.x;
      let held = Math.abs(dx) > 12 ? (dx > 0 ? Btn.Right : Btn.Left) : 0;
      if (p.grounded && Math.abs(dx) < 48 && a.frame % 20 === 0) held |= Btn.A;
      else if (!p.grounded && p.jumping) held |= Btn.A;
      return held;
    }
    if (a.bossActive) return 0; // boss leaving: wait

    // Landed: drop the rest of any jump script and the old target.
    if (p.grounded && this.airFrames > 3) this.script = [];
    if (p.grounded) this.target = null;
    this.airFrames = p.grounded ? 0 : this.airFrames + 1;
    if (this.script.length) return this.script.shift()!;

    // Riding a moving platform: stay near its middle until the next landing is in reach.
    const moving = p.onObject && (p.onObject.predict || p.onObject.dx || p.onObject.dy);
    if (p.grounded && moving && !this.target) {
      const ride = p.onObject!;
      const pick = this.pickPlatform(this.platformsAhead());
      if (pick) {
        this.target = pick;
        this.script = [];
        return Btn.A;
      }
      const feetY = p.y + p.hr;
      for (let x = p.x + 30; x < p.x + 150; x += 8) {
        if (x > ride.x + ride.hw && this.terrainAt(x, feetY - 90, 160)) {
          this.script = Array(30).fill(Btn.A | Btn.Right);
          return Btn.A | Btn.Right;
        }
      }
      return p.x < ride.x - 6 ? Btn.Right : p.x > ride.x + 6 ? Btn.Left : 0;
    }

    // Steering toward a platform we jumped at.
    if (!p.grounded && this.target) {
      const tg = this.target;
      const hold = p.jumping && p.ysp < 0 ? Btn.A : 0;
      // When will we be back down at the platform's height? Aim for where it will be then.
      let y = p.y + p.hr,
        vy = p.ysp,
        aim = tg.x;
      for (let t = 1; t < 120; t++) {
        y += vy;
        vy += p.c.grv;
        const f = this.future(tg, t);
        if (vy > 0 && y >= f.top - 2) {
          aim = f.x;
          break;
        }
      }
      const stopDist = (p.xsp * Math.abs(p.xsp)) / (2 * p.c.air);
      if (p.x + stopDist < aim - 3) return Btn.Right | hold;
      if (p.x + stopDist > aim + 3) return Btn.Left | hold;
      return hold;
    }
    if (p.grounded) this.target = null;

    // Progress tracking: stuck when we haven't got any further right for a while.
    if (p.x > this.lastX + 4 || this.waiting > 0) {
      this.lastX = p.x;
      this.stuck = 0;
    } else this.stuck++;
    if (this.waiting > 0) this.waiting--;

    const feet = p.y + p.hr;
    const flat = p.angle < 20 || p.angle > 340;
    if (p.grounded && !p.noClip && flat) {
      // Gaps are judged on terrain and static objects (bridges); moving platforms are handled separately.
      const gapAhead = !this.groundAt(p.x + 40, feet - 4, 96) && !this.groundAt(p.x + 24, feet - 4, 96);
      if (gapAhead) {
        // Ground beyond the gap?
        let landX = -1;
        for (let x = p.x + 40; x < p.x + 260; x += 8) {
          if (this.terrainAt(x, feet - 90, 200)) {
            landX = x;
            break;
          }
        }
        const plats = this.platformsAhead();
        const pick = this.pickPlatform(plats);
        if (pick) {
          this.target = pick;
          this.script = [];
          return Btn.A;
        }
        if (landX >= 0 && landX - p.x < 150) {
          this.script = Array(30).fill(Btn.A | Btn.Right);
          return Btn.A | Btn.Right;
        }
        // Wait at the edge for a platform to come round.
        this.waiting = 2;
        return Math.abs(p.gsp) > 0.5 ? Btn.Left : 0;
      }
    }

    if (this.stuck > 45 && p.grounded) {
      this.stuck = 0;
      this.lastX = p.x;
      this.tries++;
      if (this.tries % 3 !== 0) {
        this.script = Array(28).fill(Btn.A | Btn.Right);
      } else {
        // Spindash
        this.script = [
          ...Array(3).fill(Btn.Down),
          ...[0, 1, 2, 3, 4].flatMap(() => [Btn.Down | Btn.A, Btn.Down]),
          0,
          ...Array(20).fill(Btn.Right),
        ];
      }
      return this.script.shift()!;
    }
    return Btn.Right;
  }
}
