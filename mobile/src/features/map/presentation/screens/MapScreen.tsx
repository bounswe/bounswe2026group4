import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button';
import { StoryFilters } from '../../../stories/domain/repositories';
import { MapMarkerGroup } from '../../domain/entities';
import { mapService } from '../../application/services';
import { createInitialMapUiState, MapUiState } from '../state/mapUiState';
import { MapCard } from '../components/MapCard';

interface MapScreenProps {
  initialFilters?: StoryFilters;
  onOpenStory?: (storyId: string) => void;
  getMarkerGroups?: (filters?: StoryFilters) => Promise<MapMarkerGroup[]>;
}

const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function MapScreen({
  initialFilters = {},
  onOpenStory,
  getMarkerGroups = mapService.getMarkerGroups,
}: MapScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const [state, setState] = useState<MapUiState>(() => createInitialMapUiState(initialFilters));
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    q: initialFilters.q ?? '',
    location: initialFilters.location ?? '',
    yearFrom: initialFilters.yearFrom ? String(initialFilters.yearFrom) : '',
    yearTo: initialFilters.yearTo ? String(initialFilters.yearTo) : '',
  });

  useEffect(() => {
    let active = true;
    const nextFilters = normalizeFilters(draftFilters);

    setState((current) => ({
      ...current,
      isLoading: true,
      error: undefined,
      filters: nextFilters,
    }));

    getMarkerGroups(nextFilters)
      .then((markers) => {
        if (!active) {
          return;
        }

        const selectedMarkerId = getPreferredMarkerId(markers, nextFilters);

        setState({
          isLoading: false,
          error: undefined,
          filters: nextFilters,
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
          filters: nextFilters,
          markers: [],
          selectedMarkerId: undefined,
        });
      });

    return () => {
      active = false;
    };
  }, [draftFilters, getMarkerGroups]);

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

  const hasActiveFilters =
    Boolean(draftFilters.location.trim()) ||
    Boolean(draftFilters.yearFrom.trim()) ||
    Boolean(draftFilters.yearTo.trim());

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            gap: spacing.md,
          }}
        >
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
            Search stories
          </Text>
          <Input
            value={draftFilters.q}
            onChangeText={(value) => setDraftFilters((current) => ({ ...current, q: value }))}
            placeholder="Search stories or neighborhoods"
            accessibilityLabel="Search stories"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button onPress={() => setFiltersExpanded((current) => !current)}>
                {filtersExpanded ? 'Hide filters' : 'Open filters'}
              </Button>
            </View>
            {hasActiveFilters ? (
              <View style={{ flex: 1 }}>
                <Button
                  onPress={() =>
                    setDraftFilters({
                      q: '',
                      location: '',
                      yearFrom: '',
                      yearTo: '',
                    })
                  }
                >
                  Reset filters
                </Button>
              </View>
            ) : null}
          </View>
        </View>

        {filtersExpanded ? (
          <View
            style={{
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Advanced filters</Text>
            <Input
              value={draftFilters.location}
              onChangeText={(value) => setDraftFilters((current) => ({ ...current, location: value }))}
              placeholder="Filter by place name"
              accessibilityLabel="Filter by location"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input
                  value={draftFilters.yearFrom}
                  onChangeText={(value) =>
                    setDraftFilters((current) => ({ ...current, yearFrom: sanitizeYear(value) }))
                  }
                  placeholder="Year from"
                  accessibilityLabel="Year from"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={draftFilters.yearTo}
                  onChangeText={(value) =>
                    setDraftFilters((current) => ({ ...current, yearTo: sanitizeYear(value) }))
                  }
                  placeholder="Year to"
                  accessibilityLabel="Year to"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>
        ) : null}
        {activeFilterSummary.length ? <Text style={{ color: colors.muted }}>{activeFilterSummary.join('  |  ')}</Text> : null}

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
    </View>
  );
}

function sanitizeYear(value: string) {
  return value.replace(/[^0-9]/g, '').slice(0, 4);
}

function normalizeFilters(filters: {
  q: string;
  location: string;
  yearFrom: string;
  yearTo: string;
}): StoryFilters {
  return {
    q: filters.q.trim() || undefined,
    location: filters.location.trim() || undefined,
    yearFrom: filters.yearFrom ? Number(filters.yearFrom) : undefined,
    yearTo: filters.yearTo ? Number(filters.yearTo) : undefined,
  };
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
