/**
 * A small Music Macro Language parser, used to write the game's original music.
 *
 *   o4      set octave            >  <   octave up / down
 *   l8      default note length    c d e f g a b   notes (+ or # sharp, - flat)
 *   c4.     note with length and dot          r   rest
 *   v12     volume 0-15            @3   instrument
 *   q6      gate: note sounds for 6/8 of its length
 *   [ ... ]3  repeat a section 3 times
 *   &       tie into the next note (extends without re-triggering)
 *
 * Lengths are note values: 1 = whole note, 4 = quarter, 8 = eighth, 16 = sixteenth.
 */

export interface NoteEvent {
  /** Start time in beats (quarter notes). */
  t: number;
  /** Sounding duration in beats. */
  dur: number;
  /** MIDI note number, or -1 for a rest. */
  note: number;
  vol: number;
  inst: number;
}

export interface ParsedChannel {
  events: NoteEvent[];
  /** Total length in beats. */
  length: number;
}

const NOTE_OFFSETS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function expandLoops(src: string): string {
  // Expand innermost [ ... ]N repeatedly.
  let s = src;
  const re = /\[([^[\]]*)\](\d*)/;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(s)) && guard++ < 1000) {
    const n = m[2] ? parseInt(m[2], 10) : 2;
    s = s.slice(0, m.index) + ` ${m[1]} `.repeat(n) + s.slice(m.index + m[0].length);
  }
  return s;
}

export function parseMML(src: string, defaultInst = 0): ParsedChannel {
  const s = expandLoops(src.toLowerCase());
  const events: NoteEvent[] = [];
  let i = 0;
  let octave = 4;
  let len = 8;
  let vol = 12;
  let inst = defaultInst;
  let gate = 7;
  let t = 0;
  let tie = false;

  const readInt = (): number | null => {
    let j = i;
    while (j < s.length && s[j]! >= '0' && s[j]! <= '9') j++;
    if (j === i) return null;
    const v = parseInt(s.slice(i, j), 10);
    i = j;
    return v;
  };
  const readLength = (): number => {
    const n = readInt();
    let beats = 4 / (n ?? len);
    let add = beats / 2;
    while (s[i] === '.') {
      beats += add;
      add /= 2;
      i++;
    }
    return beats;
  };

  while (i < s.length) {
    const ch = s[i++]!;
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '|') continue;
    if (ch === 'o') octave = readInt() ?? octave;
    else if (ch === '>') octave++;
    else if (ch === '<') octave--;
    else if (ch === 'l') len = readInt() ?? len;
    else if (ch === 'v') vol = readInt() ?? vol;
    else if (ch === '@') inst = readInt() ?? inst;
    else if (ch === 'q') gate = readInt() ?? gate;
    else if (ch === '&') tie = true;
    else if (ch === 'r') {
      const d = readLength();
      t += d;
      tie = false;
    } else if (ch in NOTE_OFFSETS) {
      let n = NOTE_OFFSETS[ch]!;
      while (s[i] === '+' || s[i] === '#' || s[i] === '-') n += s[i++] === '-' ? -1 : 1;
      const d = readLength();
      const midi = 12 * (octave + 1) + n;
      const prev = events[events.length - 1];
      if (tie && prev && prev.note === midi) {
        prev.dur = t + d * (gate / 8) - prev.t;
      } else {
        events.push({ t, dur: d * (gate / 8), note: midi, vol, inst });
      }
      tie = false;
      t += d;
    }
  }
  return { events, length: t };
}

export function midiToHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}
