import type { LevelData } from '../level/builder';
import type { Act } from '../game/act';
import type { ZoneTheme } from './theme';

export interface ActDef {
  build(): LevelData;
  /** Music override for this act. */
  music?: string;
  /** Extra per-act setup (scripts, water, camera locks). */
  setup?(act: Act): void;
}

export interface ZoneDef {
  id: string;
  name: string;
  /** Which Mega Drive game this zone pays homage to. */
  game: 'SONIC 1' | 'SONIC 2' | 'SONIC 3';
  theme: ZoneTheme;
  acts: ActDef[];
}
