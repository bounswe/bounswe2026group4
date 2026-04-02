import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storageKeys } from '../../../../core/storage/keys';
import { storage } from '../../../../core/storage/storage';
import { StoryFilters } from '../../../stories/domain/repositories';

export interface SearchFiltersState {
  query: string;
  location: string;
  timeFrom: string;
  timeTo: string;
}

interface SearchFiltersContextValue {
  filters: SearchFiltersState;
  isHydrated: boolean;
  setFilters: (nextFilters: SearchFiltersState) => void;
  updateFilters: (patch: Partial<SearchFiltersState>) => void;
  removeFilter: (key: keyof SearchFiltersState) => void;
  clearFilters: () => void;
}

const initialFilters: SearchFiltersState = {
  query: '',
  location: '',
  timeFrom: '',
  timeTo: '',
};

const SearchFiltersContext = createContext<SearchFiltersContextValue | undefined>(undefined);

export function SearchFiltersProvider({ children }: PropsWithChildren) {
  const [filters, setFiltersState] = useState<SearchFiltersState>(initialFilters);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    storage
      .get<Partial<SearchFiltersState>>(storageKeys.searchFilters)
      .then((storedFilters) => {
        if (isMounted && storedFilters) {
          setFiltersState({
            query: storedFilters.query ?? '',
            location: storedFilters.location ?? '',
            timeFrom: storedFilters.timeFrom ?? '',
            timeTo: storedFilters.timeTo ?? '',
          });
        }
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

  const setFilters = (nextFilters: SearchFiltersState) => {
    setFiltersState(nextFilters);
    void storage.set(storageKeys.searchFilters, nextFilters);
  };

  const value = useMemo<SearchFiltersContextValue>(
    () => ({
      filters,
      isHydrated,
      setFilters,
      updateFilters: (patch) => {
        setFilters({ ...filters, ...patch });
      },
      removeFilter: (key) => {
        setFilters({ ...filters, [key]: '' });
      },
      clearFilters: () => {
        setFilters(initialFilters);
      },
    }),
    [filters, isHydrated],
  );

  return <SearchFiltersContext.Provider value={value}>{children}</SearchFiltersContext.Provider>;
}

export function useSearchFilters() {
  const context = useContext(SearchFiltersContext);

  if (!context) {
    throw new Error('useSearchFilters must be used within a SearchFiltersProvider.');
  }

  return context;
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
