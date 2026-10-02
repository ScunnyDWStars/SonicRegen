import { describe, expect, it } from 'vitest';
import { parseMML } from '../src/audio/mml';
import { SONGS } from '../src/audio/songs';

describe('MML', () => {
  it('parses notes, lengths, dots, octaves, rests and loops', () => {
    const p = parseMML('o4 l8 c d4 e4. r8 > c < [g]3');
    expect(p.events.map((e) => e.note)).toEqual([60, 62, 64, 72, 67, 67, 67]);
    expect(p.events[1]!.t).toBeCloseTo(0.5);
    expect(p.events[2]!.t).toBeCloseTo(1.5);
    // c8 + d4 + e4. + r8 + c8 + 3 × g8 = 0.5+1+1.5+0.5+0.5+1.5
    expect(p.length).toBeCloseTo(5.5);
  });

  it('applies sharps, flats, volume and instruments', () => {
    const p = parseMML('o4 v9 @3 c+4 b-4');
    expect(p.events.map((e) => e.note)).toEqual([61, 70]);
    expect(p.events[0]!.vol).toBe(9);
    expect(p.events[0]!.inst).toBe(3);
  });
});

describe('songs', () => {
  it.each(Object.entries(SONGS))('%s parses and looping channels line up', (_name, song) => {
    const lens = song.channels.map((c) => parseMML(c.mml, c.inst).length);
    for (const l of lens) {
      expect(Number.isFinite(l)).toBe(true);
      expect(l).toBeGreaterThan(0);
    }
    if (song.loop) for (const l of lens) expect(l).toBeCloseTo(lens[0]!, 5);
  });
});
