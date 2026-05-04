import { useSearchParams } from "react-router-dom";

/**
 * Manages search/filter state via URL query parameters.
 * Supported params: q, year_from, year_to, location, lat_min, lat_max, lng_min, lng_max, page
 */
export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") || "";
  const yearFrom = searchParams.get("year_from") ? Number(searchParams.get("year_from")) : "";
  const yearTo = searchParams.get("year_to") ? Number(searchParams.get("year_to")) : "";
  const location = searchParams.get("location") || "";
  const latMin = searchParams.get("lat_min") != null && searchParams.get("lat_min") !== "" ? Number(searchParams.get("lat_min")) : null;
  const latMax = searchParams.get("lat_max") != null && searchParams.get("lat_max") !== "" ? Number(searchParams.get("lat_max")) : null;
  const lngMin = searchParams.get("lng_min") != null && searchParams.get("lng_min") !== "" ? Number(searchParams.get("lng_min")) : null;
  const lngMax = searchParams.get("lng_max") != null && searchParams.get("lng_max") !== "" ? Number(searchParams.get("lng_max")) : null;
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
  const sortBy = searchParams.get("sort_by") || "recent";

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
    latMin,
    latMax,
    lngMin,
    lngMax,
    page,
    sortBy,
    hasActiveFilters,
    setFilters,
    removeFilter,
    clearAll,
  };
}
