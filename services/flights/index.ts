import type { Resort } from '../../data/resorts';
import { loadHistoricApproaches } from './historic';
import { generateSyntheticApproaches } from './synthetic';

export type { Trajectory } from './types';

export async function getApproaches(
  resort: Resort,
  n = 30,
  maxAgeDays = 3,
): Promise<Trajectory[]> {
  const historic = loadHistoricApproaches(resort, n, { maxAgeDays });
  const needed = Math.max(0, n - historic.length);
  const synthetic = generateSyntheticApproaches(resort, needed);
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec = nowSec - Math.floor(maxAgeDays * 86400);
  return [...historic, ...synthetic]
    .filter((t) => t.landedAt >= cutoffSec)
    .sort((a, b) => b.landedAt - a.landedAt)
    .slice(0, n);
}
