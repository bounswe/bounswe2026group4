import { useSearchParams } from "react-router-dom";

/**
 * Manages search/filter state via URL query parameters.
 * Supported params: q, year_from, year_to, location, page
 */
export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") || "";
  const yearFrom = searchParams.get("year_from") ? Number(searchParams.get("year_from")) : "";
  const yearTo = searchParams.get("year_to") ? Number(searchParams.get("year_to")) : "";
  const location = searchParams.get("location") || "";
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;

  const hasActiveFilters = Boolean(q || yearFrom || yearTo || location);

  /**
   * Update one or more URL params.
   * Non-page updates automatically reset page to 1.
   * Pass { replace: true } to replace the history entry (good for debounced search).
   */
  function setFilters(updates, { replace = false } = {}) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const nonPageUpdates = Object.keys(updates).filter((k) => k !== "page");
        if (nonPageUpdates.length > 0) {
          next.set("page", "1");
        }
        for (const [key, value] of Object.entries(updates)) {
          if (value !== "" && value !== null && value !== undefined) {
            next.set(key, String(value));
          } else {
            next.delete(key);
          }
        }
        return next;
      },
      { replace }
    );
  }

  /** Remove a single filter param and reset page. */
  function removeFilter(key) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        next.set("page", "1");
        return next;
      },
      { replace: true }
    );
  }

  /** Clear all filter params. */
  function clearAll() {
    setSearchParams({}, { replace: true });
  }

  return {
    q,
    yearFrom,
    yearTo,
    location,
    page,
    hasActiveFilters,
    setFilters,
    removeFilter,
    clearAll,
  };
}
