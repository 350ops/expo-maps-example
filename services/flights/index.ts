import type { Resort } from '../../data/resorts';
import { enrichApproachesWithWind } from '../weather';
import { loadHistoricApproaches } from './historic';
import { generateSyntheticApproaches } from './synthetic';
import type { Trajectory } from './types';

export type { Trajectory } from './types';

export async function getApproaches(resort: Resort, n = 30): Promise<Trajectory[]> {
  const historic = loadHistoricApproaches(resort, n);
  const needed = Math.max(0, n - historic.length);
  const synthetic = generateSyntheticApproaches(resort, needed);
  const merged = [...historic, ...synthetic].sort((a, b) => b.landedAt - a.landedAt);
  return enrichApproachesWithWind(merged);
}
