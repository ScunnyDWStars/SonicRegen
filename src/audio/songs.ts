/**
 * Original music for the game, written in MML (see mml.ts). Instruments:
 *   0 pulse 50%  1 pulse 25%  2 triangle  3 FM bass  4 FM lead  5 FM bell
 *   6 saw pad    7 FM organ   8 drums (c kick, d snare, f+ hat, a open hat, b crash, e tom)
 */

export interface SongChannel {
  inst: number;
  mml: string;
}

export interface Song {
  bpm: number;
  loop: boolean;
  channels: SongChannel[];
}

const NAMES = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b'];
const ROOTS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** Chord symbol like "Am", "F", "Bb", "E7", "F#m" -> MIDI root (octave 0) and intervals. */
function chord(sym: string): { root: number; tones: number[] } {
  const m = /^([A-G])([b#]?)(m?)(7?)$/.exec(sym);
  if (!m) throw new Error(`bad chord ${sym}`);
  let root = ROOTS[m[1]!.toLowerCase()]!;
  if (m[2] === 'b') root -= 1;
  if (m[2] === '#') root += 1;
  const tones = m[3] ? [0, 3, 7] : [0, 4, 7];
  if (m[4]) tones.push(10);
  return { root: (root + 12) % 12, tones };
}

/** One note as an absolute-octave MML token. */
function tok(midi: number, len: number | string): string {
  const oct = Math.floor(midi / 12) - 1;
  return `o${oct}${NAMES[midi % 12]}${len}`;
}

/** Eighth-note bass line, one chord per bar: root, root, octave, root, fifth, root, octave, root. */
function bass(chords: string[], octave = 2): string {
  return chords
    .map((c) => {
      const { root, tones } = chord(c);
      const r = 12 * (octave + 1) + root;
      const fifth = r + tones[2]!;
      return [r, r, r + 12, r, fifth, r, r + 12, r].map((n) => tok(n, 8)).join(' ');
    })
    .join(' | ');
}

/** Driving bass: steady eighths with an octave jump on the off-beats. */
function bassOctaves(chords: string[], octave = 2): string {
  return chords
    .map((c) => {
      const r = 12 * (octave + 1) + chord(c).root;
      return [r, r + 12, r, r + 12, r, r + 12, r, r + 12].map((n) => tok(n, 8)).join(' ');
    })
    .join(' | ');
}

/** Sixteenth-note arpeggio over each chord (one bar per chord). */
function arp(chords: string[], octave = 5, pattern = [0, 1, 2, 1]): string {
  return chords
    .map((c) => {
      const { root, tones } = chord(c);
      const base = 12 * (octave + 1) + root;
      const notes = [...tones.map((t) => base + t), base + 12];
      const out: string[] = [];
      for (let i = 0; i < 16; i++) out.push(tok(notes[pattern[i % pattern.length]!]!, 16));
      return out.join(' ');
    })
    .join(' | ');
}

/** Held pad chords: three notes stacked by playing them on three channels. */
function padVoice(chords: string[], voice: number, octave = 4): string {
  return chords
    .map((c) => {
      const { root, tones } = chord(c);
      return tok(12 * (octave + 1) + root + tones[voice % tones.length]!, 1);
    })
    .join(' ');
}

/** Repeat a one-bar drum pattern. */
function drums(bars: number, bar: string, fill?: string): string {
  const out: string[] = [];
  for (let i = 0; i < bars; i++) out.push(fill && i === bars - 1 ? fill : bar);
  return out.join(' | ');
}

const ROCK = 'o4 l8 c f+ d f+ c c d f+';
const ROCK_FILL = 'o4 l16 c8 f+8 d8 f+8 c8 d e d d e e';
const DISCO = 'o4 l8 c a d a c a d a';
const HALF = 'o4 l8 c f+ f+ f+ d f+ f+ f+';

const PALM_CHORDS = ['C', 'C', 'Am', 'G', 'F', 'Dm', 'G', 'C'];

export const SONGS: Record<string, Song> = {
  palmCoast: {
    bpm: 150,
    loop: true,
    channels: [
      {
        inst: 4,
        mml: `v13 o5 l8
          e g >c< b a g e g | a4 g e d4 c d | e g >c d e d c< b | >c2< g4 r4 |
          f a >c< b a f a >c< | d4 c< b a4 g a | g e f g a b >c d | e2 d4 r4`,
      },
      { inst: 3, mml: `v12 ${bass(PALM_CHORDS)}` },
      { inst: 5, mml: `v6 ${arp(PALM_CHORDS, 5, [0, 1, 2, 3, 2, 1])}` },
      { inst: 8, mml: `v10 ${drums(8, ROCK, ROCK_FILL)}` },
    ],
  },
  neonRefinery: {
    bpm: 140,
    loop: true,
    channels: [
      {
        inst: 1,
        mml: `v12 o5 l8
          d4 f e d c d f | a4 g f e4 d r | d f a >c< a4 g f | e2 c4 r4 |
          d4 f e d c d f | a4 >c< a+ a4 g f | g a a+ >c d4 c< a | d2 r2`,
      },
      { inst: 3, mml: `v13 ${bassOctaves(['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'])}` },
      { inst: 7, mml: `v5 ${padVoice(['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'], 1)}` },
      { inst: 8, mml: `v10 ${drums(8, DISCO, ROCK_FILL)}` },
    ],
  },
  jungleIsle: {
    bpm: 136,
    loop: true,
    channels: [
      {
        inst: 4,
        mml: `v13 o5 l8
          g4 b >d< b4 a g | e4 g a b a g e | d e g a b4 >d< b | a2 g4 r4 |
          >c4 e g< >c< b a g | a4 f+ a >d4 c< b | g b >d e d c< b a | g2 r2`,
      },
      { inst: 3, mml: `v12 ${bass(['G', 'G', 'Em', 'Em', 'C', 'D', 'G', 'D'])}` },
      { inst: 5, mml: `v6 ${arp(['G', 'G', 'Em', 'Em', 'C', 'D', 'G', 'D'], 5, [0, 2, 1, 2])}` },
      { inst: 8, mml: `v10 ${drums(8, HALF, ROCK_FILL)}` },
    ],
  },
  jungleIsleFire: {
    bpm: 150,
    loop: true,
    channels: [
      {
        inst: 1,
        mml: `v12 o5 l8
          e4 g f+ e d e g | b4 a g f+4 e r | e g b >e d4 c< b | a2 b4 r4 |
          e4 g f+ e d e g | b4 a g f+4 e r | c e g b a g f+ e | d+2 e4 r4`,
      },
      { inst: 3, mml: `v13 ${bassOctaves(['Em', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'B'])}` },
      { inst: 6, mml: `v4 ${padVoice(['Em', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'B'], 2)}` },
      { inst: 8, mml: `v11 ${drums(8, ROCK, ROCK_FILL)}` },
    ],
  },
  boss: {
    bpm: 160,
    loop: true,
    channels: [
      { inst: 1, mml: `v12 o5 l8 [a >c< b a e4 a4 | f4 e d e4 r4 | a >c e d c< b a g+ | a2 e2]2` },
      { inst: 3, mml: `v13 ${bassOctaves(['Am', 'Am', 'F', 'E', 'Am', 'Am', 'F', 'E'])}` },
      { inst: 7, mml: `v5 ${padVoice(['Am', 'Am', 'F', 'E', 'Am', 'Am', 'F', 'E'], 1, 4)}` },
      { inst: 8, mml: `v11 ${drums(8, 'o4 l8 c c d c c c d d')}` },
    ],
  },
  invincible: {
    bpm: 176,
    loop: true,
    channels: [
      { inst: 0, mml: `v12 o5 l8 f a >c< a >d c< a f | g a+ >d< a+ >e d< a+ g | a >c f c g e c< a | f2 r2` },
      { inst: 3, mml: `v12 ${bassOctaves(['F', 'Bb', 'C', 'F'])}` },
      { inst: 8, mml: `v10 ${drums(4, DISCO)}` },
    ],
  },
  super: {
    bpm: 168,
    loop: true,
    channels: [
      {
        inst: 4,
        mml: `v13 o5 l8 d f+ a >d< a f+ d f+ | g b >d< b >e d< b g | a >c+ e a e c+< a >c+< | d2 r2`,
      },
      { inst: 3, mml: `v12 ${bassOctaves(['D', 'G', 'A', 'D'])}` },
      { inst: 5, mml: `v6 ${arp(['D', 'G', 'A', 'D'], 5)}` },
      { inst: 8, mml: `v10 ${drums(4, ROCK)}` },
    ],
  },
  special: {
    bpm: 150,
    loop: true,
    channels: [
      {
        inst: 5,
        mml: `v12 o5 l8 c e g e c e g >c< | a >c e c< a >c e c< | f a >c< a f a >c< a | g b >d< b g4 r4`,
      },
      { inst: 2, mml: `v13 ${bass(['C', 'Am', 'F', 'G'], 3)}` },
      { inst: 1, mml: `v5 ${arp(['C', 'Am', 'F', 'G'], 4)}` },
      { inst: 8, mml: `v9 ${drums(4, DISCO)}` },
    ],
  },
  actClear: {
    bpm: 150,
    loop: false,
    channels: [
      { inst: 4, mml: `v13 o5 l8 c e g >c4< g >c4 | d4 c< b >c2 r2` },
      { inst: 3, mml: `v12 o3 l8 c c g g c4 c4 | g4 g4 c2 r2` },
      { inst: 8, mml: `v10 o4 l8 c f+ d f+ c c d d | b2 r2` },
    ],
  },
  oneUp: {
    bpm: 140,
    loop: false,
    channels: [
      { inst: 0, mml: `v13 o5 l16 c e g >c< e g >c e g >c4. r8` },
      { inst: 2, mml: `v12 o3 l8 c g >c< g c2` },
    ],
  },
  gameOver: {
    bpm: 90,
    loop: false,
    channels: [
      { inst: 4, mml: `v12 o5 l4 a g f e | d2. r4` },
      { inst: 3, mml: `v12 o3 l2 f e | d1` },
    ],
  },
  title: {
    bpm: 130,
    loop: true,
    channels: [
      { inst: 4, mml: `v13 o5 l8 c4. e g4 >c4< | b4. a g2 | a4. >c< b4 g4 | >c2.< r4` },
      { inst: 3, mml: `v12 ${bass(['C', 'G', 'F', 'C'])}` },
      { inst: 5, mml: `v6 ${arp(['C', 'G', 'F', 'C'], 5)}` },
      { inst: 8, mml: `v9 ${drums(4, HALF)}` },
    ],
  },
  menu: {
    bpm: 110,
    loop: true,
    channels: [
      { inst: 5, mml: `v8 ${arp(['C', 'Am', 'F', 'G'], 5, [0, 1, 2, 3])}` },
      { inst: 2, mml: `v11 o3 l2 c c a a | f f g g` },
    ],
  },
  drowning: {
    bpm: 150,
    loop: false,
    channels: [
      {
        inst: 1,
        mml: `v12 o5 l16 [c c+ c c+ r8]2 [d d+ d d+ r8]2 [e f e f r8]2 [f+ g f+ g r8]2
              [g+ a g+ a r8]2 [a+ b a+ b r8]2 l32 [>c c+ c c+< r16]4 [>d d+ d d+< r16]4 r1`,
      },
      { inst: 3, mml: `v10 o2 l4 [c r]4 [d r]4 [e r]4 [f+ r]4 l8 [g+ r]4 [a+ r]4 r1` },
    ],
  },
  ending: {
    bpm: 112,
    loop: true,
    channels: [
      { inst: 4, mml: `v12 o5 l8 c4. e g4 >c4< | b4. a g2 | a4. >c< b4 g4 | >c1< ` },
      { inst: 7, mml: `v6 ${padVoice(['C', 'G', 'F', 'C'], 1, 4)}` },
      { inst: 2, mml: `v11 ${bass(['C', 'G', 'F', 'C'], 3)}` },
    ],
  },
};
