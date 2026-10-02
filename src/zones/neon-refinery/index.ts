import type { ZoneDef } from '../index';
import { buildRefineryAct1, buildRefineryAct2, setupRefineryAct2 } from './acts';
import { NEON_REFINERY } from './theme';
import './objects';
import './boss';
import '../../objects/badniks/refinery';

export const NEON_REFINERY_ZONE: ZoneDef = {
  id: 'neon-refinery',
  name: 'NEON REFINERY',
  game: 'SONIC 2',
  theme: NEON_REFINERY,
  acts: [{ build: buildRefineryAct1 }, { build: buildRefineryAct2, setup: setupRefineryAct2 }],
};
