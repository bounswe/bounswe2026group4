import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { searchLocationSuggestions, LocationSuggestion } from '../../../search/application/services';
import { Input } from '../../../../shared';
import { WebMapView } from '../../../../shared/components/WebMapView';
import { useDebounce } from '../../../../shared/hooks/useDebounce';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | undefined>();
  const [searchRefreshToken, setSearchRefreshToken] = useState(0);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const searchRequestIdRef = useRef(0);
  const selectedSuggestionQueryRef = useRef<string | undefined>(undefined);
  const searchInputRef = useRef<TextInput>(null);

  const selectedLocation =
    latitude != null && longitude != null
      ? { latitude, longitude }
      : null;

  useEffect(() => {
    const query = debouncedSearchQuery.trim();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (query.length < 3) {
      setSuggestions([]);
      setSearchStatus(undefined);
      setIsSearching(false);
      return;
    }

    if (selectedSuggestionQueryRef.current === query) {
      selectedSuggestionQueryRef.current = undefined;
      setSuggestions([]);
      setSearchStatus(undefined);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchStatus(undefined);

    searchLocationSuggestions(query)
      .then((results) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setSuggestions(results);
        setSearchStatus(results.length ? undefined : 'No results found.');
      })
      .catch(() => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setSuggestions([]);
        setSearchStatus('Location search failed. You can still tap the map to place the pin.');
      })
      .finally(() => {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      });
  }, [debouncedSearchQuery]);

  useEffect(() => {
    const query = debouncedSearchQuery.trim();

    if (searchRefreshToken === 0 || query.length < 3) {
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    setIsSearching(true);
    setSearchStatus(undefined);

    searchLocationSuggestions(query)
      .then((results) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setSuggestions(results);
        setSearchStatus(results.length ? undefined : 'No results found.');
      })
      .catch(() => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setSuggestions([]);
        setSearchStatus('Location search failed. You can still tap the map to place the pin.');
      })
      .finally(() => {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      });
  }, [debouncedSearchQuery, searchRefreshToken]);

  const handleSuggestionPress = (suggestion: LocationSuggestion) => {
    selectedSuggestionQueryRef.current = suggestion.title;
    setSearchQuery(suggestion.title);
    setSuggestions([]);
    setSearchStatus(undefined);
    searchInputRef.current?.blur();
    onChange({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: spacing.sm }}>
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => {
            if (searchQuery.trim().length >= 3) {
              selectedSuggestionQueryRef.current = undefined;
              setSearchRefreshToken((current) => current + 1);
            }
          }}
          placeholder="Search an address or place"
          accessibilityLabel="Search story location"
          autoCapitalize="words"
          trailingElement={
            isSearching ? (
              <ActivityIndicator testID="story-location-search-loading" color={colors.muted} size="small" />
            ) : null
          }
        />

        {suggestions.length ? (
          <View
            testID="story-location-suggestions"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              overflow: 'hidden',
            }}
          >
            {suggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${suggestion.title}`}
                onPress={() => handleSuggestionPress(suggestion)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  backgroundColor: pressed ? colors.infoSurface : colors.background,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{suggestion.title}</Text>
                {suggestion.subtitle ? (
                  <Text
                    numberOfLines={2}
                    style={{ marginTop: 2, color: colors.muted, fontSize: typography.caption }}
                  >
                    {suggestion.subtitle}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {searchStatus ? (
          <Text
            accessibilityRole={searchStatus.startsWith('Location search failed') ? 'alert' : undefined}
            style={{ color: searchStatus.startsWith('Location search failed') ? colors.danger : colors.muted }}
          >
            {searchStatus}
          </Text>
        ) : null}
      </View>

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
