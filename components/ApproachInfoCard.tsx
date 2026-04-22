import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Trajectory } from '../services/flights/types';
import { fetchWindAt } from '../services/weather';
import type { Wind } from '../services/weather/types';

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

export function ApproachInfoCard({ trajectory, onClose }: Props) {
  const [wind, setWind] = useState<WindState>('loading');

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
  }, [trajectory.id]);

  return (
    <View style={styles.card} pointerEvents="auto">
      <View style={styles.header}>
        <View>
          <Text style={styles.callsign}>{trajectory.callsign}</Text>
          <Text style={styles.time}>
            Landed: {formatLandedAt(trajectory.landedAt)} MVT
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Trajectory</Text>
        <Text
          style={[
            styles.badge,
            trajectory.source === 'adsbx' ? styles.badgeReal : styles.badgeSynth,
          ]}
        >
          {trajectory.source === 'adsbx' ? 'Real (ADS-B Exchange)' : 'Synthetic'}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
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
  callsign: {
    fontSize: 17,
    fontWeight: '700',
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
});
