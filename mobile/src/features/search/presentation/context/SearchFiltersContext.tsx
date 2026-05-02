import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storageKeys } from '../../../../core/storage/keys';
import { storage } from '../../../../core/storage/storage';
import { StoryFilters } from '../../../stories/domain/repositories';
import { LocationBounds } from '../../application/services';

export type SearchFilterScope = 'feed' | 'map' | 'main';
export type ProximityRadiusKm = 1 | 10 | 100;

export interface ProximityCoordinates {
  latitude: number;
  longitude: number;
}

export interface SearchFiltersState {
  query: string;
  location: string;
  locationBounds?: LocationBounds;
  proximityRadiusKm?: ProximityRadiusKm;
  proximityCoordinates?: ProximityCoordinates;
  timeFrom: string;
  timeTo: string;
  tags: string[];
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
  locationBounds: undefined,
  proximityRadiusKm: undefined,
  proximityCoordinates: undefined,
  timeFrom: '',
  timeTo: '',
  tags: [],
};

const initialFiltersByScope: Record<SearchFilterScope, SearchFiltersState> = {
  feed: initialFilters,
  map: initialFilters,
  main: initialFilters,
};

const storageKeyByScope: Record<SearchFilterScope, string> = {
  feed: storageKeys.feedSearchFilters,
  map: storageKeys.mapSearchFilters,
  main: storageKeys.mainSearchFilters,
};

const SearchFiltersContext = createContext<SearchFiltersContextValue | undefined>(undefined);

export function SearchFiltersProvider({ children }: PropsWithChildren) {
  const [filtersByScope, setFiltersState] = useState<Record<SearchFilterScope, SearchFiltersState>>(initialFiltersByScope);
  const [refreshTokensByScope, setRefreshTokensByScope] = useState<Record<SearchFilterScope, number>>({
    feed: 0,
    map: 0,
    main: 0,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      storage.get<Partial<SearchFiltersState>>(storageKeys.feedSearchFilters),
      storage.get<Partial<SearchFiltersState>>(storageKeys.mapSearchFilters),
      storage.get<Partial<SearchFiltersState>>(storageKeys.mainSearchFilters),
      storage.get<Partial<SearchFiltersState>>(storageKeys.legacySearchFilters),
    ])
      .then(([storedFeedFilters, storedMapFilters, storedMainFilters, legacyFilters]) => {
        if (!isMounted) {
          return;
        }

        const fallbackFilters = normalizeStoredFilters(legacyFilters);
        const mainFilters = normalizeStoredFilters(storedMainFilters ?? storedFeedFilters ?? storedMapFilters ?? fallbackFilters);

        setFiltersState({
          feed: normalizeStoredFilters(storedFeedFilters ?? fallbackFilters),
          map: normalizeStoredFilters(storedMapFilters),
          main: mainFilters,
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
        updateScopedFilters(
          scope,
          (currentFilters) => ({
            ...currentFilters,
            [key]: key === 'tags' ? [] : '',
            ...(key === 'location' ? { locationBounds: undefined } : {}),
            ...(key === 'proximityRadiusKm' ? { proximityRadiusKm: undefined, proximityCoordinates: undefined } : {}),
            ...(key === 'proximityCoordinates' ? { proximityRadiusKm: undefined, proximityCoordinates: undefined } : {}),
          }),
          { refresh: true },
        );
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

  const params: StoryFilters = {
    q: filters.query.trim() || undefined,
    location: filters.location.trim() || undefined,
    locationBounds: filters.locationBounds,
    yearFrom,
    yearTo,
    tags: filters.tags.length ? filters.tags : undefined,
  };

  if (filters.proximityRadiusKm && filters.proximityCoordinates) {
    params.latitude = filters.proximityCoordinates.latitude;
    params.longitude = filters.proximityCoordinates.longitude;
    params.radiusKm = filters.proximityRadiusKm;
  }

  return params;
}

function normalizeStoredFilters(filters?: Partial<SearchFiltersState> | null): SearchFiltersState {
  return {
    query: filters?.query ?? '',
    location: filters?.location ?? '',
    locationBounds: normalizeLocationBounds(filters?.locationBounds),
    proximityRadiusKm: normalizeProximityRadius(filters?.proximityRadiusKm),
    proximityCoordinates: normalizeProximityCoordinates(filters?.proximityCoordinates),
    timeFrom: filters?.timeFrom ?? '',
    timeTo: filters?.timeTo ?? '',
    tags: normalizeTags(filters?.tags),
  };
}

function normalizeTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => tag.trim())
    .filter((tag, index, values): tag is string => tag.length > 0 && values.indexOf(tag) === index);
}

function normalizeProximityRadius(radius?: number | null): ProximityRadiusKm | undefined {
  return radius === 1 || radius === 10 || radius === 100 ? radius : undefined;
}

function normalizeProximityCoordinates(coordinates?: ProximityCoordinates | null): ProximityCoordinates | undefined {
  if (!coordinates) {
    return undefined;
  }

  const { latitude, longitude } = coordinates;

  if (![latitude, longitude].every(Number.isFinite)) {
    return undefined;
  }

  return {
    latitude,
    longitude,
  };
}

function normalizeLocationBounds(bounds?: LocationBounds | null): LocationBounds | undefined {
  if (!bounds) {
    return undefined;
  }

  const { latMin, latMax, lngMin, lngMax } = bounds;

  if (![latMin, latMax, lngMin, lngMax].every(Number.isFinite)) {
    return undefined;
  }

  return {
    latMin,
    latMax,
    lngMin,
    lngMax,
  };
}
