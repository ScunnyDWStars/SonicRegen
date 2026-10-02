import type { KeyMap } from '../engine/input';
import type { Session } from './session';

/** Persistent data lives in localStorage; every access is guarded (private mode, blocked storage). */
const SAVES_KEY = 'sonicRegen.saves.v1';
const OPTIONS_KEY = 'sonicRegen.options.v1';

export type SaveData = ReturnType<Session['toJSON']>;

export interface Options {
  music: number;
  sfx: number;
  /** 0 = fit to window, otherwise a fixed integer scale. */
  scale: number;
  keys: KeyMap | null;
}

export const DEFAULT_OPTIONS: Options = { music: 7, sfx: 8, scale: 0, keys: null };

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: progress simply isn't kept.
  }
}

export function loadSlots(): (SaveData | null)[] {
  const s = read<(SaveData | null)[]>(SAVES_KEY);
  const out: (SaveData | null)[] = [null, null, null];
  if (Array.isArray(s)) for (let i = 0; i < 3; i++) out[i] = s[i] ?? null;
  return out;
}

export function writeSlot(i: number, data: SaveData | null): void {
  const s = loadSlots();
  s[i] = data;
  write(SAVES_KEY, s);
}

export function loadOptions(): Options {
  return { ...DEFAULT_OPTIONS, ...(read<Partial<Options>>(OPTIONS_KEY) ?? {}) };
}

export function saveOptions(o: Options): void {
  write(OPTIONS_KEY, o);
}
