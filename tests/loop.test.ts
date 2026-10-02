import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../src/level/builder';
import { Btn, makePlayer, resetSwapperState, run, SimWorld } from './helpers';

const FLOOR = 600;

function loopLevel(r = 96) {
  const b = new LevelBuilder(4000, 1024);
  b.terrain([
    [0, FLOOR],
    [4000, FLOOR],
  ]);
  b.loop(1500, FLOOR, r);
  b.start = { x: 300, y: FLOOR - 20 };
  return b.build();
}

function runLoop(speed: number, held: number, r = 96) {
  resetSwapperState();
  const level = loopLevel(r);
  const w = new SimWorld(level);
  const p = makePlayer(level);
  p.grounded = false;
  run(p, w, 20);
  p.gsp = speed;
  let minY = Infinity;
  let sawCeiling = false;
  let maxX = 0;
  run(p, w, 400, held, () => {
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    if (p.grounded && p.angle > 160 && p.angle < 200) sawCeiling = true;
  });
  return { p, minY, sawCeiling, maxX };
}

describe('loops', () => {
  it('runs all the way around a loop at speed and exits on the far side', () => {
    const { p, minY, sawCeiling } = runLoop(9, Btn.Right);
    expect(sawCeiling).toBe(true);
    expect(minY).toBeLessThan(FLOOR - 2 * 96 + 21); // centre is hr below the top surface
    expect(p.x).toBeGreaterThan(1800);
    expect(p.grounded).toBe(true);
    expect(p.layer).toBe(0);
  });

  it('works while rolling too', () => {
    resetSwapperState();
    const { p, sawCeiling } = runLoop(10, Btn.Down);
    expect(sawCeiling).toBe(true);
    expect(p.x).toBeGreaterThan(1800);
  });

  it('falls off the loop when too slow', () => {
    const { sawCeiling, maxX } = runLoop(4, 0);
    expect(sawCeiling).toBe(false);
    expect(maxX).toBeLessThan(1700);
  });
});
