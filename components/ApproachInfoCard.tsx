import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { Trajectory } from '../services/flights/types';
import { fetchWindAt } from '../services/weather';
import type { Wind } from '../services/weather/types';
import { bearingDeg, distanceNm } from '../utils/geo';

type Props = {
  trajectories: Trajectory[];
  currentId: string;
  onChange: (id: string) => void;
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

export function ApproachInfoCard({ trajectories, currentId, onChange, onClose }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Trajectory>>(null);
  const rawIndex = trajectories.findIndex((t) => t.id === currentId);
  const currentIndex = rawIndex < 0 ? 0 : rawIndex;

  useEffect(() => {
    if (trajectories.length === 0) return;
    listRef.current?.scrollToIndex({ index: currentIndex, animated: true });
  }, [currentIndex, trajectories.length]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      const next = trajectories[i];
      if (next && next.id !== currentId) onChange(next.id);
    },
    [trajectories, currentId, onChange, width],
  );

  if (trajectories.length === 0) return null;

  return (
    <View style={styles.carousel} pointerEvents="box-none">
      <FlatList
        ref={listRef}
        data={trajectories}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(t) => t.id}
        initialScrollIndex={currentIndex}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <View style={[styles.page, { width }]} pointerEvents="box-none">
            <ApproachCardContent
              trajectory={item}
              pageLabel={`${index + 1} of ${trajectories.length}`}
              onClose={onClose}
            />
          </View>
        )}
      />
      {trajectories.length > 1 ? (
        <View style={styles.dotsWrap} pointerEvents="none">
          <View style={styles.dotsPill}>
            {trajectories.map((t, i) => (
              <View
                key={t.id}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ApproachCardContent({
  trajectory,
  pageLabel,
  onClose,
}: {
  trajectory: Trajectory;
  pageLabel: string;
  onClose: () => void;
}) {
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
          <View style={styles.titleRow}>
            <Text style={styles.callsign}>{trajectory.callsign}</Text>
            <Text style={styles.pageLabel}>{pageLabel}</Text>
          </View>
          <Text style={styles.time}>
            Landed: {formatLandedAt(trajectory.landedAt)} MVT
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Source</Text>
        <View style={styles.rowRight}>
          {trajectory.source === 'adsbx' && trajectory.icao24 ? (
            <Text style={styles.icao}>{trajectory.icao24.toUpperCase()}</Text>
          ) : null}
          <Text
            style={[
              styles.badge,
              trajectory.source === 'adsbx' ? styles.badgeReal : styles.badgeSynth,
            ]}
          >
            {trajectory.source === 'adsbx' ? 'ADS-B Exchange' : 'Synthetic'}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Wind at landing</Text>
        {wind === 'loading' ? (
          <View style={styles.windBlock}>
            <ActivityIndicator size="small" color="#0A84FF" />
            <Text style={styles.loadingText}>Fetching wind…</Text>
          </View>
        ) : wind ? (
          <View style={styles.windBlock}>
            <Text
              style={[
                styles.windArrow,
                { transform: [{ rotate: `${wind.directionDeg + 180}deg` }] },
              ]}
            >
              ↑
            </Text>
            <Text style={styles.windText}>
              {wind.speedKn.toFixed(0)} kn from {Math.round(wind.directionDeg)}°{' '}
              ({compassLabel(wind.directionDeg)})
              {wind.gustsKn ? `  gust ${wind.gustsKn.toFixed(0)}` : ''}
            </Text>
            <Text style={styles.windSource}>
              {wind.source === 'era5' ? 'ERA5' : 'GFS'}
            </Text>
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
  carousel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
  },
  page: {
    paddingHorizontal: 16,
  },
  dotsWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  dotsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15,23,32,0.55)',
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  callsign: {
    fontSize: 17,
    fontWeight: '700',
  },
  pageLabel: {
    fontSize: 11,
    color: '#8A929B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  time: {
    marginTop: 2,
    fontSize: 12,
    color: '#666',
  },
  close: {
    fontSize: 18,
    color: '#999',
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  label: {
    fontSize: 13,
    color: '#555',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icao: {
    fontSize: 11,
    color: '#888',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeReal: {
    backgroundColor: '#0A84FF',
    color: 'white',
  },
  badgeSynth: {
    backgroundColor: '#FF9F0A',
    color: 'white',
  },
  windBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  windArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A84FF',
  },
  windText: {
    fontSize: 13,
  },
  windSource: {
    fontSize: 10,
    color: '#888',
    marginLeft: 4,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  unavailable: {
    fontSize: 13,
    color: '#999',
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
