import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../src/level/builder';
import { KNUCKLES } from '../src/player/knuckles';
import { TAILS } from '../src/player/tails';
import { Btn, makePlayer, run, SimWorld } from './helpers';
import { flatZone, frames, G, playAct } from './act-helpers';

const FLOOR = 600;

function level(fn?: (b: LevelBuilder) => void) {
  const b = new LevelBuilder(4000, 1024);
  b.terrain([
    [0, FLOOR],
    [4000, FLOOR],
  ]);
  fn?.(b);
  b.start = { x: 200, y: FLOOR - 30 };
  return b.build();
}

describe('Tails', () => {
  it('flies after a double jump and can climb by tapping jump', () => {
    const lvl = level();
    const w = new SimWorld(lvl);
    const p = makePlayer(lvl, TAILS);
    p.grounded = false;
    run(p, w, 20);
    run(p, w, 20, Btn.A); // jump, hold
    run(p, w, 2, 0);
    run(p, w, 1, Btn.A); // second press: fly
    expect(p.action).toBe('fly');
    const y0 = p.y;
    run(p, w, 120, (f) => (f % 12 === 0 ? Btn.A : 0));
    expect(p.y).toBeLessThan(y0 - 20);
  });

  it('gets tired after 8 seconds and lands', () => {
    const lvl = level();
    const w = new SimWorld(lvl);
    const p = makePlayer(lvl, TAILS);
    p.grounded = false;
    run(p, w, 20);
    run(p, w, 10, Btn.A);
    run(p, w, 2, 0);
    run(p, w, 1, Btn.A);
    run(p, w, 480, (f) => (f % 12 === 0 ? Btn.A : 0));
    expect(p.actionTimer).toBe(0);
    run(p, w, 600, 0);
    expect(p.grounded).toBe(true);
  });
});

describe('Knuckles', () => {
  it('jumps lower than Sonic', () => {
    expect(KNUCKLES.jump).toBe(6);
  });

  it('glides, grabs a wall and climbs over the top', () => {
    const lvl = level((b) => b.rect(700, FLOOR - 160, 200, 160));
    const w = new SimWorld(lvl);
    const p = makePlayer(lvl, KNUCKLES, 400);
    p.grounded = false;
    run(p, w, 20);
    run(p, w, 1, Btn.Right | Btn.A);
    run(p, w, 8, Btn.Right | Btn.A);
    run(p, w, 1, Btn.Right);
    run(p, w, 1, Btn.Right | Btn.A); // glide
    expect(p.action).toBe('glide');
    let grabbed = false;
    run(p, w, 200, Btn.Right | Btn.A, () => (grabbed ||= p.action === 'climb'));
    expect(grabbed).toBe(true);
    run(p, w, 300, Btn.Up);
    expect(p.grounded).toBe(true);
    expect(p.y).toBeLessThan(FLOOR - 160);
  });

  it('slides along the ground after landing from a glide', () => {
    const lvl = level();
    const w = new SimWorld(lvl);
    const p = makePlayer(lvl, KNUCKLES);
    p.grounded = false;
    run(p, w, 20);
    run(p, w, 1, Btn.Right | Btn.A);
    run(p, w, 3, Btn.Right | Btn.A);
    run(p, w, 1, Btn.Right);
    run(p, w, 1, Btn.Right | Btn.A);
    let slid = false;
    run(p, w, 200, Btn.Right | Btn.A, () => (slid ||= p.action === 'slide'));
    expect(slid).toBe(true);
  });
});

describe('Sidekick Tails', () => {
  it('follows Sonic across a level', () => {
    const { game, act } = playAct(
      flatZone(() => {}),
      'sonic+tails',
    );
    expect(act.players).toHaveLength(2);
    frames(game, 400, Btn.Right);
    const [s, t] = act.players;
    expect(Math.abs(s!.x - t!.x)).toBeLessThan(160);
    // When Sonic stops, Tails catches up.
    frames(game, 240, 0);
    expect(Math.abs(s!.x - t!.x)).toBeLessThan(48);
  });

  it('respawns by flying in after falling into a pit', () => {
    const { game, act } = playAct(
      flatZone(() => {}),
      'sonic+tails',
    );
    const t = act.players[1]!;
    t.die(act);
    frames(game, 200);
    expect(t.dead).toBe(false);
    frames(game, 600);
    expect(Math.abs(t.x - act.leader.x)).toBeLessThan(64);
  });

  it('carries Sonic when he jumps holding Up next to Tails', () => {
    const { game, act } = playAct(
      flatZone(() => {}),
      'sonic+tails',
    );
    frames(game, 60);
    const t = act.players[1]!;
    t.x = act.leader.x;
    t.y = act.leader.y + (act.leader.hr - t.hr);
    frames(game, 5, Btn.Up);
    frames(game, 1, Btn.Up | Btn.A);
    expect(act.leader.action).toBe('carried');
    const y0 = act.leader.y;
    frames(game, 90, Btn.Up);
    expect(act.leader.y).toBeLessThan(y0 - 16);
    frames(game, 1, Btn.A);
    expect(act.leader.action).toBe('jump');
    void G;
  });
});
