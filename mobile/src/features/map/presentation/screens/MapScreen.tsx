import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
}: MapScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, isHydrated } = useSearchFilters();
  const debouncedQuery = useDebounce(filters.query, 350);
  const [state, setState] = useState<MapUiState>(() => createInitialMapUiState(initialFilters));

  const activeFilters = useMemo<StoryFilters>(
    () => ({
      ...initialFilters,
      ...toSearchParams({ ...filters, query: debouncedQuery }),
    }),
    [debouncedQuery, filters, initialFilters],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let active = true;

    setState((current) => ({
      ...current,
      isLoading: true,
      error: undefined,
      filters: activeFilters,
    }));

    getMarkerGroups(activeFilters)
      .then((markers) => {
        if (!active) {
          return;
        }

        const selectedMarkerId = getPreferredMarkerId(markers, activeFilters);

        setState({
          isLoading: false,
          error: undefined,
          filters: activeFilters,
          markers,
          selectedMarkerId,
        });
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }

        setState({
          isLoading: false,
          error: error.message || 'Unable to load stories',
          filters: activeFilters,
          markers: [],
          selectedMarkerId: undefined,
        });
      });

    return () => {
      active = false;
    };
  }, [activeFilters, getMarkerGroups, isHydrated]);

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

  return (
    <View style={{ gap: spacing.md }}>
      <StorySearchControls helperText="Search by title or place." />
      {activeFilterSummary.length ? <Text style={{ color: colors.muted }}>{activeFilterSummary.join('  |  ')}</Text> : null}

      <View
        style={{
          padding: spacing.md,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.infoSurface,
          gap: spacing.xs,
        }}
      >
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>Map</Text>
        <Text style={{ color: colors.muted }}>
          {state.markers.reduce((sum, marker) => sum + marker.count, 0)} stories currently match the active filters.
        </Text>
      </View>

      <View style={{ minHeight: 420 }}>
        <MapCard
          region={ISTANBUL_REGION}
          markers={state.markers}
          selectedMarkerId={state.selectedMarkerId}
          isLoading={state.isLoading}
          error={state.error}
          onSelectMarker={(markerId) => setState((current) => ({ ...current, selectedMarkerId: markerId }))}
          onOpenStory={(storyId) => onOpenStory?.(storyId)}
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
