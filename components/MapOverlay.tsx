import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Trajectory } from '../services/flights/types';

type Props = {
  resortName: string | null;
  approaches: Trajectory[] | null;
  loading: boolean;
  error: Error | null;
  onOpenMenu: () => void;
};

export function MapOverlay({ resortName, approaches, loading, error, onOpenMenu }: Props) {
  const realCount = approaches?.filter((t) => t.source === 'adsbx').length ?? 0;
  const syntheticCount = approaches?.filter((t) => t.source === 'synthetic').length ?? 0;

  return (
    <>
      <View style={styles.topChip} pointerEvents="box-none">
        <View style={styles.chip}>
          {resortName ? (
            <Text style={styles.chipTitle}>{resortName}</Text>
          ) : (
            <Text style={styles.chipTitle}>Maldives Seaplanes</Text>
          )}
          {error ? (
            <Text style={[styles.chipLegend, styles.chipError]}>Failed to load approaches</Text>
          ) : approaches && !loading ? (
            <Text style={styles.chipLegend}>
              <Text style={styles.dotReal}>●</Text> {realCount} real{'  '}
              <Text style={styles.dotSynthetic}>●</Text> {syntheticCount} synthetic
            </Text>
          ) : loading ? (
            <Text style={styles.chipLegend}>Loading approaches…</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.fabContainer} pointerEvents="box-none">
        <Pressable onPress={onOpenMenu} style={styles.fab}>
          <Text style={styles.fabText}>Select resort</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topChip: {
    alignItems: 'center',
    marginTop: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipLegend: {
    marginTop: 2,
    fontSize: 12,
    color: '#666',
  },
  chipError: {
    color: '#FF3B30',
  },
  dotReal: {
    color: '#0A84FF',
    fontSize: 14,
  },
  dotSynthetic: {
    color: '#FF9F0A',
    fontSize: 14,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 20,
  },
  fab: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
