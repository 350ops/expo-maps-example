/**
 * Run with: npx tsx scripts/bakeHistoricApproaches.ts
 *
 * Downloads ADS-B Exchange 1st-of-month trace samples for each 8Q-RA* aircraft,
 * segments into legs, filters by resort radius, writes data/historicApproaches.json.
 */
import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RESORTS, type Resort } from '../data/resorts';
import { TMA_FLEET } from '../data/tmaFleet';
import type { Trajectory, TrajectoryPoint } from '../services/flights/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CACHE_DIR = join(PROJECT_ROOT, '.cache/adsbx-traces');
const OUTPUT_PATH = join(PROJECT_ROOT, 'data/historicApproaches.json');

const ADSBX_BASE = 'https://samples.adsbexchange.com/traces';
const CONCURRENCY = 8;
const MAX_PER_RESORT = 50;
const NM_PER_DEG_LAT = 60;
const EARTH_RADIUS_NM = 3440.065;

type TracePoint = [
  number, // seconds offset
  number | null, // lat
  number | null, // lon
  number | 'ground' | null, // alt (ft, or "ground")
  number | null, // gs (kn)
  number | null, // trk (deg)
  number | null, // flags bitfield
  ...unknown[],
];

type TraceFile = {
  icao: string;
  r?: string;
  timestamp: number; // base epoch seconds
  trace: TracePoint[];
};

function distanceNm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h));
}

function* monthIter(startYear: number, startMonth: number): Generator<[number, number]> {
  const now = new Date();
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth() + 1;
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    yield [y, m];
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

function traceUrl(hex: string, year: number, month: number): string {
  const yy = year.toString().padStart(4, '0');
  const mm = month.toString().padStart(2, '0');
  const last2 = hex.slice(-2).toLowerCase();
  const h = hex.toLowerCase();
  return `${ADSBX_BASE}/${yy}/${mm}/01/${last2}/trace_full_${h}.json`;
}

function cachePathFor(hex: string, year: number, month: number): string {
  return join(CACHE_DIR, `${hex.toLowerCase()}-${year}-${month.toString().padStart(2, '0')}.json`);
}

async function fetchTraceFile(
  hex: string,
  year: number,
  month: number,
): Promise<TraceFile | null> {
  const cachePath = cachePathFor(hex, year, month);
  if (existsSync(cachePath)) {
    const raw = readFileSync(cachePath, 'utf8');
    if (raw === 'MISSING') return null;
    return JSON.parse(raw) as TraceFile;
  }

  const url = traceUrl(hex, year, month);
  const res = await fetch(url);
  if (res.status === 404) {
    writeFileSync(cachePath, 'MISSING');
    return null;
  }
  if (!res.ok) {
    console.warn(`  ! ${hex} ${year}-${month}: HTTP ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  let jsonText: string;
  try {
    jsonText = gunzipSync(buf).toString('utf8');
  } catch (err) {
    jsonText = buf.toString('utf8');
  }
  const parsed = JSON.parse(jsonText) as TraceFile;
  writeFileSync(cachePath, JSON.stringify(parsed));
  return parsed;
}

function segmentLegs(trace: TraceFile): TrajectoryPoint[][] {
  const legs: TrajectoryPoint[][] = [];
  let current: TrajectoryPoint[] = [];
  for (const pt of trace.trace) {
    const [dt, lat, lon, alt, , , flags] = pt;
    if (lat == null || lon == null) continue;
    const altFt =
      alt === 'ground' ? 0 : typeof alt === 'number' ? alt : undefined;
    const point: TrajectoryPoint = {
      t: Math.floor(trace.timestamp + dt),
      lat,
      lon,
      altFt,
    };
    const newLeg = flags != null && (flags & 2) !== 0;
    if (newLeg && current.length >= 2) {
      legs.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length >= 2) legs.push(current);
  return legs;
}

function legMatchesResort(
  leg: TrajectoryPoint[],
  resort: Resort,
): boolean {
  const last = leg[leg.length - 1];
  const d = distanceNm(
    { latitude: last.lat, longitude: last.lon },
    resort.coord,
  );
  return d <= resort.approachRadiusNm;
}

function legToTrajectory(
  leg: TrajectoryPoint[],
  hex: string,
  registration: string,
): Trajectory {
  const last = leg[leg.length - 1];
  return {
    id: `adsbx-${hex.toLowerCase()}-${leg[0].t}`,
    callsign: registration,
    icao24: hex.toLowerCase(),
    source: 'adsbx',
    points: leg,
    landedAt: last.t,
  };
}

async function mapLimited<T, R>(
  items: T[],
  concurrency: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

async function main() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const fleet = TMA_FLEET.filter((f) => f.icao24 !== null) as Array<{
    registration: string;
    icao24: string;
  }>;

  if (fleet.length === 0) {
    console.error(
      'No ICAO24 hex codes in data/tmaFleet.ts — fill them in from planespotters.net or hexdb.io, then re-run.',
    );
    process.exit(1);
  }

  const months = Array.from(monthIter(2020, 3));
  const jobs: Array<{ hex: string; registration: string; year: number; month: number }> = [];
  for (const entry of fleet) {
    for (const [y, m] of months) {
      jobs.push({ hex: entry.icao24, registration: entry.registration, year: y, month: m });
    }
  }

  console.log(
    `Baking ${fleet.length} aircraft × ${months.length} months = ${jobs.length} trace file lookups`,
  );

  const legsByResort: Map<string, Trajectory[]> = new Map(
    RESORTS.map((r) => [r.id, []] as [string, Trajectory[]]),
  );
  let candidateLegCount = 0;

  let done = 0;
  await mapLimited(jobs, CONCURRENCY, async (job) => {
    const trace = await fetchTraceFile(job.hex, job.year, job.month);
    done++;
    if (done % 25 === 0) console.log(`  progress: ${done}/${jobs.length}`);
    if (!trace) return;
    const legs = segmentLegs(trace);
    candidateLegCount += legs.length;
    for (const leg of legs) {
      for (const resort of RESORTS) {
        if (legMatchesResort(leg, resort)) {
          const traj = legToTrajectory(leg, job.hex, job.registration);
          legsByResort.get(resort.id)!.push(traj);
        }
      }
    }
  });

  const output: Record<string, Trajectory[]> = {};
  for (const resort of RESORTS) {
    const list = (legsByResort.get(resort.id) ?? [])
      .sort((a, b) => b.landedAt - a.landedAt)
      .slice(0, MAX_PER_RESORT);
    output[resort.id] = list;
    console.log(
      `${resort.name}: ${list.length} real approaches baked (of ${
        legsByResort.get(resort.id)?.length ?? 0
      } candidate legs to this resort, from ${candidateLegCount} total legs).`,
    );
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
