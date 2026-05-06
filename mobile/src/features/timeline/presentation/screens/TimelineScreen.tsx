import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { EmptyState, ErrorState, Loader, SkeletonCard } from '../../../../shared';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { storyService } from '../../../stories/application/services';
import { StoryFilters } from '../../../stories/domain/repositories';
import { StorySearchControls } from '../../../search/presentation/components/StorySearchControls';
import {
  SearchFilterScope,
  SearchFiltersState,
  toSearchParams,
  useSearchFilters,
} from '../../../search/presentation/context/SearchFiltersContext';
import { TimelinePageEntity } from '../../domain/entities';
import { TimelineRequest } from '../../domain/repositories';
import { TimelineCard } from '../components/TimelineCard';
import {
  EMPTY_TIMELINE_PERIOD_SELECTION,
  TimelinePeriodSelection,
  TimelinePeriodSelector,
} from '../components/TimelinePeriodSelector';
import { createInitialTimelineUiState, TimelineUiState } from '../state/timelineUiState';

interface TimelineScreenProps {
  initialFilters?: StoryFilters;
  onOpenStory?: (storyId: string) => void;
  getTimeline?: typeof storyService.getTimeline;
  showSearchControls?: boolean;
  searchScope?: SearchFilterScope;
}

interface PeriodDescriptor {
  request: TimelineRequest;
  label: string;
  key: string;
  isReady: boolean;
  error?: string;
}

const EMPTY_FILTERS: StoryFilters = {};

export function TimelineScreen({
  initialFilters = EMPTY_FILTERS,
  onOpenStory,
  getTimeline = storyService.getTimeline,
  showSearchControls = true,
  searchScope = 'main',
}: TimelineScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, refreshToken, isHydrated, setFilters } = useSearchFilters(searchScope);
  const debouncedQuery = useDebounce(filters.query, 350);
  const [useImmediateQuery, setUseImmediateQuery] = useState(false);
  const [periodSelection, setPeriodSelection] = useState<TimelinePeriodSelection>(EMPTY_TIMELINE_PERIOD_SELECTION);
  const periodDescriptor = useMemo(() => describePeriodSelection(periodSelection), [periodSelection]);
  const [state, setState] = useState<TimelineUiState>(() => createInitialTimelineUiState(initialFilters));
  const stateRef = useRef(state);
  const hasRequestedNextPage = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const seedFilters = useMemo(() => toSearchState(initialFilters), [initialFilters]);

  useEffect(() => {
    if (!isHydrated || !hasAnySearchFilters(seedFilters) || areSearchStatesEqual(filters, seedFilters)) {
      return;
    }

    setFilters(seedFilters);
  }, [filters, isHydrated, seedFilters, setFilters]);

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
      activeFilters.locationBounds ||
      activeFilters.yearFrom !== undefined ||
      activeFilters.yearTo !== undefined ||
      activeFilters.radiusKm ||
      activeFilters.tags?.length ||
      (periodSelection.mode !== 'all' && periodDescriptor.isReady),
  );

  const loadPage = useCallback(
    async (
      page: number,
      mode: 'initial' | 'refresh' | 'append' = 'initial',
      overrides?: Partial<Pick<TimelineUiState, 'filters' | 'periodRequest'>>,
    ) => {
      const currentState = stateRef.current;
      const nextFilters = overrides?.filters ?? currentState.filters;
      const nextPeriodRequest = overrides?.periodRequest ?? currentState.periodRequest;

      if (mode === 'append' && (!currentState.hasNextPage || currentState.isLoadingMore || currentState.isLoading)) {
        return;
      }

      setState((current) => ({
        ...current,
        filters: nextFilters,
        periodRequest: nextPeriodRequest,
        isLoading: mode === 'initial',
        isRefreshing: mode === 'refresh',
        isLoadingMore: mode === 'append',
        error: mode === 'append' ? current.error : undefined,
      }));

      try {
        const response = await getTimeline({
          ...nextPeriodRequest,
          page,
          filters: nextFilters,
        });

        setState((current) => mergeTimelinePage(current, response, mode));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load the timeline.';

        setState((current) => ({
          ...current,
          isLoading: false,
          isRefreshing: false,
          isLoadingMore: false,
          error: message,
        }));
      } finally {
        hasRequestedNextPage.current = false;
      }
    },
    [getTimeline],
  );

  useEffect(() => {
    if (!isHydrated || periodDescriptor.error || !periodDescriptor.isReady) {
      return;
    }

    loadPage(1, 'initial', {
      filters: activeFilters,
      periodRequest: periodDescriptor.request,
    });
  }, [activeFilters, isHydrated, loadPage, periodDescriptor.error, periodDescriptor.isReady, periodDescriptor.key, periodDescriptor.request]);

  const handleEndReached = () => {
    if (hasRequestedNextPage.current || !state.hasNextPage || state.isLoading || state.isLoadingMore) {
      return;
    }

    hasRequestedNextPage.current = true;
    loadPage(state.page + 1, 'append');
  };

  const handleRefresh = () => {
    if (periodDescriptor.error || !periodDescriptor.isReady) {
      return;
    }

    loadPage(1, 'refresh', {
      filters: activeFilters,
      periodRequest: periodDescriptor.request,
    });
  };

  const handleRetry = () => {
    if (periodDescriptor.error || !periodDescriptor.isReady) {
      return;
    }

    loadPage(1, 'initial', {
      filters: activeFilters,
      periodRequest: periodDescriptor.request,
    });
  };

  const controls = (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
      <View>
        <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '900' }}>
          Timeline
        </Text>
      </View>

      {showSearchControls ? <StorySearchControls helperText="Search by title or place." scope={searchScope} /> : null}

      <TimelinePeriodSelector
        value={periodSelection}
        onChange={setPeriodSelection}
        error={periodDescriptor.error}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text style={{ flex: 1, color: colors.muted, fontSize: typography.caption + 1 }}>
          {periodDescriptor.label}
        </Text>
        <Text style={{ color: colors.text, fontSize: typography.caption + 1, fontWeight: '800' }}>
          {state.totalCount > 0 ? `${state.totalCount} stories` : hasActiveFilters ? 'No matching stories yet' : 'Oldest first'}
        </Text>
      </View>
    </View>
  );

  if (!isHydrated) {
    return <Loader message="Restoring timeline filters..." />;
  }

  if (state.isLoading && !state.items.length) {
    return (
      <View accessibilityLabel="Loading timeline stories" style={{ flex: 1, gap: spacing.md }}>
        {controls}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} showMedia={index % 2 === 0} />
          ))}
        </View>
      </View>
    );
  }

  if (state.error && !state.items.length) {
    return (
      <View style={{ flex: 1 }}>
        {controls}
        <ErrorState
          title="Timeline unavailable"
          message={state.error}
          retryLabel="Try again"
          onRetry={handleRetry}
        />
      </View>
    );
  }

  if (!state.items.length) {
    return (
      <View style={{ flex: 1 }}>
        {controls}
        <EmptyState
          title={hasActiveFilters ? 'No stories on this timeline' : 'Timeline is empty'}
          message={
            hasActiveFilters
              ? 'Try a wider year range, a different period, or removing a place or distance filter.'
              : 'Published stories will appear here from oldest to newest.'
          }
          actionLabel="Refresh"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  return (
    <FlatList
      testID="timeline-list"
      data={state.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <TimelineCard story={item} onPress={onOpenStory} />
        </View>
      )}
      ListHeaderComponent={controls}
      contentContainerStyle={{
        paddingBottom: spacing.xl,
      }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.35}
      onRefresh={handleRefresh}
      refreshing={state.isRefreshing}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      ListFooterComponent={
        state.isLoadingMore ? <Loader message="Loading more timeline stories..." size="small" /> : <View />
      }
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}
    />
  );
}

function parseCompleteYear(value: string) {
  if (!/^\d{4}$/.test(value.trim())) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function describePeriodSelection(selection: TimelinePeriodSelection): PeriodDescriptor {
  switch (selection.mode) {
    case 'all':
      return { request: {}, label: 'All time periods', key: 'all', isReady: true };
    case 'year': {
      const year = parseCompleteYear(selection.year);

      if (year === undefined) {
        return { request: {}, label: 'Enter a 4-digit year', key: `year-draft-${selection.year}`, isReady: false };
      }

      return { request: { year }, label: `Year ${year}`, key: `year-${year}`, isReady: true };
    }
    case 'range': {
      const from = parseCompleteYear(selection.rangeFrom);
      const to = parseCompleteYear(selection.rangeTo);

      if (from === undefined || to === undefined) {
        return {
          request: {},
          label: 'Enter start and end years',
          key: `range-draft-${selection.rangeFrom}-${selection.rangeTo}`,
          isReady: false,
        };
      }

      if (from > to) {
        return {
          request: {},
          label: 'Year range',
          key: 'range-reversed',
          isReady: false,
          error: 'Start year cannot be later than end year.',
        };
      }

      return { request: { yearRange: { from, to } }, label: `${from}-${to}`, key: `range-${from}-${to}`, isReady: true };
    }
    case 'decade': {
      const decadeYear = parseCompleteYear(selection.decade);

      if (decadeYear === undefined) {
        return { request: {}, label: 'Enter a 4-digit decade year', key: `decade-draft-${selection.decade}`, isReady: false };
      }

      const decade = Math.floor(decadeYear / 10) * 10;

      return { request: { decade }, label: `${decade}s`, key: `decade-${decade}`, isReady: true };
    }
    default:
      return { request: {}, label: 'All time periods', key: 'all', isReady: true };
  }
}

function mergeTimelinePage(
  current: TimelineUiState,
  response: TimelinePageEntity,
  mode: 'initial' | 'refresh' | 'append',
): TimelineUiState {
  const items = mode === 'append'
    ? mergeUniqueTimelineItems(current.items, response.items)
    : dedupeTimelineItems(response.items);

  return {
    ...current,
    items,
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    error: undefined,
    page: response.page,
    pageSize: response.pageSize,
    totalCount: response.totalCount,
    hasNextPage: response.hasNextPage,
  };
}

function dedupeTimelineItems(items: TimelinePageEntity['items']) {
  const seenIds = new Set<string>();

  return items.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
}

function mergeUniqueTimelineItems(
  currentItems: TimelinePageEntity['items'],
  nextItems: TimelinePageEntity['items'],
) {
  const seenIds = new Set(currentItems.map((item) => item.id));
  const uniqueNextItems = nextItems.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });

  return [...currentItems, ...uniqueNextItems];
}

function toSearchState(filters: StoryFilters): SearchFiltersState {
  return {
    query: filters.q ?? '',
    location: filters.location ?? '',
    locationBounds: filters.locationBounds,
    proximityRadiusKm: filters.radiusKm === 0.5 || filters.radiusKm === 1 || filters.radiusKm === 10 || filters.radiusKm === 100 ? filters.radiusKm : undefined,
    proximityCoordinates:
      filters.latitude !== undefined && filters.longitude !== undefined
        ? { latitude: filters.latitude, longitude: filters.longitude }
        : undefined,
    proximitySource:
      filters.radiusKm !== undefined && filters.latitude !== undefined && filters.longitude !== undefined
        ? 'current_location'
        : undefined,
    timeFrom: filters.yearFrom ? String(filters.yearFrom) : '',
    timeTo: filters.yearTo ? String(filters.yearTo) : '',
    tags: filters.tags ?? [],
  };
}

function hasAnySearchFilters(filters: SearchFiltersState) {
  return Boolean(
    filters.query.trim() ||
      filters.location.trim() ||
      filters.locationBounds ||
      filters.proximityRadiusKm ||
      filters.timeFrom.trim() ||
      filters.timeTo.trim() ||
      filters.tags.length,
  );
}

function areSearchStatesEqual(left: SearchFiltersState, right: SearchFiltersState) {
  return (
    left.query === right.query &&
    left.location === right.location &&
    JSON.stringify(left.locationBounds) === JSON.stringify(right.locationBounds) &&
    left.proximityRadiusKm === right.proximityRadiusKm &&
    JSON.stringify(left.proximityCoordinates) === JSON.stringify(right.proximityCoordinates) &&
    left.proximitySource === right.proximitySource &&
    left.timeFrom === right.timeFrom &&
    left.timeTo === right.timeTo &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags)
  );
}
