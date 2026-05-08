import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, LayoutChangeEvent, ScrollView, Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { WebMapView } from '../../../../shared/components/WebMapView';
import { MapMarkerGroup } from '../../domain/entities';

interface MapCardProps {
  region: Region;
  markers: MapMarkerGroup[];
  selectedMarkerId?: string;
  highlightedMarkerId?: string;
  isLoading?: boolean;
  error?: string;
  statusBadgeText?: string;
  userLocation?: { latitude: number; longitude: number };
  onSelectMarker: (markerId: string) => void;
  onOpenStory: (storyId: string) => void;
  onViewTimeline?: (target: { latitude: number; longitude: number; label?: string; storyId?: string }) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPreviewLayout?: (event: LayoutChangeEvent) => void;
  onMapTouchChange?: (isTouchingMap: boolean) => void;
}

const PREVIEW_MAX_LENGTH = 140;
const MAP_GESTURE_SUPPRESSION_MS = 1200;
const passivePreviewTextProps = { pointerEvents: 'none' as const };
type MapMarkerVisualRole = 'timeline' | 'selected';
export function MapCard({
  region,
  markers,
  selectedMarkerId,
  highlightedMarkerId,
  isLoading = false,
  error,
  statusBadgeText,
  userLocation,
  onSelectMarker,
  onOpenStory,
  onViewTimeline,
  onRegionChangeComplete,
  onPreviewLayout,
  onMapTouchChange,
}: MapCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const mapTouchReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedMarker = selectedMarkerId ? markers.find((marker) => marker.id === selectedMarkerId) : undefined;
  const mapMarkers = useMemo(
    () =>
      markers.map((marker) => {
        const visualRole: MapMarkerVisualRole | undefined =
          marker.id === highlightedMarkerId ? 'timeline' : marker.id === selectedMarkerId ? 'selected' : undefined;

        return {
          id: marker.id,
          latitude: marker.latitude,
          longitude: marker.longitude,
          selected: Boolean(visualRole),
          visualRole,
          label: marker.isCluster && marker.id !== highlightedMarkerId && marker.id !== selectedMarkerId
            ? String(marker.count)
            : undefined,
        };
      }),
    [highlightedMarkerId, markers, selectedMarkerId],
  );
  const clearMapTouchReleaseTimer = useCallback(() => {
    if (mapTouchReleaseTimerRef.current) {
      clearTimeout(mapTouchReleaseTimerRef.current);
      mapTouchReleaseTimerRef.current = null;
    }
  }, []);
  const markMapGestureActive = useCallback(() => {
    onMapTouchChange?.(true);
    clearMapTouchReleaseTimer();
    mapTouchReleaseTimerRef.current = setTimeout(() => {
      onMapTouchChange?.(false);
      mapTouchReleaseTimerRef.current = null;
    }, MAP_GESTURE_SUPPRESSION_MS);

    return false;
  }, [clearMapTouchReleaseTimer, onMapTouchChange]);
  const markMapGestureFinished = useCallback(() => {
    clearMapTouchReleaseTimer();
    mapTouchReleaseTimerRef.current = setTimeout(() => {
      onMapTouchChange?.(false);
      mapTouchReleaseTimerRef.current = null;
    }, 120);
  }, [clearMapTouchReleaseTimer, onMapTouchChange]);

  useEffect(
    () => () => {
      clearMapTouchReleaseTimer();
      onMapTouchChange?.(false);
    },
    [clearMapTouchReleaseTimer, onMapTouchChange],
  );

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
        testID="interactive-map-touch-area"
        onStartShouldSetResponderCapture={markMapGestureActive}
        onMoveShouldSetResponderCapture={markMapGestureActive}
        onTouchStart={markMapGestureActive}
        onTouchMove={markMapGestureActive}
        onTouchEnd={markMapGestureFinished}
        onTouchCancel={markMapGestureFinished}
        style={{ height: 420 }}
      >
        <WebMapView
          region={region}
          userLocation={userLocation}
          transitionDurationMs={450}
          markers={mapMarkers}
          onMarkerPress={(markerId) => {
            onSelectMarker(markerId);
          }}
          onMapGestureChange={onMapTouchChange}
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
        <Text {...passivePreviewTextProps} style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
          {selectedMarker?.isCluster ? `${selectedMarker.count} nearby stories` : 'Story preview'}
        </Text>

        {!selectedMarker ? (
          <Text {...passivePreviewTextProps} style={{ color: colors.muted }}>
            {markers.length ? 'Select a story marker to preview.' : 'No stories match the current filters.'}
          </Text>
        ) : selectedMarker.isCluster ? (
          <>
            <ScrollView
              style={{ maxHeight: 240 }}
              contentContainerStyle={{ gap: spacing.sm }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              testID="cluster-preview-list"
            >
              {selectedMarker.stories.map((story) => (
                <View
                  key={story.id}
                  style={{
                    padding: spacing.md,
                    borderRadius: 16,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text {...passivePreviewTextProps} style={{ color: colors.text, fontWeight: '700' }}>{story.title}</Text>
                  <Text {...passivePreviewTextProps} style={{ marginTop: spacing.xs, color: colors.muted }}>{story.placeName}</Text>
                  <Text {...passivePreviewTextProps} style={{ marginTop: spacing.xs, color: colors.muted }}>{story.timePeriod}</Text>
                  <Text {...passivePreviewTextProps} style={{ marginTop: spacing.sm, color: colors.text }}>{truncatePreview(story.previewText)}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                    <Button
                      style={{ flexGrow: 1, flexBasis: 120 }}
                      onPress={() => onOpenStory(story.id)}
                    >
                      Read full story
                    </Button>
                    <Button
                      variant="outline"
                      style={{ flexGrow: 1, flexBasis: 120 }}
                      accessibilityLabel={`View timeline near ${story.title}`}
                      onPress={() =>
                        onViewTimeline?.({
                          latitude: story.latitude,
                          longitude: story.longitude,
                          label: story.title,
                          storyId: story.id,
                        })
                      }
                    >
                      View Timeline
                    </Button>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <Text {...passivePreviewTextProps} style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
              {selectedMarker.stories[0].title}
            </Text>
            <Text {...passivePreviewTextProps} style={{ color: colors.muted }}>{selectedMarker.stories[0].placeName}</Text>
            <Text {...passivePreviewTextProps} style={{ color: colors.muted }}>{selectedMarker.stories[0].timePeriod}</Text>
            <Text {...passivePreviewTextProps} style={{ color: colors.text }}>{truncatePreview(selectedMarker.stories[0].previewText)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Button
                style={{ flexGrow: 1, flexBasis: 140 }}
                onPress={() => onOpenStory(selectedMarker.stories[0].id)}
              >
                Read full story
              </Button>
              <Button
                variant="outline"
                style={{ flexGrow: 1, flexBasis: 140 }}
                accessibilityLabel={`View timeline near ${selectedMarker.stories[0].title}`}
                onPress={() =>
                  onViewTimeline?.({
                    latitude: selectedMarker.stories[0].latitude,
                    longitude: selectedMarker.stories[0].longitude,
                    label: selectedMarker.stories[0].title,
                    storyId: selectedMarker.stories[0].id,
                  })
                }
              >
                View Timeline
              </Button>
            </View>
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
