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
  onMapGestureActiveChange?: (active: boolean) => void;
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
const MIN_LOCATION_DELTA = 0.02;
const LOCATION_BOUNDS_PADDING_FACTOR = 1.15;
const PROXIMITY_PADDING_FACTOR = 2.4;
const KILOMETERS_PER_LATITUDE_DEGREE = 111;
const MAX_AUTO_REGION_DELTA = 20;
type StatusIndicatorMode = 'hidden' | 'filters' | 'area';

export function MapScreen({
  initialFilters = EMPTY_FILTERS,
  onOpenStory,
  getMarkerGroups = mapService.getMarkerGroups,
  onMarkerPreviewRequested,
  onMapGestureActiveChange,
  showSearchControls = true,
  onRegisterRefresh,
  searchScope = 'map',
}: MapScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, refreshToken, isHydrated } = useSearchFilters(searchScope);
  const debouncedQuery = useDebounce(filters.query, 350);
  const [useImmediateQuery, setUseImmediateQuery] = useState(false);
  const [state, setState] = useState<MapUiState>(() => createInitialMapUiState(initialFilters));
  const [mapRegion, setMapRegion] = useState<Region>(ISTANBUL_REGION);
  const [mapCardTop, setMapCardTop] = useState(0);
  const [visibleRegion, setVisibleRegion] = useState<Region | undefined>();
  const [hasInteractedWithArea, setHasInteractedWithArea] = useState(false);
  const [statusIndicatorMode, setStatusIndicatorMode] = useState<StatusIndicatorMode>('hidden');
  const lastAutoZoomContextKeyRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
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
      activeFilters.radiusKm,
  );
  const autoZoomContextKey = useMemo(
    () => `${buildAutoZoomContextKey(activeFilters)}:${refreshToken}`,
    [activeFilters, refreshToken],
  );

  const loadMarkers = React.useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setState((current) => ({
      ...current,
      isLoading: true,
      error: undefined,
      filters: activeFilters,
    }));

    try {
      const markers = await getMarkerGroups(activeFilters);
      const selectedMarkerId = getPreferredMarkerId(markers, activeFilters);
      const nextAutoRegion = getAutoZoomRegion(markers, activeFilters);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      setState({
        isLoading: false,
        error: undefined,
        filters: activeFilters,
        markers,
        selectedMarkerId,
      });

      if (nextAutoRegion && lastAutoZoomContextKeyRef.current !== autoZoomContextKey) {
        lastAutoZoomContextKeyRef.current = autoZoomContextKey;
        setMapRegion(nextAutoRegion);
      }
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      setState({
        isLoading: false,
        error: error instanceof Error ? error.message || 'Unable to load stories' : 'Unable to load stories',
        filters: activeFilters,
        markers: [],
        selectedMarkerId: undefined,
      });
    }
  }, [activeFilters, autoZoomContextKey, getMarkerGroups]);

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

    return parts;
  }, [state.filters]);

  const totalStoryCount = useMemo(
    () => state.markers.reduce((sum, marker) => sum + marker.count, 0),
    [state.markers],
  );

  const userLocation = filters.proximityRadiusKm && filters.proximityCoordinates ? filters.proximityCoordinates : undefined;
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
  }, [activeFilters.location, activeFilters.locationBounds, state.error, state.isLoading, statusIndicatorMode, statusStoryCount]);

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
          userLocation={userLocation}
          onSelectMarker={(markerId) => setState((current) => ({ ...current, selectedMarkerId: markerId }))}
          onOpenStory={(storyId) => onOpenStory?.(storyId)}
          onMarkerPress={handleMarkerPreviewRequest}
          onMapGestureActiveChange={onMapGestureActiveChange}
          onRegionChangeComplete={(region) => {
            setMapRegion(region);
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
    const normalizedPreview = story.previewText.toLowerCase();

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

      if (normalizedPreview.includes(searchTerm)) {
        score += 2;
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

function buildAutoZoomContextKey(filters: StoryFilters) {
  return JSON.stringify({
    q: filters.q ?? '',
    location: filters.location ?? '',
    locationBounds: filters.locationBounds
      ? [
          filters.locationBounds.latMin,
          filters.locationBounds.latMax,
          filters.locationBounds.lngMin,
          filters.locationBounds.lngMax,
        ]
      : null,
    yearFrom: filters.yearFrom ?? null,
    yearTo: filters.yearTo ?? null,
    latitude: filters.latitude ?? null,
    longitude: filters.longitude ?? null,
    radiusKm: filters.radiusKm ?? null,
  });
}

function getAutoZoomRegion(markers: MapMarkerGroup[], filters: StoryFilters): Region | undefined {
  if (filters.locationBounds) {
    return getRegionForLocationBounds(filters.locationBounds);
  }

  if (filters.latitude !== undefined && filters.longitude !== undefined && filters.radiusKm !== undefined) {
    return getRegionForProximityFilter(filters.latitude, filters.longitude, filters.radiusKm);
  }

  if (!markers.length) {
    return undefined;
  }

  return getRegionForMarkers(markers);
}

function getRegionForMarkers(markers: MapMarkerGroup[]): Region {
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

function getRegionForLocationBounds(bounds: NonNullable<StoryFilters['locationBounds']>): Region {
  const minLatitude = Math.min(bounds.latMin, bounds.latMax);
  const maxLatitude = Math.max(bounds.latMin, bounds.latMax);
  const minLongitude = Math.min(bounds.lngMin, bounds.lngMax);
  const maxLongitude = Math.max(bounds.lngMin, bounds.lngMax);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: clampRegionDelta((maxLatitude - minLatitude) * LOCATION_BOUNDS_PADDING_FACTOR, MIN_LOCATION_DELTA),
    longitudeDelta: clampRegionDelta((maxLongitude - minLongitude) * LOCATION_BOUNDS_PADDING_FACTOR, MIN_LOCATION_DELTA),
  };
}

function getRegionForProximityFilter(latitude: number, longitude: number, radiusKm: number): Region {
  const latitudeDelta = (radiusKm / KILOMETERS_PER_LATITUDE_DEGREE) * PROXIMITY_PADDING_FACTOR;
  const longitudeDegreesPerKm = KILOMETERS_PER_LATITUDE_DEGREE * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
  const longitudeDelta = (radiusKm / longitudeDegreesPerKm) * PROXIMITY_PADDING_FACTOR;

  return {
    latitude,
    longitude,
    latitudeDelta: clampRegionDelta(latitudeDelta, MIN_LOCATION_DELTA),
    longitudeDelta: clampRegionDelta(longitudeDelta, MIN_LOCATION_DELTA),
  };
}

function clampRegionDelta(value: number, minimum: number) {
  return Math.min(Math.max(value, minimum), MAX_AUTO_REGION_DELTA);
}
