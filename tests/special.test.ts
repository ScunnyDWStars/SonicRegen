import { describe, expect, it } from 'vitest';
import { Btn, Pad } from '../src/engine/input';
import { STAGES } from '../src/specialstage/layouts';
import { Cell, SIZE, StageLogic } from '../src/specialstage/logic';
import { flatZone, frames, playAct } from './act-helpers';

function runStage(L: StageLogic, n: number, held: number | ((f: number) => number) = 0): void {
  const pad = new Pad();
  for (let f = 0; f < n; f++) {
    pad.latch(typeof held === 'function' ? held(f) : held);
    L.update(pad);
  }
}

function emptyStage(): StageLogic {
  const L = new StageLogic(0);
  L.grid.fill(Cell.Empty);
  L.blueLeft = 0;
  L.ringsLeft = 0;
  return L;
}

describe('special stage', () => {
  it('has seven layouts with blue spheres and a clear start', () => {
    expect(STAGES).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      const L = new StageLogic(i);
      expect(L.blueLeft).toBeGreaterThan(20);
      for (let d = 0; d <= 2; d++) expect(L.cell(16, 16 - d)).toBe(Cell.Empty);
    }
  });

  it('turns blue spheres red and clears when none are left', () => {
    const L = emptyStage();
    for (let d = 2; d <= 4; d++) L.grid[(16 - d) * SIZE + 16] = Cell.Blue;
    L.blueLeft = 3;
    runStage(L, 60); // intro
    runStage(L, 200);
    expect(L.blueLeft).toBe(0);
    expect(L.state).toBe('clear');
    expect(L.cell(16, 14)).toBe(Cell.Red);
  });

  it('fails on a red sphere', () => {
    const L = emptyStage();
    L.grid[13 * SIZE + 16] = Cell.Red;
    L.grid[0] = Cell.Blue;
    L.blueLeft = 1;
    runStage(L, 61 + 80);
    expect(L.state).toBe('fail');
  });

  it('jumping clears a red sphere', () => {
    const L = emptyStage();
    L.grid[13 * SIZE + 16] = Cell.Red;
    L.grid[0] = Cell.Blue;
    L.blueLeft = 1;
    runStage(L, 61);
    // Jump just before reaching the red sphere's cell.
    runStage(L, 30);
    runStage(L, 1, Btn.A);
    runStage(L, 80);
    expect(L.state).toBe('run');
    expect(L.y).toBeLessThan(13);
  });

  it('turns 90 degrees at the next sphere centre', () => {
    const L = emptyStage();
    L.grid[0] = Cell.Blue;
    L.blueLeft = 1;
    runStage(L, 61);
    runStage(L, 1, Btn.Right);
    runStage(L, 40);
    expect(L.dir).toBe(1);
    expect(L.x).toBeGreaterThan(16);
  });

  it('bumpers send the player backwards', () => {
    const L = emptyStage();
    L.grid[14 * SIZE + 16] = Cell.Bumper;
    L.grid[0] = Cell.Blue;
    L.blueLeft = 1;
    runStage(L, 61 + 40);
    expect(L.moveSign).toBe(-1);
    const y = L.y;
    runStage(L, 20);
    expect(L.y).toBeGreaterThan(y);
  });
});

describe('Super forms', () => {
  it('transform with all emeralds and 50 rings, then drain rings', () => {
    const { game, act } = playAct(flatZone(() => {}));
    const p = act.leader;
    p.canGoSuper = true;
    p.rings = 51;
    frames(game, 1, Btn.A);
    frames(game, 3, 0);
    frames(game, 1, Btn.A);
    expect(p.superForm).toBe(true);
    frames(game, 1);
    expect(p.c.top).toBe(10);
    frames(game, 130);
    expect(p.rings).toBeLessThanOrEqual(49);
    // Invulnerable while super.
    expect(p.hurt(act, p.x + 10)).toBe(false);
  });

  it('cannot transform without the emeralds', () => {
    const { game, act } = playAct(flatZone(() => {}));
    const p = act.leader;
    p.rings = 60;
    frames(game, 1, Btn.A);
    frames(game, 3, 0);
    frames(game, 1, Btn.A);
    expect(p.superForm).toBe(false);
  });
});
