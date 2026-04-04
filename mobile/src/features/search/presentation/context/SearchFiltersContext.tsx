import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storageKeys } from '../../../../core/storage/keys';
import { storage } from '../../../../core/storage/storage';
import { StoryFilters } from '../../../stories/domain/repositories';

export type SearchFilterScope = 'feed' | 'map';

export interface SearchFiltersState {
  query: string;
  location: string;
  timeFrom: string;
  timeTo: string;
}

interface SearchFiltersContextValue {
  filtersByScope: Record<SearchFilterScope, SearchFiltersState>;
  refreshTokensByScope: Record<SearchFilterScope, number>;
  isHydrated: boolean;
  setFilters: (scope: SearchFilterScope, nextFilters: SearchFiltersState) => void;
  updateFilters: (scope: SearchFilterScope, patch: Partial<SearchFiltersState>, options?: { refresh?: boolean }) => void;
  removeFilter: (scope: SearchFilterScope, key: keyof SearchFiltersState) => void;
  clearFilters: (scope: SearchFilterScope) => void;
  applyFilters: (scope: SearchFilterScope) => void;
}

const initialFilters: SearchFiltersState = {
  query: '',
  location: '',
  timeFrom: '',
  timeTo: '',
};

const initialFiltersByScope: Record<SearchFilterScope, SearchFiltersState> = {
  feed: initialFilters,
  map: initialFilters,
};

const storageKeyByScope: Record<SearchFilterScope, string> = {
  feed: storageKeys.feedSearchFilters,
  map: storageKeys.mapSearchFilters,
};

const SearchFiltersContext = createContext<SearchFiltersContextValue | undefined>(undefined);

export function SearchFiltersProvider({ children }: PropsWithChildren) {
  const [filtersByScope, setFiltersState] = useState<Record<SearchFilterScope, SearchFiltersState>>(initialFiltersByScope);
  const [refreshTokensByScope, setRefreshTokensByScope] = useState<Record<SearchFilterScope, number>>({
    feed: 0,
    map: 0,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      storage.get<Partial<SearchFiltersState>>(storageKeys.feedSearchFilters),
      storage.get<Partial<SearchFiltersState>>(storageKeys.mapSearchFilters),
      storage.get<Partial<SearchFiltersState>>(storageKeys.legacySearchFilters),
    ])
      .then(([storedFeedFilters, storedMapFilters, legacyFilters]) => {
        if (!isMounted) {
          return;
        }

        const fallbackFilters = normalizeStoredFilters(legacyFilters);

        setFiltersState({
          feed: normalizeStoredFilters(storedFeedFilters ?? fallbackFilters),
          map: normalizeStoredFilters(storedMapFilters),
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setFilters = (scope: SearchFilterScope, nextFilters: SearchFiltersState) => {
    setFiltersState((current) => ({
      ...current,
      [scope]: nextFilters,
    }));
    void storage.set(storageKeyByScope[scope], nextFilters);
  };

  const updateScopedFilters = (
    scope: SearchFilterScope,
    updater: (currentFilters: SearchFiltersState) => SearchFiltersState,
    options?: { refresh?: boolean },
  ) => {
    setFiltersState((current) => {
      const nextFilters = updater(current[scope]);
      void storage.set(storageKeyByScope[scope], nextFilters);

      return {
        ...current,
        [scope]: nextFilters,
      };
    });

    if (options?.refresh) {
      setRefreshTokensByScope((current) => ({
        ...current,
        [scope]: current[scope] + 1,
      }));
    }
  };

  const value = useMemo<SearchFiltersContextValue>(
    () => ({
      filtersByScope,
      refreshTokensByScope,
      isHydrated,
      setFilters: (scope, nextFilters) => {
        setFilters(scope, nextFilters);
      },
      updateFilters: (scope, patch, options) => {
        updateScopedFilters(scope, (currentFilters) => ({ ...currentFilters, ...patch }), options);
      },
      removeFilter: (scope, key) => {
        updateScopedFilters(scope, (currentFilters) => ({ ...currentFilters, [key]: '' }), { refresh: true });
      },
      clearFilters: (scope) => {
        updateScopedFilters(scope, (currentFilters) => ({
          ...initialFilters,
          query: currentFilters.query,
        }), { refresh: true });
      },
      applyFilters: (scope) => {
        setRefreshTokensByScope((current) => ({
          ...current,
          [scope]: current[scope] + 1,
        }));
      },
    }),
    [filtersByScope, isHydrated, refreshTokensByScope],
  );

  return <SearchFiltersContext.Provider value={value}>{children}</SearchFiltersContext.Provider>;
}

export function useSearchFilters(scope: SearchFilterScope) {
  const context = useContext(SearchFiltersContext);

  if (!context) {
    throw new Error('useSearchFilters must be used within a SearchFiltersProvider.');
  }

  return {
    filters: context.filtersByScope[scope],
    refreshToken: context.refreshTokensByScope[scope],
    isHydrated: context.isHydrated,
    setFilters: (nextFilters: SearchFiltersState) => context.setFilters(scope, nextFilters),
    updateFilters: (patch: Partial<SearchFiltersState>, options?: { refresh?: boolean }) =>
      context.updateFilters(scope, patch, options),
    removeFilter: (key: keyof SearchFiltersState) => context.removeFilter(scope, key),
    clearFilters: () => context.clearFilters(scope),
    applyFilters: () => context.applyFilters(scope),
  };
}

export function toSearchParams(filters: SearchFiltersState): StoryFilters {
  const timeFrom = filters.timeFrom.trim();
  const timeTo = filters.timeTo.trim();
  const parsedTimeFrom = timeFrom ? Number(timeFrom) : undefined;
  const parsedTimeTo = timeTo ? Number(timeTo) : undefined;
  const yearFrom = parsedTimeFrom !== undefined && Number.isFinite(parsedTimeFrom) ? parsedTimeFrom : undefined;
  const yearToCandidate = parsedTimeTo !== undefined && Number.isFinite(parsedTimeTo) ? parsedTimeTo : undefined;
  const yearTo =
    yearToCandidate !== undefined && yearFrom !== undefined && yearToCandidate < yearFrom ? undefined : yearToCandidate;

  return {
    q: filters.query.trim() || undefined,
    location: filters.location.trim() || undefined,
    yearFrom,
    yearTo,
  };
}

function normalizeStoredFilters(filters?: Partial<SearchFiltersState> | null): SearchFiltersState {
  return {
    query: filters?.query ?? '',
    location: filters?.location ?? '',
    timeFrom: filters?.timeFrom ?? '',
    timeTo: filters?.timeTo ?? '',
  };
}
