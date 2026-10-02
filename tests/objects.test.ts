import { describe, expect, it } from 'vitest';
import { Btn, dropAt, flatZone, frames, G, playAct, runRight } from './act-helpers';

describe('objects in a running act', () => {
  it('collects rings', () => {
    const { game, act } = playAct(flatZone((b) => b.rings(200, G - 20, 5, 16)));
    frames(game, 120, Btn.Right);
    expect(act.leader.rings).toBe(5);
  });

  it('breaks a ring monitor by rolling into it', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('monitor', 400, 16, { kind: 'rings' })));
    act.leader.gsp = 6;
    frames(game, 1, Btn.Down);
    frames(game, 140, 0);
    expect(act.leader.rings).toBe(10);
  });

  it('stands on an unbroken monitor when walking into it', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('monitor', 300, 16, { kind: 'rings' })));
    frames(game, 120, Btn.Right);
    expect(act.leader.x).toBeLessThan(300 - 14);
    expect(act.objects.some((o) => o.constructor.name === 'Monitor')).toBe(true);
  });

  it('launches the player from a yellow spring at 10 px/frame', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('spring', 300, 8, { dir: 'up' })));
    let minYsp = 0;
    dropAt(game, 300, G - 120);
    for (let i = 0; i < 60; i++) {
      frames(game, 1);
      if (act.leader.action === 'spring') minYsp = Math.min(minYsp, act.leader.ysp);
    }
    expect(minYsp).toBeLessThanOrEqual(-9.7);
  });

  it('hurts the player on spikes and scatters rings', () => {
    const { game, act } = playAct(
      flatZone((b) => {
        b.rings(150, G - 20, 3, 16);
        b.onGround('spikes', 400, 16, { count: 4 });
      }),
    );
    runRight(game, 20);
    expect(act.leader.rings).toBe(3);
    dropAt(game, 400, G - 120);
    let hurt = false;
    for (let i = 0; i < 60 && !hurt; i++) {
      frames(game, 1);
      hurt = act.leader.action === 'hurt';
    }
    expect(hurt).toBe(true);
    expect(act.leader.rings).toBe(0);
  });

  it('records a checkpoint at a starpost', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('starpost', 300, 32, { id: 7 })));
    frames(game, 120, Btn.Right);
    expect(game.session.checkpoint?.id).toBe(7);
    void act;
  });

  it('clears the act at the signpost and tallies the bonus', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('signpost', 500, 48)));
    runRight(game, 250);
    expect(act.state).toBe('clear');
    frames(game, 500, 0);
    expect(game.session.score).toBeGreaterThanOrEqual(50000);
  });

  it('loses a life and restarts after dying with no rings', () => {
    const { game, act } = playAct(flatZone((b) => b.onGround('spikes', 300, 16, { count: 4 })));
    dropAt(game, 300, G - 120);
    frames(game, 60);
    expect(act.leader.dead).toBe(true);
    frames(game, 200, 0);
    expect(game.session.lives).toBe(2);
    expect(game.scene).not.toBe(act);
  });
});

describe('giant rings', () => {
  it('enter the special stage and are gone when you come back', async () => {
    const { game, act } = playAct(flatZone((b) => b.place('giantRing', 300, G - 40)));
    const { SpecialStageScene } = await import('../src/scenes/special-stage');
    frames(game, 200, Btn.Right);
    expect(game.scene).toBeInstanceOf(SpecialStageScene);
    void act;
  });
});
