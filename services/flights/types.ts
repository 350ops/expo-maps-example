import type { Wind } from '../weather/types';

export type TrajectoryPoint = {
  lat: number;
  lon: number;
  altFt?: number;
  t: number;
};

export type Source = 'adsbx' | 'synthetic';

export type Trajectory = {
  id: string;
  callsign: string;
  icao24?: string;
  source: Source;
  points: TrajectoryPoint[];
  landedAt: number;
  windAtLanding?: Wind;
};
