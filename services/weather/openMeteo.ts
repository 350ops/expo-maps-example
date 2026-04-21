import type { Wind, WindSource } from './types';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ERA5_LAG_DAYS = 5;

type HourlySeries = {
  time: string[];
  wind_speed_10m: Array<number | null>;
  wind_direction_10m: Array<number | null>;
  wind_gusts_10m?: Array<number | null>;
};

type OpenMeteoResponse = {
  hourly: HourlySeries;
  timezone: string;
};

type CacheKey = string;
type CacheEntry = {
  series: HourlySeries;
  source: WindSource;
};

const cache = new Map<CacheKey, Promise<CacheEntry | null>>();

function cacheKey(lat: number, lon: number, date: string, source: WindSource): CacheKey {
  return `${source}|${lat.toFixed(2)}|${lon.toFixed(2)}|${date}`;
}

function toDate(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

function toHourIso(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:00`;
}

function pickSource(epochSec: number): WindSource {
  const ageDays = (Date.now() / 1000 - epochSec) / 86400;
  return ageDays > ERA5_LAG_DAYS ? 'era5' : 'gfs';
}

async function fetchArchive(
  lat: number,
  lon: number,
  date: string,
): Promise<CacheEntry | null> {
  const url =
    `${ARCHIVE_URL}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
    `&start_date=${date}&end_date=${date}` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&wind_speed_unit=kn&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo archive ${date}: ${res.status}`);
  const json = (await res.json()) as OpenMeteoResponse;
  if (!json.hourly?.time) return null;
  return { series: json.hourly, source: 'era5' };
}

async function fetchForecast(
  lat: number,
  lon: number,
  epochSec: number,
): Promise<CacheEntry | null> {
  const now = Math.floor(Date.now() / 1000);
  const pastDays = Math.min(
    16,
    Math.max(0, Math.ceil((now - epochSec) / 86400) + 1),
  );
  const url =
    `${FORECAST_URL}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&past_days=${pastDays}&forecast_days=1` +
    `&wind_speed_unit=kn&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo forecast: ${res.status}`);
  const json = (await res.json()) as OpenMeteoResponse;
  if (!json.hourly?.time) return null;
  return { series: json.hourly, source: 'gfs' };
}

async function loadSeries(
  lat: number,
  lon: number,
  epochSec: number,
): Promise<CacheEntry | null> {
  const source = pickSource(epochSec);
  const date = toDate(epochSec);
  const key = cacheKey(lat, lon, date, source);
  const existing = cache.get(key);
  if (existing) return existing;

  const promise =
    source === 'era5' ? fetchArchive(lat, lon, date) : fetchForecast(lat, lon, epochSec);
  cache.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

export async function fetchWindAt(
  lat: number,
  lon: number,
  epochSec: number,
): Promise<Wind | null> {
  const entry = await loadSeries(lat, lon, epochSec);
  if (!entry) return null;
  const hourIso = toHourIso(epochSec);
  const idx = entry.series.time.indexOf(hourIso);
  if (idx < 0) return null;
  const speed = entry.series.wind_speed_10m[idx];
  const dir = entry.series.wind_direction_10m[idx];
  if (speed == null || dir == null) return null;
  const gusts = entry.series.wind_gusts_10m?.[idx];
  return {
    speedKn: speed,
    directionDeg: dir,
    gustsKn: gusts == null ? undefined : gusts,
    source: entry.source,
    sampledAt: Math.floor(new Date(`${hourIso}Z`).getTime() / 1000),
  };
}

export function clearWeatherCache(): void {
  cache.clear();
}
