import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { DeviceCoordinates, getCurrentDeviceCoordinates } from '../../../../core/services/deviceLocation';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { FilterPanel, ProximityRadiusOption } from '../../../../shared/components/FilterPanel';
import { FilterChipItem, FilterChips } from '../../../../shared/components/FilterChips';
import { SearchInput } from '../../../../shared/components/SearchInput';
import { geocodeLocationQuery, LocationBounds, LocationSuggestion, searchLocationSuggestions, searchTags, SearchTag } from '../../application/services';
import { SearchFilterScope, useSearchFilters } from '../context/SearchFiltersContext';

function buildChips(filters: ReturnType<typeof useSearchFilters>['filters']): FilterChipItem[] {
  const chips: FilterChipItem[] = [];

  if (filters.query.trim()) {
    chips.push({ key: 'query', label: `Search: ${filters.query.trim()}` });
  }

  if (filters.location.trim()) {
    chips.push({ key: 'location', label: `Location: ${filters.location.trim()}` });
  }

  if (filters.proximityRadiusKm && filters.proximityCoordinates) {
    chips.push({ key: 'proximityRadiusKm', label: `Distance: ${filters.proximityRadiusKm} km` });
  }

  if (filters.timeFrom.trim()) {
    chips.push({ key: 'timeFrom', label: `From: ${filters.timeFrom.trim()}` });
  }

  if (filters.timeTo.trim()) {
    chips.push({ key: 'timeTo', label: `To: ${filters.timeTo.trim()}` });
  }

  filters.tags.forEach((tag) => {
    chips.push({ key: `tag:${tag}`, label: `Tag: ${tag}` });
  });

  return chips;
}

interface StorySearchControlsProps {
  helperText?: string;
  hideHeading?: boolean;
  scope: SearchFilterScope;
}

export function StorySearchControls({ helperText, hideHeading = false, scope }: StorySearchControlsProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { height } = useWindowDimensions();
  const { filters, updateFilters, removeFilter, clearFilters, applyFilters } = useSearchFilters(scope);
  const [showFilters, setShowFilters] = useState(false);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [draftLocation, setDraftLocation] = useState('');
  const [draftLocationBounds, setDraftLocationBounds] = useState<LocationBounds | undefined>();
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLocationResolving, setIsLocationResolving] = useState(false);
  const [locationStatusText, setLocationStatusText] = useState<string | undefined>();
  const [isLocationError, setIsLocationError] = useState(false);
  const [draftProximityRadiusKm, setDraftProximityRadiusKm] = useState<ProximityRadiusOption | undefined>();
  const [draftProximityCoordinates, setDraftProximityCoordinates] = useState<DeviceCoordinates | undefined>();
  const [isProximityResolving, setIsProximityResolving] = useState(false);
  const [proximityStatusText, setProximityStatusText] = useState<string | undefined>();
  const [isProximityError, setIsProximityError] = useState(false);
  const [draftTimeFrom, setDraftTimeFrom] = useState('');
  const [draftTimeTo, setDraftTimeTo] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftTagQuery, setDraftTagQuery] = useState('');
  const [tagOptions, setTagOptions] = useState<SearchTag[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(false);
  const debouncedDraftLocation = useDebounce(draftLocation, 500);
  const debouncedDraftTagQuery = useDebounce(draftTagQuery, 300);
  const locationRequestIdRef = useRef(0);
  const selectedLocationQueryRef = useRef<string | undefined>(undefined);
  const proximityRequestIdRef = useRef(0);
  const tagRequestIdRef = useRef(0);

  const chips = useMemo(() => buildChips(filters), [filters]);
  const filterModalMaxHeight = Math.max(height - spacing.xl * 4, 360);

  const openFilters = () => {
    setIsTagPickerOpen(false);
    setDraftLocation(filters.location);
    setDraftLocationBounds(filters.locationBounds);
    setLocationSuggestions([]);
    setLocationStatusText(undefined);
    setIsLocationError(false);
    setIsLocationResolving(false);
    setDraftProximityRadiusKm(filters.proximityRadiusKm);
    setDraftProximityCoordinates(filters.proximityCoordinates);
    setProximityStatusText(
      filters.proximityRadiusKm && filters.proximityCoordinates ? 'Using your current location.' : undefined,
    );
    setIsProximityError(false);
    setIsProximityResolving(false);
    setDraftTimeFrom(filters.timeFrom);
    setDraftTimeTo(filters.timeTo);
    setDraftTags(filters.tags);
    setDraftTagQuery('');
    setTagOptions([]);
    setShowFilters(true);
  };

  const toggleDraftTag = (tag: string) => {
    setDraftTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag],
    );
  };

  const handleDraftLocationChange = (location: string) => {
    setDraftLocation(location);
    setDraftLocationBounds(undefined);
    setLocationSuggestions([]);
    setLocationStatusText(undefined);
    setIsLocationError(false);
    selectedLocationQueryRef.current = undefined;
    setIsLocationResolving(location.trim().length > 0);
  };

  const handleLocationSuggestionPress = (suggestion: LocationSuggestion) => {
    selectedLocationQueryRef.current = suggestion.title;
    setDraftLocation(suggestion.title);
    setDraftLocationBounds(suggestion.bounds ?? buildFallbackBounds(suggestion.latitude, suggestion.longitude));
    setLocationSuggestions([]);
    setIsLocationResolving(false);
    setIsLocationError(false);
    setLocationStatusText('Filtering by map area.');
  };

  const handleProximityRadiusChange = async (radiusKm?: ProximityRadiusOption) => {
    const requestId = proximityRequestIdRef.current + 1;
    proximityRequestIdRef.current = requestId;
    setDraftProximityRadiusKm(radiusKm);
    setIsProximityError(false);

    if (!radiusKm) {
      setDraftProximityCoordinates(undefined);
      setIsProximityResolving(false);
      setProximityStatusText(undefined);
      return;
    }

    setDraftProximityCoordinates(undefined);
    setIsProximityResolving(true);
    setProximityStatusText('Fetching your current location...');

    const result = await getCurrentDeviceCoordinates();

    if (proximityRequestIdRef.current !== requestId) {
      return;
    }

    setIsProximityResolving(false);

    if (result.status === 'granted') {
      setDraftProximityCoordinates(result.coordinates);
      setProximityStatusText(
        `Filtering within ${radiusKm} km of ${result.coordinates.latitude.toFixed(4)}, ${result.coordinates.longitude.toFixed(4)}.`,
      );
      return;
    }

    setIsProximityError(true);
    setProximityStatusText(
      result.status === 'denied'
        ? 'Location disabled. Enable location permission to use proximity filtering.'
        : 'Current location is unavailable. Try again or choose Anywhere.',
    );
  };

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    const requestId = tagRequestIdRef.current + 1;
    tagRequestIdRef.current = requestId;
    setIsTagsLoading(true);

    searchTags(debouncedDraftTagQuery)
      .then((tags) => {
        if (tagRequestIdRef.current !== requestId) {
          return;
        }

        const selectedTagOptions = draftTags.map((tag) => ({
          id: `selected-${tag}`,
          name: tag,
        }));
        const mergedTags = [...selectedTagOptions, ...tags];
        setTagOptions(
          mergedTags.filter(
            (tag, index, values) => values.findIndex((candidate) => candidate.name === tag.name) === index,
          ),
        );
      })
      .catch(() => {
        if (tagRequestIdRef.current === requestId) {
          setTagOptions(
            draftTags.map((tag) => ({
              id: `selected-${tag}`,
              name: tag,
            })),
          );
        }
      })
      .finally(() => {
        if (tagRequestIdRef.current === requestId) {
          setIsTagsLoading(false);
        }
      });
  }, [debouncedDraftTagQuery, draftTags, showFilters]);

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    const location = debouncedDraftLocation.trim();
    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;

    if (!location) {
      setDraftLocationBounds(undefined);
      setLocationSuggestions([]);
      setIsLocationResolving(false);
      setLocationStatusText(undefined);
      setIsLocationError(false);
      return;
    }

    if (selectedLocationQueryRef.current === location && draftLocationBounds) {
      selectedLocationQueryRef.current = undefined;
      setIsLocationResolving(false);
      return;
    }

    setIsLocationResolving(true);
    setLocationStatusText('Looking up this place...');
    setIsLocationError(false);

    Promise.all([geocodeLocationQuery(location), searchLocationSuggestions(location)])
      .then(([bounds, suggestions]) => {
        if (locationRequestIdRef.current !== requestId) {
          return;
        }

        setDraftLocationBounds(bounds ?? undefined);
        setLocationSuggestions(suggestions);
        setIsLocationError(!bounds);
        setLocationStatusText(bounds ? 'Filtering by map area.' : 'Location not found. Choose a listed place before applying.');
      })
      .catch(() => {
        if (locationRequestIdRef.current !== requestId) {
          return;
        }

        setDraftLocationBounds(undefined);
        setLocationSuggestions([]);
        setIsLocationError(true);
        setLocationStatusText('Location lookup failed. Try again before applying.');
      })
      .finally(() => {
        if (locationRequestIdRef.current === requestId) {
          setIsLocationResolving(false);
        }
      });
  }, [debouncedDraftLocation, showFilters]);

  return (
    <View style={{ gap: spacing.md }}>
      {hideHeading ? null : (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
            Search stories
          </Text>
          {helperText ? <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>{helperText}</Text> : null}
        </View>
      )}

      <SearchInput
        value={filters.query}
        onChangeText={(query) => updateFilters({ query })}
        onSearch={() => applyFilters()}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => (showFilters ? setShowFilters(false) : openFilters())}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {showFilters ? 'Hide filters' : 'Show filters'}
          </Text>
        </Pressable>
        {chips.length > 0 ? (
          <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
            {chips.length} active filter{chips.length === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showFilters}
        onRequestClose={() => {
          setShowFilters(false);
          setIsTagPickerOpen(false);
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          onPress={() => {
            setShowFilters(false);
            setIsTagPickerOpen(false);
          }}
          style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: 'rgba(17, 24, 39, 0.35)',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xl,
          }}
        >
          <Pressable onPress={(event) => event?.stopPropagation?.()} style={{ width: '100%', maxHeight: filterModalMaxHeight }}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              <FilterPanel
                location={draftLocation}
                locationSuggestions={locationSuggestions}
                timeFrom={draftTimeFrom}
                timeTo={draftTimeTo}
                selectedTags={draftTags}
                tagQuery={draftTagQuery}
                tagOptions={tagOptions}
                isTagsLoading={isTagsLoading}
                onLocationChange={handleDraftLocationChange}
                onLocationSuggestionPress={handleLocationSuggestionPress}
                onTimeFromChange={setDraftTimeFrom}
                onTimeToChange={setDraftTimeTo}
                onTagQueryChange={setDraftTagQuery}
                onToggleTag={toggleDraftTag}
                onRemoveTag={(tag) => setDraftTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag))}
                proximityRadiusKm={draftProximityRadiusKm}
                onProximityRadiusChange={handleProximityRadiusChange}
                isProximityResolving={isProximityResolving}
                proximityStatusText={proximityStatusText}
                isProximityError={isProximityError}
                isLocationResolving={isLocationResolving}
                locationStatusText={locationStatusText}
                isApplyDisabled={
                  isLocationResolving ||
                  isLocationError ||
                  Boolean(draftLocation.trim() && !draftLocationBounds) ||
                  isProximityResolving ||
                  Boolean(draftProximityRadiusKm && !draftProximityCoordinates)
                }
                onTagPickerOpenChange={setIsTagPickerOpen}
                onClearAll={() => {
                  setDraftLocation('');
                  setDraftLocationBounds(undefined);
                  setLocationSuggestions([]);
                  setLocationStatusText(undefined);
                  setIsLocationError(false);
                  setDraftProximityRadiusKm(undefined);
                  setDraftProximityCoordinates(undefined);
                  setProximityStatusText(undefined);
                  setIsProximityError(false);
                  setDraftTimeFrom('');
                  setDraftTimeTo('');
                  setDraftTags([]);
                  setDraftTagQuery('');
                  clearFilters();
                }}
                onApply={() => {
                  updateFilters({
                    location: draftLocation,
                    locationBounds: draftLocation.trim() ? draftLocationBounds : undefined,
                    proximityRadiusKm: draftProximityRadiusKm,
                    proximityCoordinates: draftProximityRadiusKm ? draftProximityCoordinates : undefined,
                    timeFrom: draftTimeFrom,
                    timeTo: draftTimeTo,
                    tags: draftTags,
                  }, { refresh: true });
                  applyFilters();
                  setShowFilters(false);
                }}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <FilterChips
        chips={chips}
        onRemove={(key) => {
          if (key.startsWith('tag:')) {
            updateFilters(
              { tags: filters.tags.filter((tag) => tag !== key.slice(4)) },
              { refresh: true },
            );
            return;
          }

          removeFilter(key as keyof typeof filters);
        }}
        onClearAll={clearFilters}
      />
    </View>
  );
}

function buildFallbackBounds(latitude: number, longitude: number): LocationBounds {
  const delta = 0.01;

  return {
    latMin: latitude - delta,
    latMax: latitude + delta,
    lngMin: longitude - delta,
    lngMax: longitude + delta,
  };
}
