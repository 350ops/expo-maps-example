import Constants from 'expo-constants';
import type { Resort } from '../../data/resorts';
import { distanceNm } from '../../utils/geo';
import type { Trajectory, TrajectoryPoint } from './types';

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

type OpenSkyFlight = {
  icao24: string;
  firstSeen: number;
  lastSeen: number;
  callsign: string | null;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
};

type OpenSkyTrack = {
  icao24: string;
  callsign: string | null;
  startTime: number;
  endTime: number;
  path: Array<
    [
      number, // time
      number | null, // latitude
      number | null, // longitude
      number | null, // baro_altitude (m)
      number | null, // true_track
      boolean | null, // on_ground
    ]
  >;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function getCreds(): { id: string; secret: string } | null {
  const id =
    (Constants.expoConfig?.extra?.openSkyClientId as string | undefined) ||
    process.env.EXPO_PUBLIC_OPENSKY_CLIENT_ID;
  const secret =
    (Constants.expoConfig?.extra?.openSkyClientSecret as string | undefined) ||
    process.env.EXPO_PUBLIC_OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

async function getAccessToken(): Promise<string | null> {
  const creds = getCreds();
  if (!creds) return null;
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.id,
    client_secret: creds.secret,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`OpenSky token fetch failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return cachedToken.value;
}

async function authedFetch(url: string): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

async function fetchFlightsForAircraft(
  icao24: string,
  beginSec: number,
  endSec: number,
): Promise<OpenSkyFlight[]> {
  const url = `${OPENSKY_BASE}/flights/aircraft?icao24=${icao24}&begin=${beginSec}&end=${endSec}`;
  const res = await authedFetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenSky flights ${icao24}: ${res.status}`);
  return (await res.json()) as OpenSkyFlight[];
}

async function fetchTrack(icao24: string, time: number): Promise<OpenSkyTrack | null> {
  const url = `${OPENSKY_BASE}/tracks/all?icao24=${icao24}&time=${time}`;
  const res = await authedFetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenSky track ${icao24}@${time}: ${res.status}`);
  return (await res.json()) as OpenSkyTrack;
}

function trackToTrajectory(
  track: OpenSkyTrack,
  flight: OpenSkyFlight,
): Trajectory | null {
  const points: TrajectoryPoint[] = [];
  for (const [t, lat, lon, altM] of track.path) {
    if (lat == null || lon == null) continue;
    points.push({
      t,
      lat,
      lon,
      altFt: altM == null ? undefined : altM * 3.28084,
    });
  }
  if (points.length < 2) return null;
  return {
    id: `opensky-${track.icao24}-${track.startTime}`,
    callsign: (flight.callsign ?? track.callsign ?? track.icao24).trim(),
    icao24: track.icao24,
    source: 'opensky',
    points,
    landedAt: points[points.length - 1].t,
  };
}

async function mapLimited<T, R>(
  items: T[],
  concurrency: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchRealApproaches(
  icao24List: string[],
  resort: Resort,
  lookbackDays = 30,
): Promise<Trajectory[]> {
  if (icao24List.length === 0) return [];
  const creds = getCreds();
  if (!creds) {
    console.warn('[OpenSky] missing credentials, skipping real flights');
    return [];
  }

  const endSec = Math.floor(Date.now() / 1000);
  const beginSec = endSec - lookbackDays * 86400;
  const resortCoord = {
    latitude: resort.coord.latitude,
    longitude: resort.coord.longitude,
  };

  const flightsByAircraft = await mapLimited(icao24List, 4, async (hex) => {
    try {
      return { hex, flights: await fetchFlightsForAircraft(hex, beginSec, endSec) };
    } catch (err) {
      console.warn(`[OpenSky] flights lookup failed for ${hex}:`, err);
      return { hex, flights: [] as OpenSkyFlight[] };
    }
  });

  const allTrajectories: Trajectory[] = [];
  for (const { flights } of flightsByAircraft) {
    const tracks = await mapLimited(flights, 4, async (flight) => {
      try {
        const track = await fetchTrack(flight.icao24, flight.firstSeen);
        return track ? trackToTrajectory(track, flight) : null;
      } catch (err) {
        console.warn(`[OpenSky] track lookup failed for ${flight.icao24}:`, err);
        return null;
      }
    });
    for (const traj of tracks) {
      if (!traj) continue;
      const last = traj.points[traj.points.length - 1];
      const d = distanceNm(
        { latitude: last.lat, longitude: last.lon },
        resortCoord,
      );
      if (d <= resort.approachRadiusNm) allTrajectories.push(traj);
    }
  }
  return allTrajectories;
}
