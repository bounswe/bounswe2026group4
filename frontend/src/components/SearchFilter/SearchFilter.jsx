import { useCallback } from "react";

import SearchBar from "./SearchBar";
import FilterPanel from "./FilterPanel";
import ActiveFilters from "./ActiveFilters";
import { useFilterState } from "@/hooks/useFilterState";
import { cn } from "@/lib/utils";

/** Count how many non-search filters (year, location, tags) are active. */
function countActiveFilters({ yearFrom, yearTo, location, tags }) {
  return [yearFrom, yearTo, location].filter(Boolean).length + tags.length;
}

/**
 * Unified search + filter UI component.
 * Reads from and writes to URL query parameters via useFilterState.
 * Must be rendered inside a React Router context.
 */
function SearchFilter({ className }) {
  const { q, yearFrom, yearTo, location, latMin, latMax, lngMin, lngMax, tags, setFilters, removeFilter, removeTag, clearAll } = useFilterState();

  const handleSearchChange = useCallback(
    (value) => {
      setFilters({ q: value }, { replace: true });
    },
    [setFilters]
  );

  function handleFilterApply({ yearFrom: yf, yearTo: yt, location: loc, latMin, latMax, lngMin, lngMax, tags: tgs}) {
    setFilters({
      year_from: yf,
      year_to: yt,
      location: loc,
      lat_min: latMin ?? "",
      lat_max: latMax ?? "",
      lng_min: lngMin ?? "",
      lng_max: lngMax ?? "",
      tags: tgs
    }, { replace: true });
  }

  function handleRemoveFilter(key) {
    if (key === "year_range") {
      setFilters({ year_from: "", year_to: "" }, { replace: true });
    } else if (key === "location") {
      setFilters({ location: "", lat_min: "", lat_max: "", lng_min: "", lng_max: "" }, { replace: true });
    } else {
      removeFilter(key);
    }
  }

  const activeFilterCount = countActiveFilters({ yearFrom, yearTo, location, tags });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar
            defaultValue={q}
            onSearch={handleSearchChange}
          />
        </div>
        <FilterPanel
          key={`${yearFrom}-${yearTo}-${location}-${latMin}-${latMax}-${lngMin}-${lngMax}-${tags.join(",")}`}
          yearFrom={yearFrom}
          yearTo={yearTo}
          location={location}
          latMin={latMin}
          latMax={latMax}
          lngMin={lngMin}
          lngMax={lngMax}
          tags={tags}
          onApply={handleFilterApply}
          activeCount={activeFilterCount}
        />
      </div>
      <ActiveFilters
        q={q}
        yearFrom={yearFrom}
        yearTo={yearTo}
        location={location}
        tags={tags}
        onRemove={handleRemoveFilter}
        onRemoveTag={removeTag}
        onClearAll={clearAll}
      />
    </div>
  );
}

export default SearchFilter;
