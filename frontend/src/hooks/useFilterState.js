import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Manages search/filter state via URL query parameters.
 * Supported params: q, year_from, year_to, location, lat_min, lat_max, lng_min, lng_max,
 * latitude, longitude, radius_km, tags, page, sort_by
 * Tags are stored as a comma-separated string: tags=foo,bar
 */
export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  function readNumberParam(key) {
    const raw = searchParams.get(key);
    if (raw == null || raw === "") return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  const q = searchParams.get("q") || "";
  const yearFrom = searchParams.get("year_from") ? Number(searchParams.get("year_from")) : "";
  const yearTo = searchParams.get("year_to") ? Number(searchParams.get("year_to")) : "";
  const location = searchParams.get("location") || "";
  const latMin = readNumberParam("lat_min");
  const latMax = readNumberParam("lat_max");
  const lngMin = readNumberParam("lng_min");
  const lngMax = readNumberParam("lng_max");
  const latitude = readNumberParam("latitude");
  const longitude = readNumberParam("longitude");
  const radiusKm = readNumberParam("radius_km");
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
  const sortBy = searchParams.get("sort_by") || "recent";
  const tagsRaw = searchParams.get("tags") || "";
  const tags = useMemo(() => (tagsRaw ? tagsRaw.split(",").filter(Boolean) : []), [tagsRaw]);

  const hasProximity =
    latitude != null && longitude != null && radiusKm != null;
  const hasActiveFilters = Boolean(
    q || yearFrom || yearTo || location || tags.length > 0 || hasProximity
  );

  /**
   * Update one or more URL params.
   * Non-page updates automatically reset page to 1.
   * Pass { replace: true } to replace the history entry (good for debounced search).
   * Arrays are joined as comma-separated strings; empty arrays delete the param.
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
          if (Array.isArray(value)) {
            if (value.length > 0) {
              next.set(key, value.join(","));
            } else {
              next.delete(key);
            }
          } else if (value !== "" && value !== null && value !== undefined) {
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

  /** Remove a single tag from the tags filter and reset page. */
  function removeTag(tagName) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const current = next.get("tags") ? next.get("tags").split(",").filter(Boolean) : [];
        const updated = current.filter((t) => t !== tagName);
        if (updated.length > 0) {
          next.set("tags", updated.join(","));
        } else {
          next.delete("tags");
        }
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
    latitude,
    longitude,
    radiusKm,
    page,
    sortBy,
    tags,
    hasActiveFilters,
    setFilters,
    removeFilter,
    removeTag,
    clearAll,
  };
}
