import type { ZoneDef } from '../index';
import { buildJungleAct1, buildJungleAct2, setupJungleAct1, setupJungleAct2 } from './acts';
import { JUNGLE_ISLE } from './theme';
import './objects';
import './boss';
import '../../objects/badniks/jungle';

export const JUNGLE_ISLE_ZONE: ZoneDef = {
  id: 'jungle-isle',
  name: 'JUNGLE ISLE',
  game: 'SONIC 3',
  theme: JUNGLE_ISLE,
  acts: [
    { build: buildJungleAct1, setup: setupJungleAct1 },
    { build: buildJungleAct2, setup: setupJungleAct2, music: 'jungleIsleFire' },
  ],
};
