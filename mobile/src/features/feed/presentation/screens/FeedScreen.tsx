import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
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
import { FeedPageEntity } from '../../domain/entities';
import { FeedCard } from '../components/FeedCard';
import { createInitialFeedUiState } from '../state/feedUiState';

interface FeedScreenProps {
  initialFilters?: StoryFilters;
  onOpenStory?: (storyId: string) => void;
  getFeed?: typeof storyService.getFeed;
  showSearchControls?: boolean;
  searchScope?: SearchFilterScope;
}

const EMPTY_FILTERS: StoryFilters = {};

export function FeedScreen({
  initialFilters = EMPTY_FILTERS,
  onOpenStory,
  getFeed = storyService.getFeed,
  showSearchControls = true,
  searchScope = 'feed',
}: FeedScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, refreshToken, isHydrated, setFilters } = useSearchFilters(searchScope);
  const debouncedQuery = useDebounce(filters.query, 350);
  const [useImmediateQuery, setUseImmediateQuery] = useState(false);
  const [state, setState] = useState(() => createInitialFeedUiState(initialFilters));
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
    () => toSearchParams({ ...filters, query: useImmediateQuery ? filters.query : debouncedQuery }),
    [debouncedQuery, filters, useImmediateQuery],
  );

  const hasActiveFilters = Boolean(
    activeFilters.q || activeFilters.location || activeFilters.yearFrom || activeFilters.yearTo,
  );

  const loadPage = useCallback(
    async (
      page: number,
      mode: 'initial' | 'refresh' | 'append' = 'initial',
      overrides?: Partial<Pick<(typeof stateRef)['current'], 'filters' | 'sort'>>,
    ) => {
      const currentState = stateRef.current;
      const nextFilters = overrides?.filters ?? currentState.filters;
      const nextSort = overrides?.sort ?? currentState.sort;

      if (mode === 'append' && (!currentState.hasNextPage || currentState.isLoadingMore || currentState.isLoading)) {
        return;
      }

      setState((current) => ({
        ...current,
        filters: nextFilters,
        isLoading: mode === 'initial',
        isRefreshing: mode === 'refresh',
        isLoadingMore: mode === 'append',
        error: mode === 'append' ? current.error : undefined,
      }));

      try {
        const response = await getFeed({
          page,
          sort: nextSort,
          filters: nextFilters,
        });

        setState((current) => mergeFeedPage(current, response, mode));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load the story feed.';

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
    [getFeed],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    loadPage(1, 'initial', { filters: activeFilters });
  }, [activeFilters, isHydrated, loadPage]);

  const handleEndReached = () => {
    if (hasRequestedNextPage.current || !state.hasNextPage || state.isLoading || state.isLoadingMore) {
      return;
    }

    hasRequestedNextPage.current = true;
    loadPage(state.page + 1, 'append');
  };

  const handleRefresh = () => {
    loadPage(1, 'refresh');
  };

  const handleRetry = () => {
    loadPage(1, 'initial', { filters: activeFilters });
  };

  const renderControls = () => {
    if (!showSearchControls) {
      return null;
    }

    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            {state.totalCount > 0 ? `${state.totalCount} stories` : hasActiveFilters ? 'No matching stories yet' : 'Newest stories'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sort: Most Recent"
            style={{
              paddingHorizontal: spacing.sm + 4,
              paddingVertical: spacing.xs + 2,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.infoSurface,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Most Recent</Text>
          </Pressable>
        </View>

        <StorySearchControls helperText="Search by title or place." scope={searchScope} />
      </View>
    );
  };

  if (!isHydrated) {
    return <Loader message="Restoring search filters..." />;
  }

  if (state.isLoading && !state.items.length) {
    return (
      <View accessibilityLabel="Loading stories" style={{ flex: 1, gap: spacing.md }}>
        {renderControls()}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} showMedia={false} />
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
          title="Feed unavailable"
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
          title={hasActiveFilters ? 'No results found' : 'No stories yet'}
          message={
            hasActiveFilters
              ? 'Try adjusting your search or removing some filters.'
              : 'Stories will appear here when published.'
          }
          actionLabel="Refresh"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {renderControls()}
      <FlatList
        testID="feed-list"
        data={state.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard story={item} onPress={onOpenStory} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        onRefresh={handleRefresh}
        refreshing={state.isRefreshing}
        ListFooterComponent={
          state.isLoadingMore ? <Loader message="Loading more stories..." size="small" /> : <View />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function toSearchState(filters: StoryFilters): SearchFiltersState {
  return {
    query: filters.q ?? '',
    location: filters.location ?? '',
    locationBounds: filters.locationBounds,
    timeFrom: filters.yearFrom ? String(filters.yearFrom) : '',
    timeTo: filters.yearTo ? String(filters.yearTo) : '',
  };
}

function hasAnySearchFilters(filters: SearchFiltersState) {
  return Boolean(
    filters.query.trim() ||
      filters.location.trim() ||
      filters.locationBounds ||
      filters.timeFrom.trim() ||
      filters.timeTo.trim(),
  );
}

function areSearchStatesEqual(left: SearchFiltersState, right: SearchFiltersState) {
  return (
    left.query === right.query &&
    left.location === right.location &&
    JSON.stringify(left.locationBounds) === JSON.stringify(right.locationBounds) &&
    left.timeFrom === right.timeFrom &&
    left.timeTo === right.timeTo
  );
}

function mergeFeedPage(
  current: ReturnType<typeof createInitialFeedUiState>,
  response: FeedPageEntity,
  mode: 'initial' | 'refresh' | 'append',
) {
  return {
    ...current,
    items: mode === 'append' ? [...current.items, ...response.items] : response.items,
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    error: undefined,
    page: response.page,
    totalCount: response.totalCount,
    hasNextPage: response.hasNextPage,
  };
}
