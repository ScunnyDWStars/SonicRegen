import { describe, expect, it } from 'vitest';
import { knownObjectTypes } from '../src/objects/base';
import { Boss } from '../src/objects/bosses/boss';
import { ZONES } from '../src/zones/all';
import { dropAt, frames, playAct } from './act-helpers';

const palm = ZONES.find((z) => z.id === 'palm-coast')!;

describe('Palm Coast', () => {
  it('builds both acts with only known object types', () => {
    const known = new Set(knownObjectTypes());
    for (const a of palm.acts) {
      const lvl = a.build();
      for (const s of lvl.spawns) expect(known.has(s.type), s.type).toBe(true);
      // The start position is above solid ground.
      const y0 = lvl.start.y + 20;
      let y = y0;
      while (y < lvl.height && !(lvl.map.get(lvl.start.x, y) & 3)) y++;
      expect(y - y0).toBeLessThan(64);
    }
  });

  it('runs the boss fight to the capsule', () => {
    const { game, act } = playAct(palm, 'sonic', 1);
    act.leader.rings = 50;
    act.warp(10420, 1100);
    let boss: Boss | undefined;
    for (let i = 0; i < 300 && !boss; i++) {
      frames(game, 1);
      boss = act.objects.find((o): o is Boss => o instanceof Boss);
    }
    expect(boss).toBeDefined();
    expect(act.bossActive).toBe(true);
    expect(act.camera.maxX).toBe(10240 + 448 - 320);
    for (let i = 0; i < 8; i++) {
      boss!.flash = 0;
      boss!.hit(act);
    }
    expect(boss!.state).toBe('defeated');
    frames(game, 600);
    expect(act.bossActive).toBe(false);
    expect(act.objects.includes(boss!)).toBe(false);
    // Walk to the capsule and press its button.
    const cap = act.objects.find((o) => o.constructor.name === 'Capsule')!;
    dropAt(game, cap.x, cap.y - 80);
    frames(game, 200);
    expect(act.state).toBe('clear');
  });
});
