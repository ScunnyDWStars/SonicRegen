import { describe, expect, it } from 'vitest';
import { ZONES } from '../src/zones/all';
import { jungleState } from '../src/zones/jungle-isle/theme';
import { Btn, flatZone, frames, G, playAct } from './act-helpers';

const jungle = ZONES.find((z) => z.id === 'jungle-isle')!;

describe('Jungle Isle', () => {
  it('starts lush and burns when you reach the fire-bombing point', () => {
    const { game, act } = playAct(jungle, 'sonic', 0);
    expect(jungleState.burnt).toBe(false);
    act.warp(5320, 1300);
    frames(game, 20, Btn.Right);
    expect(jungleState.burnt).toBe(true);
  });

  it('act 2 is burnt and has water', () => {
    const { act } = playAct(jungle, 'sonic', 1);
    expect(jungleState.burnt).toBe(true);
    expect(act.waterY).toBeLessThan(act.level.height);
  });

  it('ziplines carry the player down the rope and release at the end', () => {
    const { game, act } = playAct(flatZone((b) => b.place('zipline', 300, G - 80, { x1: 900, y1: G - 60 })));
    act.leader.x = 300;
    act.leader.y = G - 80 + 24;
    act.leader.grounded = false;
    let rode = false;
    let maxX = 0;
    for (let i = 0; i < 300; i++) {
      frames(game, 1);
      rode ||= act.leader.action === 'carried';
      maxX = Math.max(maxX, act.leader.x);
    }
    expect(rode).toBe(true);
    expect(maxX).toBeGreaterThan(850);
    expect(act.leader.noClip).toBe(false);
  });

  it('Knuckles can climb the pillar to the upper ledge route', () => {
    const { game, act } = playAct(jungle, 'knuckles', 0);
    const k = act.leader;
    act.warp(3700, 1300);
    frames(game, 10);
    // Run, jump, glide into the pillar at x = 3900 and climb.
    let climbed = false;
    let t = 0;
    frames(game, 200, () => {
      t++;
      if (k.action === 'climb') climbed = true;
      if (climbed) return Btn.Up;
      // Full-height jump, then glide from the top of it.
      if (t >= 20 && t < 48) return Btn.Right | Btn.A;
      if (t === 48) return Btn.Right;
      return t > 48 ? Btn.Right | Btn.A : Btn.Right;
    });
    expect(climbed).toBe(true);
    frames(game, 400, Btn.Up);
    frames(game, 60, Btn.Right);
    expect(k.y).toBeLessThan(1500 - 320);
    expect(k.grounded).toBe(true);
  });
});
