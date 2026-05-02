import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';
import { mapService } from '../../application/services';
import { createInitialMapUiState, MapUiState } from '../state/mapUiState';
import { MapCard } from '../components/MapCard';
import { SearchFilterScope, useSearchFilters, toSearchParams } from '../../../search/presentation/context/SearchFiltersContext';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { StorySearchControls } from '../../../search/presentation/components/StorySearchControls';

interface MapScreenProps {
  initialFilters?: StoryFilters;
  onOpenStory?: (storyId: string) => void;
  getMarkerGroups?: (filters?: StoryFilters) => Promise<MapMarkerGroup[]>;
  onMarkerPreviewRequested?: (targetY: number) => void;
  showSearchControls?: boolean;
  onRegisterRefresh?: (handler: (() => Promise<void>) | null) => void;
  searchScope?: SearchFilterScope;
}

const EMPTY_FILTERS: StoryFilters = {};

const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.32,
  longitudeDelta: 0.48,
};

const MIN_FIT_DELTA = 0.06;
const FIT_PADDING_FACTOR = 2.6;
type StatusIndicatorMode = 'hidden' | 'filters' | 'area';

export function MapScreen({
  initialFilters = EMPTY_FILTERS,
  onOpenStory,
  getMarkerGroups = mapService.getMarkerGroups,
  onMarkerPreviewRequested,
  showSearchControls = true,
  onRegisterRefresh,
  searchScope = 'map',
}: MapScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, refreshToken, isHydrated } = useSearchFilters(searchScope);
  const debouncedQuery = useDebounce(filters.query, 350);
  const [useImmediateQuery, setUseImmediateQuery] = useState(false);
  const [state, setState] = useState<MapUiState>(() => createInitialMapUiState(initialFilters));
  const [mapCardTop, setMapCardTop] = useState(0);
  const [visibleRegion, setVisibleRegion] = useState<Region | undefined>();
  const [hasInteractedWithArea, setHasInteractedWithArea] = useState(false);
  const [statusIndicatorMode, setStatusIndicatorMode] = useState<StatusIndicatorMode>('hidden');
  const previewOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (filters.query !== debouncedQuery) {
      return;
    }

    setUseImmediateQuery(false);
  }, [debouncedQuery, filters.query]);

  useEffect(() => {
    setUseImmediateQuery(true);
  }, [refreshToken]);

  const activeFilters = useMemo<StoryFilters>(
    () => ({
      ...initialFilters,
      ...toSearchParams({ ...filters, query: useImmediateQuery ? filters.query : debouncedQuery }),
    }),
    [debouncedQuery, filters, initialFilters, useImmediateQuery],
  );

  const hasActiveFilters = Boolean(
    activeFilters.q ||
      activeFilters.location ||
      activeFilters.yearFrom ||
      activeFilters.yearTo ||
      activeFilters.radiusKm ||
      activeFilters.tags?.length,
  );

  const loadMarkers = React.useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoading: true,
      error: undefined,
      filters: activeFilters,
    }));

    try {
      const markers = await getMarkerGroups(activeFilters);
      const selectedMarkerId = getPreferredMarkerId(markers, activeFilters);

      setState({
        isLoading: false,
        error: undefined,
        filters: activeFilters,
        markers,
        selectedMarkerId,
      });
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message || 'Unable to load stories' : 'Unable to load stories',
        filters: activeFilters,
        markers: [],
        selectedMarkerId: undefined,
      });
    }
  }, [activeFilters, getMarkerGroups]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void loadMarkers();
  }, [isHydrated, loadMarkers]);

  useEffect(() => {
    onRegisterRefresh?.(isHydrated ? loadMarkers : null);

    return () => {
      onRegisterRefresh?.(null);
    };
  }, [isHydrated, loadMarkers, onRegisterRefresh]);

  useEffect(() => {
    setHasInteractedWithArea(false);
    setVisibleRegion(undefined);

    if (!hasActiveFilters) {
      setStatusIndicatorMode('hidden');
      return;
    }

    setStatusIndicatorMode('filters');
  }, [activeFilters, hasActiveFilters]);

  const activeFilterSummary = useMemo(() => {
    const parts = [];

    if (state.filters.q) {
      parts.push(`Search: ${state.filters.q}`);
    }
    if (state.filters.location) {
      parts.push(`Place: ${state.filters.location}`);
    }
    if (state.filters.yearFrom || state.filters.yearTo) {
      parts.push(`Years: ${state.filters.yearFrom ?? 'Any'}-${state.filters.yearTo ?? 'Any'}`);
    }
    if (state.filters.radiusKm) {
      const coordinates =
        state.filters.latitude !== undefined && state.filters.longitude !== undefined
          ? ` from ${state.filters.latitude.toFixed(4)}, ${state.filters.longitude.toFixed(4)}`
          : '';

      parts.push(`Distance: ${state.filters.radiusKm} km${coordinates}`);
    }
    if (state.filters.tags?.length) {
      parts.push(`Tag: ${state.filters.tags.join(', ')}`);
    }

    return parts;
  }, [state.filters]);

  const totalStoryCount = useMemo(
    () => state.markers.reduce((sum, marker) => sum + marker.count, 0),
    [state.markers],
  );

  const mapRegion = useMemo(
    () => getRegionForMarkers(state.markers, ISTANBUL_REGION),
    [state.markers],
  );
  const fitToMarkers = state.markers.length > 0 && (!state.selectedMarkerId || hasActiveFilters);

  const statusStoryCount = useMemo(() => {
    if (statusIndicatorMode !== 'area' || !hasInteractedWithArea || !visibleRegion) {
      return totalStoryCount;
    }

    return countStoriesInRegion(state.markers, visibleRegion);
  }, [hasInteractedWithArea, state.markers, statusIndicatorMode, totalStoryCount, visibleRegion]);

  const statusBadgeText = useMemo(() => {
    if (state.isLoading || state.error || statusIndicatorMode === 'hidden') {
      return undefined;
    }

    if (statusStoryCount > 0) {
      return `${formatStoryCount(statusStoryCount)} found in this area`;
    }

    if (statusIndicatorMode === 'area') {
      return 'No stories found in this area';
    }

    if (activeFilters.location?.trim() && !activeFilters.locationBounds) {
      return 'Place could not be found';
    }

    if (activeFilters.location?.trim()) {
      return `No stories found in ${activeFilters.location.trim()}`;
    }

    return 'No stories found with this criteria';
  }, [activeFilters.location, state.error, state.isLoading, statusIndicatorMode, statusStoryCount]);

  function handlePreviewLayout(event: LayoutChangeEvent) {
    previewOffsetRef.current = event.nativeEvent.layout.y;
  }

  function handleMarkerPreviewRequest() {
    const previewOffset = previewOffsetRef.current;

    if (previewOffset == null) {
      return;
    }

    onMarkerPreviewRequested?.(mapCardTop + previewOffset);
  }

  return (
    <View style={{ gap: spacing.md }}>
      {showSearchControls ? <StorySearchControls helperText="Search by title or place." scope={searchScope} /> : null}
      {activeFilterSummary.length ? <Text style={{ color: colors.muted }}>{activeFilterSummary.join('  |  ')}</Text> : null}

      <View
        testID="map-card-container"
        style={{ minHeight: 420 }}
        onLayout={(event) => setMapCardTop(event.nativeEvent.layout.y)}
      >
        <MapCard
          region={mapRegion}
          markers={state.markers}
          selectedMarkerId={state.selectedMarkerId}
          isLoading={state.isLoading}
          error={state.error}
          statusBadgeText={statusBadgeText}
          fitToMarkers={fitToMarkers}
          onSelectMarker={(markerId) => setState((current) => ({ ...current, selectedMarkerId: markerId }))}
          onOpenStory={(storyId) => onOpenStory?.(storyId)}
          onMarkerPress={handleMarkerPreviewRequest}
          onRegionChangeComplete={(region) => {
            setVisibleRegion(region);
            setHasInteractedWithArea(true);
            setStatusIndicatorMode('area');
          }}
          onPreviewLayout={handlePreviewLayout}
        />
      </View>
    </View>
  );
}

function getPreferredMarkerId(markers: MapMarkerGroup[], filters: StoryFilters) {
  if (!markers.length) {
    return undefined;
  }

  const searchTerm = filters.q?.trim().toLowerCase();
  const locationTerm = filters.location?.trim().toLowerCase();

  if (!searchTerm && !locationTerm) {
    return undefined;
  }

  const scoredMarkers = markers
    .map((marker) => ({
      marker,
      score: getMarkerScore(marker, searchTerm, locationTerm),
    }))
    .sort((left, right) => right.score - left.score);

  return scoredMarkers[0]?.marker.id ?? markers[0]?.id;
}

function getMarkerScore(marker: MapMarkerGroup, searchTerm?: string, locationTerm?: string) {
  return marker.stories.reduce((bestScore, story) => {
    let score = 0;
    const normalizedTitle = story.title.toLowerCase();
    const normalizedPlace = story.placeName.toLowerCase();

    if (searchTerm) {
      if (normalizedTitle === searchTerm) {
        score += 10;
      } else if (normalizedTitle.includes(searchTerm)) {
        score += 6;
      }

      if (normalizedPlace === searchTerm) {
        score += 8;
      } else if (normalizedPlace.includes(searchTerm)) {
        score += 5;
      }
    }

    if (locationTerm) {
      if (normalizedPlace === locationTerm) {
        score += 10;
      } else if (normalizedPlace.includes(locationTerm)) {
        score += 6;
      }
    }

    return Math.max(bestScore, score);
  }, 0);
}

function countStoriesInRegion(markers: MapMarkerGroup[], region: Region) {
  const latitudeMin = region.latitude - region.latitudeDelta / 2;
  const latitudeMax = region.latitude + region.latitudeDelta / 2;
  const longitudeMin = region.longitude - region.longitudeDelta / 2;
  const longitudeMax = region.longitude + region.longitudeDelta / 2;

  return markers.reduce((sum, marker) => {
    const isMarkerVisible =
      marker.latitude >= latitudeMin &&
      marker.latitude <= latitudeMax &&
      marker.longitude >= longitudeMin &&
      marker.longitude <= longitudeMax;

    return sum + (isMarkerVisible ? marker.count : 0);
  }, 0);
}

function formatStoryCount(count: number) {
  return `${count} ${count === 1 ? 'story' : 'stories'}`;
}

function getRegionForMarkers(markers: MapMarkerGroup[], fallbackRegion: Region): Region {
  if (!markers.length) {
    return fallbackRegion;
  }

  const latitudes = markers.map((marker) => marker.latitude);
  const longitudes = markers.map((marker) => marker.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * FIT_PADDING_FACTOR, MIN_FIT_DELTA),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * FIT_PADDING_FACTOR, MIN_FIT_DELTA),
  };
}
