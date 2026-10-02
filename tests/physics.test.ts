import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../src/level/builder';
import { Btn, makePlayer, run, SimWorld } from './helpers';

const FLOOR = 400;

function flatLevel(width = 4000) {
  const b = new LevelBuilder(width, 1024);
  b.terrain([
    [0, FLOOR],
    [width, FLOOR],
  ]);
  b.start = { x: 200, y: FLOOR - 20 };
  return b.build();
}

/** Drop the player onto the ground and let them settle. */
function settled(level = flatLevel(), x?: number) {
  const w = new SimWorld(level);
  const p = makePlayer(level, undefined, x);
  p.grounded = false;
  run(p, w, 30);
  return { p, w };
}

describe('ground movement (Sonic Physics Guide values)', () => {
  it('stands exactly on the floor', () => {
    const { p } = settled();
    expect(p.grounded).toBe(true);
    expect(Math.floor(p.y + p.hr)).toBe(FLOOR - 1);
    expect(p.angle).toBe(0);
  });

  it('accelerates by 0.046875 per frame up to a top speed of 6', () => {
    const { p, w } = settled();
    run(p, w, 10, Btn.Right);
    expect(p.gsp).toBeCloseTo(0.46875, 6);
    run(p, w, 200, Btn.Right);
    expect(p.gsp).toBe(6);
  });

  it('decelerates at 0.5 when reversing and turns around at -0.5', () => {
    const { p, w } = settled();
    run(p, w, 200, Btn.Right);
    run(p, w, 11, Btn.Left);
    expect(p.gsp).toBe(0.5);
    run(p, w, 1, Btn.Left);
    expect(p.gsp).toBe(-0.5);
  });

  it('applies friction when no direction is held', () => {
    const { p, w } = settled();
    run(p, w, 200, Btn.Right);
    run(p, w, 1, 0);
    expect(p.gsp).toBeCloseTo(6 - 0.046875, 6);
    run(p, w, 200, 0);
    expect(p.gsp).toBe(0);
  });
});

describe('jumping', () => {
  it('jumps with 6.5 px/frame and lands again', () => {
    const { p, w } = settled();
    let peak = p.y;
    run(p, w, 1, Btn.A);
    expect(p.grounded).toBe(false);
    expect(p.ysp).toBe(-6.5);
    run(p, w, 120, Btn.A, () => (peak = Math.min(peak, p.y)));
    expect(p.grounded).toBe(true);
    // Full jump is roughly v^2 / 2g ≈ 96 px (plus the 5 px roll offset).
    const rise = FLOOR - 20 - peak;
    expect(rise).toBeGreaterThan(85);
    expect(rise).toBeLessThan(110);
  });

  it('caps upward speed at 4 when jump is released early', () => {
    const { p, w } = settled();
    run(p, w, 1, Btn.A);
    run(p, w, 1, 0);
    expect(p.ysp).toBeCloseTo(-4 + 0.21875, 6);
  });

  it('cannot jump under a low ceiling', () => {
    const b = new LevelBuilder(2000, 1024);
    b.terrain([
      [0, FLOOR],
      [2000, FLOOR],
    ]);
    b.rect(0, FLOOR - 42, 2000, 4);
    b.start = { x: 200, y: FLOOR - 20 };
    const level = b.build();
    const { p, w } = settled(level);
    run(p, w, 1, Btn.A);
    expect(p.grounded).toBe(true);
  });
});

describe('rolling and spindash', () => {
  it('rolls when pressing down at speed and keeps going', () => {
    const { p, w } = settled();
    run(p, w, 100, Btn.Right);
    run(p, w, 1, Btn.Down);
    expect(p.ball).toBe(true);
    expect(p.action).toBe('roll');
    expect(p.hr).toBe(14);
  });

  it('releases a spindash at 8 + half the revs', () => {
    const { p, w } = settled();
    run(p, w, 2, Btn.Down);
    run(p, w, 1, Btn.Down | Btn.A); // start
    expect(p.action).toBe('spindash');
    run(p, w, 1, Btn.Down);
    run(p, w, 1, Btn.Down | Btn.A); // rev +2
    run(p, w, 1, Btn.Down);
    run(p, w, 1, Btn.Down | Btn.A); // rev +2 (minus decay)
    const rev = p.spinrev;
    run(p, w, 1, 0);
    expect(p.action).toBe('roll');
    expect(p.gsp).toBeCloseTo(8 + Math.floor(rev) / 2 - 0.0234375 * 0, 0);
    expect(p.gsp).toBeGreaterThanOrEqual(8.5);
  });
});

describe('walls and slopes', () => {
  it('stops at a wall', () => {
    const b = new LevelBuilder(2000, 1024);
    b.terrain([
      [0, FLOOR],
      [2000, FLOOR],
    ]);
    b.rect(600, FLOOR - 200, 64, 200);
    b.start = { x: 200, y: FLOOR - 20 };
    const level = b.build();
    const { p, w } = settled(level);
    run(p, w, 200, Btn.Right);
    expect(p.gsp).toBeLessThan(0.5);
    expect(p.x + 10).toBeLessThan(600);
    expect(p.x + 10).toBeGreaterThan(598);
    expect(p.pushing).toBe(true);
  });

  it('measures a 45 degree slope and slides down it', () => {
    const b = new LevelBuilder(3000, 1024);
    b.terrain([
      [0, FLOOR, 'linear'],
      [1000, FLOOR, 'linear'],
      [1300, FLOOR - 300, 'linear'],
      [3000, FLOOR - 300],
    ]);
    b.start = { x: 1150, y: FLOOR - 200 };
    const level = b.build();
    const w = new SimWorld(level);
    const p = makePlayer(level);
    p.grounded = false;
    run(p, w, 20);
    expect(p.grounded).toBe(true);
    expect(p.angle).toBeGreaterThan(40);
    expect(p.angle).toBeLessThan(50);
    run(p, w, 60, 0);
    expect(p.gsp).toBeLessThan(-1);
  });

  it('converts a fall onto a steep slope into ground speed', () => {
    const b = new LevelBuilder(3000, 1024);
    b.terrain([
      [0, FLOOR, 'linear'],
      [1000, FLOOR, 'linear'],
      [1300, FLOOR - 300, 'linear'],
      [3000, FLOOR - 300],
    ]);
    const level = b.build();
    const w = new SimWorld(level);
    const p = makePlayer(level, undefined, 1150, FLOOR - 400);
    p.grounded = false;
    p.ysp = 8;
    run(p, w, 40, 0, () => {});
    expect(p.grounded).toBe(true);
    expect(p.gsp).toBeLessThan(0); // pushed down the slope (to the left)
  });
});
