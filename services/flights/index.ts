import type { Resort } from '../../data/resorts';
import { TMA_FLEET_HEX } from '../../data/tmaFleet';
import { enrichApproachesWithWind } from '../weather';
import { fetchRealApproaches } from './opensky';
import { generateSyntheticApproaches } from './synthetic';
import type { Trajectory } from './types';

export type { Trajectory } from './types';

export async function getApproaches(resort: Resort, n = 30): Promise<Trajectory[]> {
  const real = await fetchRealApproaches(TMA_FLEET_HEX, resort).catch((err) => {
    console.warn('[flights] real lookup failed, falling back to synthetic only', err);
    return [] as Trajectory[];
  });
  const realSorted = real.sort((a, b) => b.landedAt - a.landedAt).slice(0, n);
  const needed = Math.max(0, n - realSorted.length);
  const synthetic = generateSyntheticApproaches(resort, needed);
  const merged = [...realSorted, ...synthetic].sort((a, b) => b.landedAt - a.landedAt);
  return enrichApproachesWithWind(merged);
}
