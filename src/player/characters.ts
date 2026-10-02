import { KNUCKLES } from './knuckles';
import type { CharacterDef } from './Player';
import { SONIC } from './sonic';
import { TAILS } from './tails';
import type { CharId } from './types';

export const CHARACTERS: Record<CharId, CharacterDef> = { sonic: SONIC, tails: TAILS, knuckles: KNUCKLES };
