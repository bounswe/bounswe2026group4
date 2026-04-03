import React from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { MapMarkerGroup } from '../../domain/entities';

interface MapCardProps {
  region: Region;
  markers: MapMarkerGroup[];
  selectedMarkerId?: string;
  isLoading?: boolean;
  error?: string;
  onSelectMarker: (markerId: string) => void;
  onOpenStory: (storyId: string) => void;
  onMarkerPress?: () => void;
  onPreviewLayout?: (event: LayoutChangeEvent) => void;
}

const PREVIEW_MAX_LENGTH = 140;

export function MapCard({
  region,
  markers,
  selectedMarkerId,
  isLoading = false,
  error,
  onSelectMarker,
  onOpenStory,
  onMarkerPress,
  onPreviewLayout,
}: MapCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) ?? markers[0];

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
      <View style={{ height: 420 }}>
        <MapView
          initialRegion={region}
          style={StyleSheet.absoluteFill}
          testID="story-map"
          accessibilityLabel="Interactive story map"
          showsCompass
          showsScale
          zoomEnabled
          scrollEnabled
          pitchEnabled
          rotateEnabled
        >
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              onPress={() => {
                onSelectMarker(marker.id);
                onMarkerPress?.();
              }}
              testID="story-marker"
            >
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: marker.isCluster ? 34 : 28,
                    height: marker.isCluster ? 34 : 28,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    backgroundColor: marker.id === selectedMarkerId ? '#1D4ED8' : '#2E7AF0',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000000',
                    shadowOpacity: 0.22,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  }}
                >
                  {marker.isCluster ? (
                    <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' }}>
                      {marker.count}
                    </Text>
                  ) : (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  )}
                </View>
                <View
                  style={{
                    marginTop: -3,
                    width: 12,
                    height: 12,
                    backgroundColor: marker.id === selectedMarkerId ? '#1D4ED8' : '#2E7AF0',
                    transform: [{ rotate: '45deg' }],
                    borderBottomWidth: 2,
                    borderRightWidth: 2,
                    borderColor: '#FFFFFF',
                  }}
                />
              </View>
            </Marker>
          ))}
        </MapView>

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
          <Text style={{ color: colors.muted }}>No stories match the current filters.</Text>
        ) : selectedMarker.isCluster ? (
          <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ gap: spacing.sm }} testID="cluster-preview-list">
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
