import type { Resort } from '../../data/resorts';
import { loadHistoricApproaches } from './historic';
import { generateSyntheticApproaches } from './synthetic';

export type { Trajectory } from './types';

export async function getApproaches(resort: Resort, n = 30): Promise<Trajectory[]> {
  const historic = loadHistoricApproaches(resort, n);
  const needed = Math.max(0, n - historic.length);
  const synthetic = generateSyntheticApproaches(resort, needed);
  return [...historic, ...synthetic].sort((a, b) => b.landedAt - a.landedAt);
}
