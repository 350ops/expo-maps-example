import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RESORTS, type Resort } from '../data/resorts';

type Props = {
  onSelect: (resort: Resort) => void;
};

export const ResortSheet = forwardRef<BottomSheetModal, Props>(({ onSelect }, ref) => {
  const snapPoints = useMemo(() => ['30%', '60%'], []);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.3}
      />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Resort }) => (
      <TouchableOpacity style={styles.row} onPress={() => onSelect(item)}>
        <View>
          <Text style={styles.rowTitle}>{item.name}</Text>
          <Text style={styles.rowSubtitle}>{item.atoll}</Text>
        </View>
        <Text style={styles.rowArrow}>›</Text>
      </TouchableOpacity>
    ),
    [onSelect],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
    >
      <View style={styles.header}>
        <Text style={styles.title}>Select a resort</Text>
        <Text style={styles.subtitle}>
          Pick a destination to see the last 30 seaplane approaches
        </Text>
      </View>
      <BottomSheetFlatList
        data={RESORTS}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </BottomSheetModal>
  );
});

ResortSheet.displayName = 'ResortSheet';

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b6b6b',
  },
  list: {
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#8a8a8a',
  },
  rowArrow: {
    fontSize: 24,
    color: '#c7c7cc',
  },
});
