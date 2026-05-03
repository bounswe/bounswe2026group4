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
      activeFilters.yearFrom ||
      activeFilters.yearTo ||
      activeFilters.radiusKm ||
      periodSelection.mode !== 'all',
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
    if (!isHydrated || periodDescriptor.error) {
      return;
    }

    loadPage(1, 'initial', {
      filters: activeFilters,
      periodRequest: periodDescriptor.request,
    });
  }, [activeFilters, isHydrated, loadPage, periodDescriptor.error, periodDescriptor.key, periodDescriptor.request]);

  const handleEndReached = () => {
    if (hasRequestedNextPage.current || !state.hasNextPage || state.isLoading || state.isLoadingMore) {
      return;
    }

    hasRequestedNextPage.current = true;
    loadPage(state.page + 1, 'append');
  };

  const handleRefresh = () => {
    if (periodDescriptor.error) {
      return;
    }

    loadPage(1, 'refresh', {
      filters: activeFilters,
      periodRequest: periodDescriptor.request,
    });
  };

  const handleRetry = () => {
    if (periodDescriptor.error) {
      return;
    }

    loadPage(1, 'initial', {
      filters: activeFilters,
      periodRequest: periodDescriptor.request,
    });
  };

  const renderControls = () => (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '900' }}>
          Timeline
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.body, lineHeight: 22 }}>
          Move through local history chronologically, then narrow the view by place or search.
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
        {renderControls()}
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
        {renderControls()}
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
        {renderControls()}
        <EmptyState
          title={hasActiveFilters ? 'No stories on this timeline' : 'Timeline is empty'}
          message={
            hasActiveFilters
              ? 'Try a wider year range, a different period, or removing a place filter.'
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
      ListHeaderComponent={renderControls}
      contentContainerStyle={{
        paddingBottom: spacing.xl,
      }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.35}
      onRefresh={handleRefresh}
      refreshing={state.isRefreshing}
      ListFooterComponent={
        state.isLoadingMore ? <Loader message="Loading more timeline stories..." size="small" /> : <View />
      }
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}
    />
  );
}

function parseYear(value: string) {
  if (!/^\d{1,4}$/.test(value.trim())) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function describePeriodSelection(selection: TimelinePeriodSelection): PeriodDescriptor {
  switch (selection.mode) {
    case 'all':
      return { request: {}, label: 'All time periods', key: 'all' };
    case 'year': {
      const year = parseYear(selection.year);

      if (year === undefined) {
        return { request: {}, label: 'Specific year', key: 'year-invalid', error: 'Enter a valid year.' };
      }

      return { request: { year }, label: `Year ${year}`, key: `year-${year}` };
    }
    case 'range': {
      const from = parseYear(selection.rangeFrom);
      const to = parseYear(selection.rangeTo);

      if (from === undefined || to === undefined) {
        return { request: {}, label: 'Year range', key: 'range-invalid', error: 'Enter both start and end years.' };
      }

      if (from > to) {
        return { request: {}, label: 'Year range', key: 'range-reversed', error: 'Start year cannot be later than end year.' };
      }

      return { request: { yearRange: { from, to } }, label: `${from}-${to}`, key: `range-${from}-${to}` };
    }
    case 'decade': {
      const decadeYear = parseYear(selection.decade);

      if (decadeYear === undefined) {
        return { request: {}, label: 'Decade', key: 'decade-invalid', error: 'Enter a valid decade base year.' };
      }

      const decade = Math.floor(decadeYear / 10) * 10;

      return { request: { decade }, label: `${decade}s`, key: `decade-${decade}` };
    }
    case 'period': {
      const centuryYear = parseYear(selection.century);

      if (centuryYear === undefined) {
        return { request: {}, label: 'Approximate period', key: 'period-invalid', error: 'Enter a valid century base year.' };
      }

      const century = Math.floor(centuryYear / 100) * 100;
      const positionLabel = selection.position === 'mid' ? 'Mid' : selection.position === 'late' ? 'Late' : 'Early';

      return {
        request: { approximatePeriod: { century, position: selection.position } },
        label: `${positionLabel} ${century}s`,
        key: `period-${selection.position}-${century}`,
      };
    }
    default:
      return { request: {}, label: 'All time periods', key: 'all' };
  }
}

function mergeTimelinePage(
  current: TimelineUiState,
  response: TimelinePageEntity,
  mode: 'initial' | 'refresh' | 'append',
): TimelineUiState {
  return {
    ...current,
    items: mode === 'append' ? [...current.items, ...response.items] : response.items,
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

function toSearchState(filters: StoryFilters): SearchFiltersState {
  return {
    query: filters.q ?? '',
    location: filters.location ?? '',
    locationBounds: filters.locationBounds,
    proximityRadiusKm: filters.radiusKm === 1 || filters.radiusKm === 10 || filters.radiusKm === 100 ? filters.radiusKm : undefined,
    proximityCoordinates:
      filters.latitude !== undefined && filters.longitude !== undefined
        ? { latitude: filters.latitude, longitude: filters.longitude }
        : undefined,
    timeFrom: filters.yearFrom ? String(filters.yearFrom) : '',
    timeTo: filters.yearTo ? String(filters.yearTo) : '',
  };
}

function hasAnySearchFilters(filters: SearchFiltersState) {
  return Boolean(
    filters.query.trim() ||
      filters.location.trim() ||
      filters.locationBounds ||
      filters.proximityRadiusKm ||
      filters.timeFrom.trim() ||
      filters.timeTo.trim(),
  );
}

function areSearchStatesEqual(left: SearchFiltersState, right: SearchFiltersState) {
  return (
    left.query === right.query &&
    left.location === right.location &&
    JSON.stringify(left.locationBounds) === JSON.stringify(right.locationBounds) &&
    left.proximityRadiusKm === right.proximityRadiusKm &&
    JSON.stringify(left.proximityCoordinates) === JSON.stringify(right.proximityCoordinates) &&
    left.timeFrom === right.timeFrom &&
    left.timeTo === right.timeTo
  );
}
