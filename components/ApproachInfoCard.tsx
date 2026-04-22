import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Trajectory } from '../services/flights/types';
import { fetchWindAt } from '../services/weather';
import type { Wind } from '../services/weather/types';
import { bearingDeg, distanceNm } from '../utils/geo';

type Props = {
  trajectory: Trajectory;
  onClose: () => void;
};

type WindState = Wind | null | 'loading';

function formatLandedAt(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toLocaleString('en-GB', {
    timeZone: 'Indian/Maldives',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatSpeedKn(knots: number): string {
  if (!Number.isFinite(knots) || knots <= 0) return '—';
  return `${Math.round(knots)} kn`;
}

function formatRelativeAge(epochSec: number): string {
  const diffHours = (Date.now() / 1000 - epochSec) / 3600;
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function ApproachInfoCard({ trajectory, onClose }: Props) {
  const [wind, setWind] = useState<WindState>('loading');
  const firstPoint = trajectory.points[0];
  const lastPoint = trajectory.points[trajectory.points.length - 1];
  const penultimatePoint = trajectory.points[trajectory.points.length - 2];

  const pathDistanceNm = trajectory.points.reduce((sum, point, idx, points) => {
    if (idx === 0) return 0;
    const prev = points[idx - 1];
    return sum + distanceNm(
      { latitude: prev.lat, longitude: prev.lon },
      { latitude: point.lat, longitude: point.lon },
    );
  }, 0);

  const elapsedSec =
    firstPoint && lastPoint && lastPoint.t > firstPoint.t ? lastPoint.t - firstPoint.t : 0;
  const avgGroundSpeedKn = elapsedSec > 0 ? (pathDistanceNm / elapsedSec) * 3600 : 0;
  const maxAltFt = trajectory.points.reduce((max, p) => Math.max(max, p.altFt ?? 0), 0);
  const finalCourseDeg =
    penultimatePoint && lastPoint
      ? bearingDeg(
          { latitude: penultimatePoint.lat, longitude: penultimatePoint.lon },
          { latitude: lastPoint.lat, longitude: lastPoint.lon },
        )
      : null;

  useEffect(() => {
    setWind('loading');
    const last = trajectory.points[trajectory.points.length - 1];
    if (!last) {
      setWind(null);
      return;
    }
    let cancelled = false;
    fetchWindAt(last.lat, last.lon, trajectory.landedAt)
      .then((w) => { if (!cancelled) setWind(w); })
      .catch(() => { if (!cancelled) setWind(null); });
    return () => { cancelled = true; };
  }, [trajectory.id, trajectory.landedAt, trajectory.points]);

  return (
    <View style={styles.card} pointerEvents="auto">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.callsign}>{trajectory.callsign}</Text>
          <Text style={styles.subtleLine}>Landed {formatRelativeAge(trajectory.landedAt)}</Text>
          <Text style={styles.time}>{formatLandedAt(trajectory.landedAt)} MVT</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.topTags}>
        <Text
          style={[
            styles.badge,
            trajectory.source === 'adsbx' ? styles.badgeReal : styles.badgeSynth,
          ]}
        >
          {trajectory.source === 'adsbx' ? 'LIVE ADS-B' : 'SIMULATED'}
        </Text>
        {trajectory.source === 'adsbx' && trajectory.icao24 ? (
          <Text style={styles.icaoChip}>{trajectory.icao24.toUpperCase()}</Text>
        ) : null}
      </View>

      <View style={styles.heroMetrics}>
        <View style={styles.heroMetricCell}>
          <Text style={styles.heroValue}>{pathDistanceNm.toFixed(1)}</Text>
          <Text style={styles.heroUnit}>nm flown</Text>
        </View>
        <View style={styles.heroMetricCell}>
          <Text style={styles.heroValue}>{formatDuration(elapsedSec)}</Text>
          <Text style={styles.heroUnit}>flight time</Text>
        </View>
        <View style={styles.heroMetricCell}>
          <Text style={styles.heroValue}>{formatSpeedKn(avgGroundSpeedKn).replace(' kn', '')}</Text>
          <Text style={styles.heroUnit}>avg kts</Text>
        </View>
      </View>

      <View style={styles.windPanel}>
        <Text style={styles.panelTitle}>Wind at landing</Text>
        {wind === 'loading' ? (
          <View style={styles.windBlock}>
            <ActivityIndicator size="small" color="#4AA3FF" />
            <Text style={styles.loadingText}>Fetching latest wind model…</Text>
          </View>
        ) : wind ? (
          <View style={styles.windData}>
            <Text
              style={[
                styles.windArrow,
                { transform: [{ rotate: `${wind.directionDeg + 180}deg` }] },
              ]}
            >
              ↑
            </Text>
            <View style={styles.windSummary}>
              <Text style={styles.windText}>
                {wind.speedKn.toFixed(0)} kn from {Math.round(wind.directionDeg)}°{' '}
                ({compassLabel(wind.directionDeg)})
                {wind.gustsKn ? ` · gust ${wind.gustsKn.toFixed(0)}` : ''}
              </Text>
              <Text style={styles.windSource}>
                Weather source: {wind.source === 'era5' ? 'ERA5 reanalysis' : 'GFS forecast'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.unavailable}>Wind unavailable</Text>
        )}
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Track distance</Text>
          <Text style={styles.metricValue}>{pathDistanceNm.toFixed(1)} nm</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Flight time</Text>
          <Text style={styles.metricValue}>{formatDuration(elapsedSec)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Avg ground speed</Text>
          <Text style={styles.metricValue}>{formatSpeedKn(avgGroundSpeedKn)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Peak altitude</Text>
          <Text style={styles.metricValue}>{maxAltFt.toFixed(0)} ft</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Final course</Text>
          <Text style={styles.metricValue}>
            {finalCourseDeg === null
              ? '—'
              : `${Math.round(finalCourseDeg)}° (${compassLabel(finalCourseDeg)})`}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Points sampled</Text>
          <Text style={styles.metricValue}>{trajectory.points.length}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    backgroundColor: 'rgba(18, 24, 33, 0.95)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flexShrink: 1,
  },
  callsign: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#F8FAFF',
  },
  subtleLine: {
    marginTop: 2,
    fontSize: 12,
    color: '#8EA2BD',
  },
  time: {
    marginTop: 2,
    fontSize: 12,
    color: '#A9B8CC',
  },
  close: {
    fontSize: 18,
    color: '#AFC2D8',
    paddingHorizontal: 6,
  },
  topTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  icaoChip: {
    fontSize: 11,
    color: '#D8E5F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(114, 142, 174, 0.28)',
    fontVariant: ['tabular-nums'],
    overflow: 'hidden',
  },
  heroMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  heroMetricCell: {
    flex: 1,
    backgroundColor: 'rgba(36, 52, 74, 0.45)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  heroValue: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F4F8FF',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    marginTop: 2,
    fontSize: 11,
    textAlign: 'center',
    color: '#A5BAD3',
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    letterSpacing: 0.3,
  },
  badgeReal: {
    backgroundColor: '#2B88FF',
    color: 'white',
  },
  badgeSynth: {
    backgroundColor: '#D9912A',
    color: 'white',
  },
  windPanel: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(31, 44, 62, 0.62)',
  },
  panelTitle: {
    fontSize: 12,
    color: '#8EA2BD',
    marginBottom: 6,
  },
  windBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  windData: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  windArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#60B5FF',
  },
  windSummary: {
    flex: 1,
  },
  windText: {
    fontSize: 13,
    color: '#E9F3FF',
  },
  windSource: {
    marginTop: 2,
    fontSize: 11,
    color: '#9FB4CD',
  },
  loadingText: {
    fontSize: 13,
    color: '#A8BED8',
    fontStyle: 'italic',
  },
  unavailable: {
    fontSize: 13,
    color: '#A8BED8',
    fontStyle: 'italic',
  },
  metricGrid: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCell: {
    width: '48%',
    backgroundColor: '#F4F6F8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: '#67717B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F1720',
  },
});
