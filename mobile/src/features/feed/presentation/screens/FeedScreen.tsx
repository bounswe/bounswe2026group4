import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button, EmptyState, ErrorState, Input, Loader, SkeletonCard } from '../../../../shared';
import { storyService } from '../../../stories/application/services';
import { StoryFilters } from '../../../stories/domain/repositories';
import { FeedPageEntity } from '../../domain/entities';
import { FeedCard } from '../components/FeedCard';
import { createInitialFeedUiState } from '../state/feedUiState';

interface FeedScreenProps {
  initialFilters?: StoryFilters;
  onOpenStory?: (storyId: string) => void;
  getFeed?: typeof storyService.getFeed;
  onFiltersChange?: (filters: StoryFilters) => void;
}

const EMPTY_FILTERS: StoryFilters = {};

export function FeedScreen({
  initialFilters: providedInitialFilters,
  onOpenStory,
  getFeed = storyService.getFeed,
  onFiltersChange,
}: FeedScreenProps) {
  const initialFilters = providedInitialFilters ?? EMPTY_FILTERS;
  const { colors, spacing, typography } = useAppTheme();
  const [state, setState] = useState(() => createInitialFeedUiState(initialFilters));
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    q: initialFilters.q ?? '',
    location: initialFilters.location ?? '',
    yearFrom: initialFilters.yearFrom ? String(initialFilters.yearFrom) : '',
    yearTo: initialFilters.yearTo ? String(initialFilters.yearTo) : '',
  });
  const stateRef = useRef(state);
  const hasRequestedNextPage = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setDraftFilters({
      q: initialFilters.q ?? '',
      location: initialFilters.location ?? '',
      yearFrom: initialFilters.yearFrom ? String(initialFilters.yearFrom) : '',
      yearTo: initialFilters.yearTo ? String(initialFilters.yearTo) : '',
    });
  }, [initialFilters]);

  const loadPage = useCallback(
    async (
      page: number,
      mode: 'initial' | 'refresh' | 'append' = 'initial',
      overrides?: Partial<Pick<(typeof stateRef)['current'], 'filters' | 'sort'>>,
    ) => {
      const currentState = stateRef.current;
      const filters = overrides?.filters ?? currentState.filters;
      const sort = overrides?.sort ?? currentState.sort;

      if (mode === 'append' && (!currentState.hasNextPage || currentState.isLoadingMore || currentState.isLoading)) {
        return;
      }

      setState((current) => ({
        ...current,
        isLoading: mode === 'initial',
        isRefreshing: mode === 'refresh',
        isLoadingMore: mode === 'append',
        error: mode === 'append' ? current.error : undefined,
      }));

      try {
        const response = await getFeed({
          page,
          sort,
          filters,
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
    loadPage(1, 'initial', { filters: initialFilters });
  }, [initialFilters, loadPage]);

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
    Boolean(draftFilters.q.trim()) ||
    Boolean(draftFilters.location.trim()) ||
    Boolean(draftFilters.yearFrom.trim()) ||
    Boolean(draftFilters.yearTo.trim());

  const applyFilters = useCallback(() => {
    const nextFilters = normalizeFilters(draftFilters);

    setState((current) => ({
      ...current,
      filters: nextFilters,
      page: 1,
    }));
    setFiltersExpanded(false);
    onFiltersChange?.(nextFilters);
    loadPage(1, 'initial', { filters: nextFilters });
  }, [draftFilters, loadPage, onFiltersChange]);

  const resetFilters = useCallback(() => {
    const clearedDraftFilters = {
      q: '',
      location: '',
      yearFrom: '',
      yearTo: '',
    };

    setDraftFilters(clearedDraftFilters);
    setState((current) => ({
      ...current,
      filters: {},
      page: 1,
    }));
    setFiltersExpanded(false);
    onFiltersChange?.({});
    loadPage(1, 'initial', { filters: {} });
  }, [loadPage, onFiltersChange]);

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
    loadPage(1, 'initial');
  };

  const renderControls = () => (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}>
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

      <View
        style={{
          padding: spacing.sm,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              value={draftFilters.q}
              onChangeText={(value) => setDraftFilters((current) => ({ ...current, q: value }))}
              onSubmitEditing={applyFilters}
              placeholder="Search stories or neighborhoods"
              accessibilityLabel="Search stories"
              returnKeyType="search"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply search"
            onPress={applyFilters}
            style={{
              paddingHorizontal: spacing.sm + 6,
              paddingVertical: spacing.sm,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.background, fontWeight: '700' }}>Search</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button onPress={() => setFiltersExpanded((current) => !current)}>
              {filtersExpanded ? 'Hide' : 'Filters'}
            </Button>
          </View>
          {hasActiveFilters ? (
            <View style={{ flex: 1 }}>
              <Button onPress={resetFilters}>Reset</Button>
            </View>
          ) : null}
        </View>
      </View>

      {filtersExpanded ? (
        <View
          style={{
            gap: spacing.sm,
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
          <Button onPress={applyFilters} fullWidth>
            Apply filters
          </Button>
        </View>
      ) : null}

      {activeFilterSummary.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {activeFilterSummary.map((summary) => (
            <View
              key={summary}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: 999,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>{summary}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

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
