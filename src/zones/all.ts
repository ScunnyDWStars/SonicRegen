import { flow } from '../game/flow';
import type { ZoneDef } from './index';
import { PALM_COAST_ZONE } from './palm-coast';
import { TEST_ZONE } from './test-room';

/** Every zone in play order. */
export const ZONES: ZoneDef[] = [PALM_COAST_ZONE];
flow.zones = ZONES;

export function zoneById(id: string): ZoneDef | undefined {
  if (id === 'test') return TEST_ZONE;
  return ZONES.find((z) => z.id === id);
}
