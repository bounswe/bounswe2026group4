import React, { useEffect, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { WebMapView } from '../../../../shared/components/WebMapView';
import { MapMarkerGroup } from '../../domain/entities';

interface MapCardProps {
  region: Region;
  markers: MapMarkerGroup[];
  selectedMarkerId?: string;
  isLoading?: boolean;
  error?: string;
  statusBadgeText?: string;
  fitToMarkers?: boolean;
  userLocation?: { latitude: number; longitude: number };
  onSelectMarker: (markerId: string) => void;
  onOpenStory: (storyId: string) => void;
  onMarkerPress?: () => void;
  onMapGestureActiveChange?: (active: boolean) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPreviewLayout?: (event: LayoutChangeEvent) => void;
}

const PREVIEW_MAX_LENGTH = 140;
export function MapCard({
  region,
  markers,
  selectedMarkerId,
  isLoading = false,
  error,
  statusBadgeText,
  fitToMarkers = false,
  userLocation,
  onSelectMarker,
  onOpenStory,
  onMarkerPress,
  onMapGestureActiveChange,
  onRegionChangeComplete,
  onPreviewLayout,
}: MapCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const selectedMarker = selectedMarkerId ? markers.find((marker) => marker.id === selectedMarkerId) : undefined;
  const [currentRegion, setCurrentRegion] = useState(region);

  useEffect(() => {
    if (fitToMarkers) {
      setCurrentRegion((current) => (regionsEqual(current, region) ? current : region));
      return;
    }

    if (!selectedMarker) {
      setCurrentRegion((current) => (regionsEqual(current, region) ? current : region));
      return;
    }

    setCurrentRegion((current) => ({
      latitude: selectedMarker.latitude,
      longitude: selectedMarker.longitude,
      latitudeDelta: current.latitudeDelta,
      longitudeDelta: current.longitudeDelta,
    }));
  }, [fitToMarkers, region, selectedMarker]);

  return (
    <View
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{ height: 420 }}
        onTouchStart={() => onMapGestureActiveChange?.(true)}
        onTouchEnd={() => onMapGestureActiveChange?.(false)}
        onTouchCancel={() => onMapGestureActiveChange?.(false)}
      >
        <WebMapView
          region={currentRegion}
          userLocation={userLocation}
          transitionDurationMs={450}
          markers={markers.map((marker) => ({
            id: marker.id,
            latitude: marker.latitude,
            longitude: marker.longitude,
            selected: marker.id === selectedMarkerId,
            label: marker.isCluster ? String(marker.count) : undefined,
          }))}
          onMarkerPress={(markerId) => {
            onSelectMarker(markerId);
            onMarkerPress?.();
          }}
          onGestureActiveChange={onMapGestureActiveChange}
          onRegionChangeComplete={onRegionChangeComplete}
        />

        {statusBadgeText ? (
          <View
            testID="map-search-status-badge"
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: spacing.md,
              left: spacing.md,
              right: spacing.md,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                maxWidth: '100%',
                paddingHorizontal: spacing.sm + 4,
                paddingVertical: spacing.xs + 2,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.infoSurface,
              }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: typography.caption,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {statusBadgeText}
              </Text>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.18)',
              justifyContent: 'center',
              alignItems: 'center',
              gap: spacing.sm,
            }}
            accessibilityLabel="Loading map pins"
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>Loading stories...</Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={{
              position: 'absolute',
              left: spacing.md,
              right: spacing.md,
              bottom: spacing.md,
              borderRadius: 16,
              padding: spacing.md,
              backgroundColor: colors.dangerSurface,
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Unable to load stories</Text>
            <Text style={{ marginTop: spacing.xs, color: colors.text }}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View testID="story-preview-panel" style={{ padding: spacing.lg, gap: spacing.md }} onLayout={onPreviewLayout}>
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
          {selectedMarker?.isCluster ? `${selectedMarker.count} nearby stories` : 'Story preview'}
        </Text>

        {!selectedMarker ? (
          <Text style={{ color: colors.muted }}>
            {markers.length ? 'Select a story marker to preview.' : 'No stories match the current filters.'}
          </Text>
        ) : selectedMarker.isCluster ? (
          <ScrollView
            style={{ maxHeight: 240 }}
            contentContainerStyle={{ gap: spacing.sm }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            testID="cluster-preview-list"
          >
            {selectedMarker.stories.map((story) => (
              <Pressable
                key={story.id}
                onPress={() => onOpenStory(story.id)}
                style={{
                  padding: spacing.md,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{story.title}</Text>
                <Text style={{ marginTop: spacing.xs, color: colors.muted }}>{story.placeName}</Text>
                <Text style={{ marginTop: spacing.xs, color: colors.muted }}>{story.timePeriod}</Text>
                <Text style={{ marginTop: spacing.sm, color: colors.text }}>{truncatePreview(story.previewText)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <>
            <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
              {selectedMarker.stories[0].title}
            </Text>
            <Text style={{ color: colors.muted }}>{selectedMarker.stories[0].placeName}</Text>
            <Text style={{ color: colors.muted }}>{selectedMarker.stories[0].timePeriod}</Text>
            <Text style={{ color: colors.text }}>{truncatePreview(selectedMarker.stories[0].previewText)}</Text>
            <Button onPress={() => onOpenStory(selectedMarker.stories[0].id)}>Read full story</Button>
          </>
        )}
      </View>
    </View>
  );
}

function truncatePreview(value: string) {
  if (value.length <= PREVIEW_MAX_LENGTH) {
    return value;
  }

  return `${value.slice(0, PREVIEW_MAX_LENGTH - 1).trim()}...`;
}

function regionsEqual(left: Region, right: Region) {
  return (
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.latitudeDelta === right.latitudeDelta &&
    left.longitudeDelta === right.longitudeDelta
  );
}
