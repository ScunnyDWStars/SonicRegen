import type { CharacterDef } from './Player';
import { SONIC } from './sonic';
import type { CharId } from './types';

// Tails and Knuckles get their full move sets in their own modules (step 5); until
// then they share Sonic's physics with their own sizes and jump heights.
const TAILS: CharacterDef = { ...SONIC, id: 'tails', name: 'TAILS', standHr: 15 };
const KNUCKLES: CharacterDef = { ...SONIC, id: 'knuckles', name: 'KNUCKLES', jump: 6 };

export const CHARACTERS: Record<CharId, CharacterDef> = { sonic: SONIC, tails: TAILS, knuckles: KNUCKLES };
