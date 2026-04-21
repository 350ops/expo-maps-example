import type { Trajectory } from '../flights/types';
import { fetchWindAt } from './openMeteo';

export { fetchWindAt, clearWeatherCache } from './openMeteo';
export type { Wind, WindSource } from './types';

export async function enrichApproachesWithWind(
  trajectories: Trajectory[],
): Promise<Trajectory[]> {
  return Promise.all(
    trajectories.map(async (t) => {
      const last = t.points[t.points.length - 1];
      if (!last) return t;
      const wind = await fetchWindAt(last.lat, last.lon, t.landedAt).catch((err) => {
        console.warn('[weather] fetch failed for', t.id, err);
        return null;
      });
      return wind ? { ...t, windAtLanding: wind } : t;
    }),
  );
}
