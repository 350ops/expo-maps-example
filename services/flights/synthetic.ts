import type { Resort } from '../../data/resorts';
import { VELANA_SEAPLANE_TERMINAL } from '../../constants/Velana';
import { bearingDeg, destinationPoint, distanceNm, interpolateGreatCircle } from '../../utils/geo';
import type { Trajectory, TrajectoryPoint } from './types';

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(resortId: string, index: number): number {
  let h = 2166136261;
  const str = `${resortId}|${index}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function callsignFor(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `8Q-RA${letters[index % letters.length]}`;
}

function generateOne(resort: Resort, index: number): Trajectory {
  const rand = mulberry32(hashSeed(resort.id, index));
  const origin = VELANA_SEAPLANE_TERMINAL;
  const dest = resort.coord;

  const directBrg = bearingDeg(origin, dest);
  const totalDistNm = distanceNm(origin, dest);
  const approachOffset = (rand() - 0.5) * 30;
  const approachBrgFrom = (directBrg + 180 + approachOffset + 360) % 360;
  const finalTurnDistNm = 6 + rand() * 3;
  const turnPoint = destinationPoint(dest, finalTurnDistNm, approachBrgFrom);

  const nPointsCruise = 8 + Math.floor(rand() * 5);
  const points: TrajectoryPoint[] = [];

  const now = Math.floor(Date.now() / 1000);
  const daysAgo = rand() * 3;
  const landedAt = now - Math.floor(daysAgo * 86400) - Math.floor(rand() * 43200);

  const cruiseDurationSec = Math.floor((totalDistNm / 150) * 3600);
  const takeoffAt = landedAt - cruiseDurationSec;

  for (let i = 0; i <= nPointsCruise; i++) {
    const t = i / nPointsCruise;
    const base = interpolateGreatCircle(origin, turnPoint, t);
    const jitterLat = (rand() - 0.5) * 0.02;
    const jitterLon = (rand() - 0.5) * 0.02;
    const altFt =
      t < 0.15 ? 1500 * (t / 0.15) : t > 0.85 ? 1500 * (1 - (t - 0.85) / 0.15) : 1500;
    points.push({
      lat: base.latitude + jitterLat,
      lon: base.longitude + jitterLon,
      altFt,
      t: takeoffAt + Math.floor(t * cruiseDurationSec * 0.85),
    });
  }

  const finalApproachPoints = 5;
  for (let i = 1; i <= finalApproachPoints; i++) {
    const t = i / finalApproachPoints;
    const sCurveNm = finalTurnDistNm * (1 - t);
    const lateralOffsetBrg = (approachBrgFrom + 90) % 360;
    const lateralNm = Math.sin(t * Math.PI) * 0.3 * (rand() > 0.5 ? 1 : -1);
    const alongTrack = destinationPoint(dest, sCurveNm, approachBrgFrom);
    const laterallyShifted = destinationPoint(alongTrack, lateralNm, lateralOffsetBrg);
    const altFt = 1500 * (1 - t);
    points.push({
      lat: laterallyShifted.latitude,
      lon: laterallyShifted.longitude,
      altFt,
      t:
        takeoffAt +
        Math.floor(cruiseDurationSec * 0.85) +
        Math.floor(t * cruiseDurationSec * 0.15),
    });
  }

  points.push({
    lat: dest.latitude,
    lon: dest.longitude,
    altFt: 0,
    t: landedAt,
  });

  return {
    id: `synthetic-${resort.id}-${index}`,
    callsign: callsignFor(index),
    source: 'synthetic',
    points,
    landedAt,
  };
}

export function generateSyntheticApproaches(resort: Resort, n: number): Trajectory[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => generateOne(resort, i));
}
