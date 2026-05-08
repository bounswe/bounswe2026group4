import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import TimelineView from "@/components/Timeline/TimelineView";
import SearchBar from "@/components/SearchFilter/SearchBar";
import FilterPanel from "@/components/SearchFilter/FilterPanel";
import ActiveFilters from "@/components/SearchFilter/ActiveFilters";
import { useFilterState } from "@/hooks/useFilterState";
import { getTimeline } from "@/services/timelineService";

const PAGE_SIZE = 10;

const MODES = ["all", "year", "range", "decade"];
const MODE_LABELS = {
  all: "All",
  year: "Year",
  range: "Range",
  decade: "Decade",
};

const YEAR_RE = /^\d{4}$/;

/**
 * Parse a 4-digit year string. Returns undefined for blank or partial input —
 * this prevents firing requests on every keystroke while the user is typing.
 */
function parseFullYear(v) {
  if (typeof v !== "string" || !YEAR_RE.test(v.trim())) return undefined;
  return Number.parseInt(v, 10);
}

function decadeStart(year) {
  return Math.floor(year / 10) * 10;
}

/**
 * Derive the year_from / year_to filter pair for the current mode + inputs.
 * Returns { yearFrom, yearTo, label } where label is the human-readable
 * period for the status row. yearFrom/yearTo are undefined when no filter
 * should be applied — partial input (less than 4 digits) is treated as
 * not-yet-ready and skips the fetch.
 */
function deriveYearFilter(mode, yearInput, rangeFrom, rangeTo) {
  const base = { yearFrom: undefined, yearTo: undefined, invalid: false, skip: false };
  if (mode === "all") {
    return { ...base, label: "All time periods" };
  }
  if (mode === "year") {
    const y = parseFullYear(yearInput);
    if (y === undefined) {
      return {
        ...base,
        label: yearInput ? "Enter a 4-digit year" : "All time periods",
        skip: Boolean(yearInput),
      };
    }
    return { ...base, yearFrom: y, yearTo: y, label: String(y) };
  }
  if (mode === "decade") {
    const y = parseFullYear(yearInput);
    if (y === undefined) {
      return {
        ...base,
        label: yearInput ? "Enter a 4-digit year" : "All time periods",
        skip: Boolean(yearInput),
      };
    }
    const start = decadeStart(y);
    return { ...base, yearFrom: start, yearTo: start + 9, label: `${start}s` };
  }
  // range — require both endpoints to be complete 4-digit years before fetching
  if (!rangeFrom && !rangeTo) {
    return { ...base, label: "All time periods" };
  }
  const from = parseFullYear(rangeFrom);
  const to = parseFullYear(rangeTo);
  if (from === undefined || to === undefined) {
    return { ...base, label: "Enter start and end years", skip: true };
  }
  if (from > to) {
    return { ...base, label: "Invalid range", invalid: true };
  }
  return { ...base, yearFrom: from, yearTo: to, label: `${from}–${to}` };
}

/**
 * Count filters that aren't represented by the time-window mode UI.
 * The time-window selector owns yearFrom/yearTo visually, so they're not
 * surfaced through the filter chip badge / chips.
 */
function countActiveFilters({ location, hasProximity, tags }) {
  return (location ? 1 : 0) + (hasProximity ? 1 : 0) + tags.length;
}

function TimelinePage() {
  const {
    q,
    location,
    latMin,
    latMax,
    lngMin,
    lngMax,
    latitude,
    longitude,
    radiusKm,
    tags,
    hasProximity,
    setFilters,
    removeFilter,
    removeTag,
    clearAll,
  } = useFilterState();

  const [mode, setMode] = useState("all");
  const [yearInput, setYearInput] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const filter = useMemo(
    () => deriveYearFilter(mode, yearInput, rangeFrom, rangeTo),
    [mode, yearInput, rangeFrom, rangeTo],
  );

  const [stories, setStories] = useState([]);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Fetch generation counter — guards against out-of-order responses when
  // the user changes the filter while a request is in flight.
  const generationRef = useRef(0);

  const fetchPage = useCallback(
    async (pageToLoad, { append }) => {
      const myGen = ++generationRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await getTimeline({
          yearFrom: filter.yearFrom,
          yearTo: filter.yearTo,
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
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });
        if (myGen !== generationRef.current) return; // stale response
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
      filter.yearFrom,
      filter.yearTo,
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
    ],
  );

  // Refetch from page 1 whenever the filter changes (or on mount). Skip while
  // the user is mid-input (partial year, one-sided range) or the range is invalid.
  useEffect(() => {
    if (filter.invalid || filter.skip) return;
    fetchPage(1, { append: false });
  }, [fetchPage, filter.invalid, filter.skip]);

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
    location: loc,
    latMin: lMin,
    latMax: lMax,
    lngMin: gMin,
    lngMax: gMax,
    latitude: lat,
    longitude: lng,
    radiusKm: rKm,
    tags: tgs,
  }) {
    setFilters(
      {
        location: loc,
        lat_min: lMin ?? "",
        lat_max: lMax ?? "",
        lng_min: gMin ?? "",
        lng_max: gMax ?? "",
        latitude: lat ?? "",
        longitude: lng ?? "",
        radius_km: rKm ?? "",
        tags: tgs,
      },
      { replace: true },
    );
  }

  function handleRemoveFilter(key) {
    if (key === "location") {
      setFilters(
        { location: "", lat_min: "", lat_max: "", lng_min: "", lng_max: "" },
        { replace: true },
      );
    } else if (key === "proximity") {
      setFilters({ latitude: "", longitude: "", radius_km: "" }, { replace: true });
    } else {
      removeFilter(key);
    }
  }

  // Roving-tabindex bookkeeping for the WAI-ARIA radiogroup. Only the
  // currently-checked option sits in the tab order; arrow keys both move
  // focus and select the next option. Matches the authoring practice for
  // role="radiogroup".
  const modeRefs = useRef({});

  function handleModeKeyDown(e, currentIndex) {
    let nextIndex = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % MODES.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + MODES.length) % MODES.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = MODES.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextMode = MODES[nextIndex];
    setMode(nextMode);
    const el = modeRefs.current[nextMode];
    if (el) el.focus();
  }

  const activeFilterCount = countActiveFilters({ location, hasProximity, tags });

  const filterPanelKey = useMemo(
    () =>
      `${location}-${latMin}-${latMax}-${lngMin}-${lngMax}-${latitude}-${longitude}-${radiusKm}-${tags.join(",")}`,
    [location, latMin, latMax, lngMin, lngMax, latitude, longitude, radiusKm, tags],
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
          No stories found for this time window.
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
              location={location}
              latMin={latMin}
              latMax={latMax}
              lngMin={lngMin}
              lngMax={lngMax}
              latitude={latitude}
              longitude={longitude}
              radiusKm={radiusKm}
              tags={tags}
              onApply={handleFilterApply}
              activeCount={activeFilterCount}
              hideYearRange
            />
          </div>
          <ActiveFilters
            q={q}
            location={location}
            radiusKm={radiusKm}
            hasProximity={hasProximity}
            tags={tags}
            onRemove={handleRemoveFilter}
            onRemoveTag={removeTag}
            onClearAll={clearAll}
          />
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose a time window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="radiogroup" aria-label="Time window mode" className="flex flex-wrap gap-2">
              {MODES.map((m, i) => {
                const isChecked = mode === m;
                return (
                  <button
                    key={m}
                    ref={(el) => { modeRefs.current[m] = el; }}
                    type="button"
                    role="radio"
                    aria-checked={isChecked}
                    tabIndex={isChecked ? 0 : -1}
                    onClick={() => setMode(m)}
                    onKeyDown={(e) => handleModeKeyDown(e, i)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      isChecked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {MODE_LABELS[m]}
                  </button>
                );
              })}
            </div>

            {mode === "year" && (
              <div className="max-w-[160px] space-y-1.5">
                <Label htmlFor="timeline-year">Year</Label>
                <Input
                  id="timeline-year"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 1875"
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                />
              </div>
            )}

            {mode === "decade" && (
              <div className="max-w-[200px] space-y-1.5">
                <Label htmlFor="timeline-decade">Decade (any year)</Label>
                <Input
                  id="timeline-decade"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 1875"
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Snaps to the start of the decade.
                </p>
              </div>
            )}

            {mode === "range" && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="timeline-range-from">From</Label>
                  <Input
                    id="timeline-range-from"
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 1850"
                    className="w-32"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timeline-range-to">To</Label>
                  <Input
                    id="timeline-range-to"
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 1900"
                    className="w-32"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                  />
                </div>
                {filter.invalid && (
                  <p className="text-xs text-destructive">
                    "From" must be less than or equal to "To".
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{filter.label}</span>
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
