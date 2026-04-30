import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { DEFAULT_FROM_YEAR, DEFAULT_TO_YEAR, FilterPanel } from '../../../../shared/components/FilterPanel';
import { FilterChipItem, FilterChips } from '../../../../shared/components/FilterChips';
import { SearchInput } from '../../../../shared/components/SearchInput';
import { geocodeLocationQuery, LocationBounds } from '../../application/services';
import { SearchFilterScope, useSearchFilters } from '../context/SearchFiltersContext';

function buildChips(
  filters: ReturnType<typeof useSearchFilters>['filters'],
): FilterChipItem[] {
  const chips: FilterChipItem[] = [];

  if (filters.query.trim()) {
    chips.push({ key: 'query', label: `Search: ${filters.query.trim()}` });
  }

  if (filters.location.trim()) {
    chips.push({ key: 'location', label: `Location: ${filters.location.trim()}` });
  }

  if (filters.timeFrom.trim()) {
    chips.push({ key: 'timeFrom', label: `From: ${filters.timeFrom.trim()}` });
  }

  if (filters.timeTo.trim()) {
    chips.push({ key: 'timeTo', label: `To: ${filters.timeTo.trim()}` });
  }

  return chips;
}

interface StorySearchControlsProps {
  helperText?: string;
  hideHeading?: boolean;
  scope: SearchFilterScope;
}

export function StorySearchControls({ helperText, hideHeading = false, scope }: StorySearchControlsProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, updateFilters, removeFilter, clearFilters, applyFilters } = useSearchFilters(scope);
  const [showFilters, setShowFilters] = useState(false);
  const [draftLocation, setDraftLocation] = useState('');
  const [draftLocationBounds, setDraftLocationBounds] = useState<LocationBounds | undefined>();
  const [isLocationResolving, setIsLocationResolving] = useState(false);
  const [locationStatusText, setLocationStatusText] = useState<string | undefined>();
  const [draftTimeFrom, setDraftTimeFrom] = useState(DEFAULT_FROM_YEAR);
  const [draftTimeTo, setDraftTimeTo] = useState(DEFAULT_TO_YEAR);
  const debouncedDraftLocation = useDebounce(draftLocation, 500);
  const locationRequestIdRef = useRef(0);

  const chips = useMemo(() => buildChips(filters), [filters]);

  const openFilters = () => {
    setDraftLocation(filters.location);
    setDraftLocationBounds(filters.locationBounds);
    setLocationStatusText(undefined);
    setIsLocationResolving(false);
    setDraftTimeFrom(filters.timeFrom || DEFAULT_FROM_YEAR);
    setDraftTimeTo(filters.timeTo || DEFAULT_TO_YEAR);
    setShowFilters(true);
  };

  const handleDraftLocationChange = (location: string) => {
    setDraftLocation(location);
    setDraftLocationBounds(undefined);
    setLocationStatusText(undefined);
    setIsLocationResolving(location.trim().length > 0);
  };

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    const location = debouncedDraftLocation.trim();
    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;

    if (!location) {
      setDraftLocationBounds(undefined);
      setIsLocationResolving(false);
      setLocationStatusText(undefined);
      return;
    }

    setIsLocationResolving(true);
    setLocationStatusText('Looking up this place...');

    geocodeLocationQuery(location)
      .then((bounds) => {
        if (locationRequestIdRef.current !== requestId) {
          return;
        }

        setDraftLocationBounds(bounds ?? undefined);
        setLocationStatusText(
          bounds ? 'Filtering by map area.' : 'No map match found. Apply will search story place names instead.',
        );
      })
      .catch(() => {
        if (locationRequestIdRef.current !== requestId) {
          return;
        }

        setDraftLocationBounds(undefined);
        setLocationStatusText('Location lookup failed. Apply will search story place names instead.');
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
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          onPress={() => setShowFilters(false)}
          style={{
            flex: 1,
            justifyContent: 'flex-start',
            backgroundColor: 'rgba(17, 24, 39, 0.35)',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl * 2,
          }}
        >
          <Pressable onPress={(event) => event?.stopPropagation?.()} style={{ width: '100%' }}>
            <FilterPanel
              location={draftLocation}
              timeFrom={draftTimeFrom}
              timeTo={draftTimeTo}
              onLocationChange={handleDraftLocationChange}
              onTimeFromChange={setDraftTimeFrom}
              onTimeToChange={setDraftTimeTo}
              isLocationResolving={isLocationResolving}
              locationStatusText={locationStatusText}
              isApplyDisabled={isLocationResolving}
              onClearAll={() => {
                setDraftLocation('');
                setDraftLocationBounds(undefined);
                setLocationStatusText(undefined);
                setDraftTimeFrom(DEFAULT_FROM_YEAR);
                setDraftTimeTo(DEFAULT_TO_YEAR);
                clearFilters();
              }}
              onApply={() => {
                updateFilters({
                  location: draftLocation,
                  locationBounds: draftLocation.trim() ? draftLocationBounds : undefined,
                  timeFrom: draftTimeFrom,
                  timeTo: draftTimeTo,
                }, { refresh: true });
                applyFilters();
                setShowFilters(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <FilterChips
        chips={chips}
        onRemove={(key) => removeFilter(key as keyof typeof filters)}
        onClearAll={clearFilters}
      />
    </View>
  );
}
