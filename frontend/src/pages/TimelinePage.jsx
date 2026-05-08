import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import TimelineView from "@/components/Timeline/TimelineView";
import SearchBar from "@/components/SearchFilter/SearchBar";
import FilterPanel from "@/components/SearchFilter/FilterPanel";
import ActiveFilters from "@/components/SearchFilter/ActiveFilters";
import { useFilterState } from "@/hooks/useFilterState";
import { getTimeline } from "@/services/timelineService";

const PAGE_SIZE = 10;

function countActiveFilters({ yearFrom, yearTo, location, hasProximity, tags, hasImage }) {
  return (
    [yearFrom, yearTo, location].filter(Boolean).length +
    (hasProximity ? 1 : 0) +
    (hasImage ? 1 : 0) +
    tags.length
  );
}

function TimelinePage() {
  const {
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
    tags,
    hasImage,
    hasProximity,
    setFilters,
    removeFilter,
    removeTag,
    clearAll,
  } = useFilterState();

  const [stories, setStories] = useState([]);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Fetch generation counter — guards against out-of-order responses when the
  // user changes the filter while a request is in flight.
  const generationRef = useRef(0);

  const fetchPage = useCallback(
    async (pageToLoad, { append }) => {
      const myGen = ++generationRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await getTimeline({
          yearFrom: yearFrom === "" ? undefined : yearFrom,
          yearTo: yearTo === "" ? undefined : yearTo,
          q,
          location,
          tags,
          latMin: latMin ?? undefined,
          latMax: latMax ?? undefined,
          lngMin: lngMin ?? undefined,
          lngMax: lngMax ?? undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          radiusKm: radiusKm ?? undefined,
          hasImage,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });
        if (myGen !== generationRef.current) return;
        setCount(data.count);
        setHasNext(Boolean(data.next));
        setPage(pageToLoad);
        setStories((prev) => (append ? [...prev, ...(data.results ?? [])] : data.results ?? []));
      } catch (err) {
        if (myGen !== generationRef.current) return;
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load the timeline. Please try again.",
        );
      } finally {
        if (myGen === generationRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      yearFrom,
      yearTo,
      q,
      location,
      tags,
      latMin,
      latMax,
      lngMin,
      lngMax,
      latitude,
      longitude,
      radiusKm,
      hasImage,
    ],
  );

  useEffect(() => {
    fetchPage(1, { append: false });
  }, [fetchPage]);

  function handleLoadMore() {
    if (!hasNext || loading || loadingMore) return;
    fetchPage(page + 1, { append: true });
  }

  function handleRetry() {
    fetchPage(1, { append: false });
  }

  const handleSearchChange = useCallback(
    (value) => {
      setFilters({ q: value }, { replace: true });
    },
    [setFilters],
  );

  function handleFilterApply({
    yearFrom: yf,
    yearTo: yt,
    location: loc,
    latMin: lMin,
    latMax: lMax,
    lngMin: gMin,
    lngMax: gMax,
    latitude: lat,
    longitude: lng,
    radiusKm: rKm,
    tags: tgs,
    hasImage: hImg,
  }) {
    setFilters(
      {
        year_from: yf,
        year_to: yt,
        location: loc,
        lat_min: lMin ?? "",
        lat_max: lMax ?? "",
        lng_min: gMin ?? "",
        lng_max: gMax ?? "",
        latitude: lat ?? "",
        longitude: lng ?? "",
        radius_km: rKm ?? "",
        tags: tgs,
        has_image: hImg ? "true" : "",
      },
      { replace: true },
    );
  }

  function handleRemoveFilter(key) {
    if (key === "year_range") {
      setFilters({ year_from: "", year_to: "" }, { replace: true });
    } else if (key === "location") {
      setFilters(
        { location: "", lat_min: "", lat_max: "", lng_min: "", lng_max: "" },
        { replace: true },
      );
    } else if (key === "proximity") {
      setFilters({ latitude: "", longitude: "", radius_km: "" }, { replace: true });
    } else if (key === "has_image") {
      setFilters({ has_image: "" }, { replace: true });
    } else {
      removeFilter(key);
    }
  }

  const activeFilterCount = countActiveFilters({
    yearFrom,
    yearTo,
    location,
    hasProximity,
    tags,
    hasImage,
  });

  const filterPanelKey = useMemo(
    () =>
      `${yearFrom}-${yearTo}-${location}-${latMin}-${latMax}-${lngMin}-${lngMax}-${latitude}-${longitude}-${radiusKm}-${tags.join(",")}-${hasImage}`,
    [
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
      tags,
      hasImage,
    ],
  );

  function renderContent() {
    if (error) return <ErrorState message={error} onRetry={handleRetry} />;
    if (loading) {
      return (
        <div
          className="flex justify-center py-16"
          aria-busy="true"
          aria-label="Loading timeline"
        >
          <LoadingSpinner />
        </div>
      );
    }
    if (count === 0) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No stories found for these filters.
        </p>
      );
    }
    return (
      <>
        <TimelineView stories={stories} />
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={!hasNext || loadingMore}>
            {loadingMore ? "Loading…" : hasNext ? "Load more" : "No more stories"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stories ordered by when they happened.
          </p>
        </div>

        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchBar
                defaultValue={q}
                onSearch={handleSearchChange}
                placeholder="Search by title or place…"
              />
            </div>
            <FilterPanel
              key={filterPanelKey}
              yearFrom={yearFrom}
              yearTo={yearTo}
              location={location}
              latMin={latMin}
              latMax={latMax}
              lngMin={lngMin}
              lngMax={lngMax}
              latitude={latitude}
              longitude={longitude}
              radiusKm={radiusKm}
              tags={tags}
              hasImage={hasImage}
              onApply={handleFilterApply}
              activeCount={activeFilterCount}
              showHasImage
            />
          </div>
          <ActiveFilters
            q={q}
            yearFrom={yearFrom}
            yearTo={yearTo}
            location={location}
            radiusKm={radiusKm}
            hasProximity={hasProximity}
            tags={tags}
            hasImage={hasImage}
            onRemove={handleRemoveFilter}
            onRemoveTag={removeTag}
            onClearAll={clearAll}
          />
        </div>

        <div className="mb-4 flex items-center justify-end text-sm">
          {!loading && !error && (
            <span className="text-muted-foreground" aria-live="polite">
              {count} {count === 1 ? "story" : "stories"}
            </span>
          )}
        </div>

        {renderContent()}
      </div>
    </main>
  );
}

export default TimelinePage;
