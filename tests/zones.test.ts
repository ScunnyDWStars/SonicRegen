import { describe, expect, it } from 'vitest';
import { knownObjectTypes } from '../src/objects/base';
import { Boss } from '../src/objects/bosses/boss';
import { ZONES } from '../src/zones/all';
import { Btn, dropAt, flatZone, frames, G, playAct } from './act-helpers';

describe.each(ZONES.map((z) => [z.name, z] as const))('%s', (_name, zone) => {
  it('builds every act with known objects and a start on solid ground', () => {
    const known = new Set(knownObjectTypes());
    for (const a of zone.acts) {
      const lvl = a.build();
      for (const s of lvl.spawns) expect(known.has(s.type), s.type).toBe(true);
      let y = lvl.start.y + 20;
      const y0 = y;
      while (y < lvl.height && !(lvl.map.get(lvl.start.x, y) & 3)) y++;
      expect(y - y0).toBeLessThan(64);
      expect(lvl.spawns.some((s) => s.type === 'signpost' || s.type === 'capsule')).toBe(true);
    }
  });

  it('runs the final boss fight through to the capsule', () => {
    const last = zone.acts.length - 1;
    const trig = zone.acts[last]!.build().spawns.find((s) => s.type === 'bossTrigger')!;
    expect(trig).toBeDefined();
    const { game, act } = playAct(zone, 'sonic', last);
    act.leader.rings = 50;
    act.warp(trig.x + 180, trig.y - 300);
    let boss: Boss | undefined;
    for (let i = 0; i < 300 && !boss; i++) {
      frames(game, 1);
      boss = act.objects.find((o): o is Boss => o instanceof Boss);
    }
    expect(boss).toBeDefined();
    expect(act.bossActive).toBe(true);
    for (let i = 0; i < 8; i++) {
      boss!.flash = 0;
      boss!.hit(act);
    }
    expect(boss!.state).toBe('defeated');
    act.leader.invincible = 2000;
    frames(game, 700);
    expect(act.bossActive).toBe(false);
    const cap = act.objects.find((o) => o.constructor.name === 'Capsule')!;
    dropAt(game, cap.x, cap.y - 80);
    frames(game, 200);
    expect(act.state).toBe('clear');
  });
});

describe('Neon Refinery gimmicks', () => {
  it('transport tubes carry the player along their path', () => {
    const { game, act } = playAct(
      flatZone((b) =>
        b.place('tube', 300, G - 19, {
          path: [
            [0, 0],
            [200, 0],
            [200, -200],
            [300, -200],
          ],
          speed: 10,
        }),
      ),
    );
    act.leader.gsp = 4;
    let rode = false;
    let minY = Infinity;
    for (let i = 0; i < 200; i++) {
      frames(game, 1, Btn.Right);
      rode ||= act.leader.noClip;
      minY = Math.min(minY, act.leader.y);
    }
    expect(rode).toBe(true);
    expect(minY).toBeLessThan(G - 200);
    expect(act.leader.noClip).toBe(false);
  });

  it('speed boosters fire the player at 16 px/frame', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('speedBooster', 200, 4, { dir: 1 })));
    let max = 0;
    for (let i = 0; i < 100; i++) {
      frames(game, 1, Btn.Right);
      max = Math.max(max, act.leader.gsp);
    }
    expect(max).toBe(16);
  });

  it('the act 2 chemical rises once you are in the basin', () => {
    const zone = ZONES.find((z) => z.id === 'neon-refinery')!;
    const { game, act } = playAct(zone, 'sonic', 1);
    const y0 = act.waterY;
    act.warp(2300, 2000);
    frames(game, 300);
    expect(act.waterY).toBeLessThan(y0 - 100);
  });
});
