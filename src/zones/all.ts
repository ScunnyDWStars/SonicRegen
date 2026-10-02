import { flow } from '../game/flow';
import type { ZoneDef } from './index';
import { JUNGLE_ISLE_ZONE } from './jungle-isle';
import { NEON_REFINERY_ZONE } from './neon-refinery';
import { PALM_COAST_ZONE } from './palm-coast';
import { TEST_ZONE } from './test-room';

/** Every zone in play order. */
export const ZONES: ZoneDef[] = [PALM_COAST_ZONE, NEON_REFINERY_ZONE, JUNGLE_ISLE_ZONE];
flow.zones = ZONES;

export function zoneById(id: string): ZoneDef | undefined {
  if (id === 'test') return TEST_ZONE;
  return ZONES.find((z) => z.id === id);
}
