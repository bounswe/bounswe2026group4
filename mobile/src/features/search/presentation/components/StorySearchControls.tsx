import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { DeviceCoordinates, getCurrentDeviceCoordinates } from '../../../../core/services/deviceLocation';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import {
  FilterPanel,
  ProximityRadiusOption,
} from '../../../../shared/components/FilterPanel';
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

  if (filters.proximityRadiusKm && filters.proximityCoordinates) {
    chips.push({ key: 'proximityRadiusKm', label: `Distance: ${filters.proximityRadiusKm} km` });
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
  const [draftProximityRadiusKm, setDraftProximityRadiusKm] = useState<ProximityRadiusOption | undefined>();
  const [draftProximityCoordinates, setDraftProximityCoordinates] = useState<DeviceCoordinates | undefined>();
  const [isProximityResolving, setIsProximityResolving] = useState(false);
  const [proximityStatusText, setProximityStatusText] = useState<string | undefined>();
  const [isProximityError, setIsProximityError] = useState(false);
  const [draftTimeFrom, setDraftTimeFrom] = useState('');
  const [draftTimeTo, setDraftTimeTo] = useState('');
  const debouncedDraftLocation = useDebounce(draftLocation, 500);
  const locationRequestIdRef = useRef(0);
  const proximityRequestIdRef = useRef(0);

  const chips = useMemo(() => buildChips(filters), [filters]);

  const openFilters = () => {
    setDraftLocation(filters.location);
    setDraftLocationBounds(filters.locationBounds);
    setLocationStatusText(undefined);
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
    setShowFilters(true);
  };

  const handleDraftLocationChange = (location: string) => {
    setDraftLocation(location);
    setDraftLocationBounds(undefined);
    setLocationStatusText(undefined);
    setIsLocationResolving(location.trim().length > 0);
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
              proximityRadiusKm={draftProximityRadiusKm}
              onProximityRadiusChange={handleProximityRadiusChange}
              isProximityResolving={isProximityResolving}
              proximityStatusText={proximityStatusText}
              isProximityError={isProximityError}
              isLocationResolving={isLocationResolving}
              locationStatusText={locationStatusText}
              isApplyDisabled={isLocationResolving || isProximityResolving || Boolean(draftProximityRadiusKm && !draftProximityCoordinates)}
              onClearAll={() => {
                setDraftLocation('');
                setDraftLocationBounds(undefined);
                setLocationStatusText(undefined);
                setDraftProximityRadiusKm(undefined);
                setDraftProximityCoordinates(undefined);
                setProximityStatusText(undefined);
                setIsProximityError(false);
                setDraftTimeFrom('');
                setDraftTimeTo('');
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
