import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AppleMaps } from 'expo-maps';
import {
  AppleMapsContourStyle,
  AppleMapsMapType,
} from 'expo-maps/build/apple/AppleMaps.types';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HULHUMALE_CENTER } from '@/constants/Hulhumale';
import { RESORTS, type Resort } from '@/data/resorts';
import { useApproaches } from '@/hooks/useApproaches';
import { nmToMeters } from '@/utils/geo';
import { ResortSheet } from '@/components/ResortSheet';
import { MapOverlay } from '@/components/MapOverlay';
import { ApproachInfoCard } from '@/components/ApproachInfoCard';
import type { Trajectory } from '@/services/flights/types';

const OVERVIEW_ZOOM = 9;
const RESORT_ZOOM = 8.5;

export default function MapScreen() {
  const mapRef = useRef<AppleMaps.MapView>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(null);

  const { data: approaches, loading } = useApproaches(selectedResort);

  const initialCamera = useMemo(
    () => ({
      coordinates: HULHUMALE_CENTER,
      zoom: OVERVIEW_ZOOM,
    }),
    [],
  );

  const handleOpenMenu = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const handleSelectResort = useCallback((resort: Resort) => {
    sheetRef.current?.dismiss();
    setSelectedTrajectoryId(null);
    setSelectedResort(resort);
    mapRef.current?.setCameraPosition({
      coordinates: resort.coord,
      zoom: RESORT_ZOOM,
    });
  }, []);

  const polylines = useMemo(() => {
    if (!approaches) return [];
    return approaches.map((t) => ({
      id: t.id,
      color:
        t.source === 'opensky'
          ? 'rgba(10,132,255,0.95)'
          : 'rgba(255,159,10,0.55)',
      width: t.source === 'opensky' ? 3 : 2,
      contourStyle: AppleMapsContourStyle.GEODESIC,
      coordinates: t.points.map((p) => ({ latitude: p.lat, longitude: p.lon })),
    }));
  }, [approaches]);

  const circles = useMemo(() => {
    if (!selectedResort) return [];
    return [
      {
        id: 'approach-ring',
        center: selectedResort.coord,
        radius: nmToMeters(selectedResort.approachRadiusNm),
        color: 'rgba(10,132,255,0.06)',
        lineColor: 'rgba(10,132,255,0.45)',
        lineWidth: 1.5,
      },
    ];
  }, [selectedResort]);

  const markers = useMemo(() => {
    if (!selectedResort) return [];
    return [
      {
        id: `resort-${selectedResort.id}`,
        coordinates: selectedResort.coord,
        title: selectedResort.name,
        tintColor: '#0A84FF',
        systemImage: 'mappin.circle.fill',
      },
    ];
  }, [selectedResort]);

  const selectedTrajectory: Trajectory | null = useMemo(() => {
    if (!selectedTrajectoryId || !approaches) return null;
    return approaches.find((t) => t.id === selectedTrajectoryId) ?? null;
  }, [selectedTrajectoryId, approaches]);

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedText}>
          This demo is iOS-only. Run with `npx expo run:ios`.
        </Text>
      </View>
    );
  }

  return (
    <>
      <AppleMaps.View
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        cameraPosition={initialCamera}
        properties={{
          isTrafficEnabled: false,
          mapType: AppleMapsMapType.HYBRID,
          selectionEnabled: true,
          polylineTapThreshold: 24,
        }}
        polylines={polylines}
        circles={circles}
        markers={markers}
        onPolylineClick={(event) => {
          if (event.id) setSelectedTrajectoryId(event.id);
        }}
        onMapClick={() => setSelectedTrajectoryId(null)}
      />
      <SafeAreaView style={styles.overlayRoot} pointerEvents="box-none">
        <MapOverlay
          resortName={selectedResort?.name ?? null}
          approaches={approaches}
          loading={loading}
          onOpenMenu={handleOpenMenu}
        />
      </SafeAreaView>
      {selectedTrajectory ? (
        <ApproachInfoCard
          trajectory={selectedTrajectory}
          onClose={() => setSelectedTrajectoryId(null)}
        />
      ) : null}
      <ResortSheet ref={sheetRef} onSelect={handleSelectResort} />
    </>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
  },
  unsupported: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  unsupportedText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
