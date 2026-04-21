export type LatLon = { latitude: number; longitude: number };

const EARTH_RADIUS_NM = 3440.065;
const NM_PER_DEGREE_LAT = 60;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function distanceNm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(
  from: LatLon,
  distanceNm: number,
  bearingDeg: number,
): LatLon {
  const angularDistance = distanceNm / EARTH_RADIUS_NM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(from.latitude);
  const lon1 = toRad(from.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { latitude: toDeg(lat2), longitude: toDeg(lon2) };
}

export function ringPolygon(center: LatLon, radiusNm: number, segments = 64): LatLon[] {
  const points: LatLon[] = [];
  for (let i = 0; i <= segments; i++) {
    const brg = (360 * i) / segments;
    points.push(destinationPoint(center, radiusNm, brg));
  }
  return points;
}

export function interpolateGreatCircle(a: LatLon, b: LatLon, t: number): LatLon {
  const lat1 = toRad(a.latitude);
  const lon1 = toRad(a.longitude);
  const lat2 = toRad(b.latitude);
  const lon2 = toRad(b.longitude);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  if (d === 0) return a;

  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);

  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);
  return { latitude: toDeg(lat), longitude: toDeg(lon) };
}

export function nmToMeters(nm: number): number {
  return nm * 1852;
}

export { NM_PER_DEGREE_LAT };
