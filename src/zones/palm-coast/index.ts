import type { ZoneDef } from '../index';
import { buildPalmAct1, buildPalmAct2 } from './acts';
import { PALM_COAST } from './theme';
import './objects';
import './boss';
import '../../objects/badniks/palm';

export const PALM_COAST_ZONE: ZoneDef = {
  id: 'palm-coast',
  name: 'PALM COAST',
  game: 'SONIC 1',
  theme: PALM_COAST,
  acts: [{ build: buildPalmAct1 }, { build: buildPalmAct2 }],
};
