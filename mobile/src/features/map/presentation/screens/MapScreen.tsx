import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';
import { mapService } from '../../application/services';
import { createInitialMapUiState, MapUiState } from '../state/mapUiState';
import { MapCard } from '../components/MapCard';
import { useSearchFilters, toSearchParams } from '../../../search/presentation/context/SearchFiltersContext';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { StorySearchControls } from '../../../search/presentation/components/StorySearchControls';

interface MapScreenProps {
  initialFilters?: StoryFilters;
  onOpenStory?: (storyId: string) => void;
  getMarkerGroups?: (filters?: StoryFilters) => Promise<MapMarkerGroup[]>;
  onMarkerPreviewRequested?: (targetY: number) => void;
  showSearchControls?: boolean;
  onRegisterRefresh?: (handler: (() => Promise<void>) | null) => void;
}

const EMPTY_FILTERS: StoryFilters = {};

const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function MapScreen({
  initialFilters = EMPTY_FILTERS,
  onOpenStory,
  getMarkerGroups = mapService.getMarkerGroups,
  onMarkerPreviewRequested,
  showSearchControls = true,
  onRegisterRefresh,
}: MapScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, isHydrated } = useSearchFilters();
  const debouncedQuery = useDebounce(filters.query, 350);
  const [state, setState] = useState<MapUiState>(() => createInitialMapUiState(initialFilters));
  const [mapCardTop, setMapCardTop] = useState(0);
  const previewOffsetRef = useRef<number | null>(null);

  const activeFilters = useMemo<StoryFilters>(
    () => ({
      ...initialFilters,
      ...toSearchParams({ ...filters, query: debouncedQuery }),
    }),
    [debouncedQuery, filters, initialFilters],
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

    return parts;
  }, [state.filters]);

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
      {showSearchControls ? <StorySearchControls helperText="Search by title or place." /> : null}
      {activeFilterSummary.length ? <Text style={{ color: colors.muted }}>{activeFilterSummary.join('  |  ')}</Text> : null}

      <Text style={{ color: colors.muted, fontSize: typography.caption }}>
        {state.markers.reduce((sum, marker) => sum + marker.count, 0)} stories currently match the active filters.
      </Text>

      <View
        testID="map-card-container"
        style={{ minHeight: 420 }}
        onLayout={(event) => setMapCardTop(event.nativeEvent.layout.y)}
      >
        <MapCard
          region={ISTANBUL_REGION}
          markers={state.markers}
          selectedMarkerId={state.selectedMarkerId}
          isLoading={state.isLoading}
          error={state.error}
          onSelectMarker={(markerId) => setState((current) => ({ ...current, selectedMarkerId: markerId }))}
          onOpenStory={(storyId) => onOpenStory?.(storyId)}
          onMarkerPress={handleMarkerPreviewRequest}
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
    return markers[0]?.id;
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
