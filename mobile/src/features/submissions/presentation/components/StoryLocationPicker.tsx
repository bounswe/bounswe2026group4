import React from 'react';
import { Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { WebMapView } from '../../../../shared/components/WebMapView';

interface StoryLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  error?: string;
}

const DEFAULT_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};
export function StoryLocationPicker({
  latitude,
  longitude,
  onChange,
  error,
}: StoryLocationPickerProps) {
  const { colors, spacing, typography } = useAppTheme();

  const selectedLocation =
    latitude != null && longitude != null
      ? { latitude, longitude }
      : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          overflow: 'hidden',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
        }}
      >
        <View style={{ height: 220, width: '100%' }}>
          <WebMapView
            region={
              selectedLocation
                ? {
                    ...selectedLocation,
                    latitudeDelta: 0.025,
                    longitudeDelta: 0.025,
                  }
                : DEFAULT_REGION
            }
            markers={
              selectedLocation
                ? [
                    {
                      id: 'selected-location',
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                      selected: true,
                    },
                  ]
                : []
            }
            onMapPress={onChange}
          />
        </View>
      </View>

      <Text style={{ color: colors.muted, fontSize: typography.caption }}>
        Tap the map to place or move the pin.
      </Text>

      <View
        style={{
          padding: spacing.md,
          borderRadius: 16,
          backgroundColor: colors.infoSurface,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' }}>Selected coordinates</Text>
        <Text style={{ marginTop: spacing.xs, color: colors.muted }}>
          {selectedLocation
            ? `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
            : 'No location selected yet.'}
        </Text>
      </View>

      {error ? (
        <Text style={{ color: colors.danger, fontSize: typography.caption }}>{error}</Text>
      ) : null}
    </View>
  );
}
