import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import TimelineView from "@/components/Timeline/TimelineView";
import { getTimeline } from "@/services/timelineService";

const PAGE_SIZE = 10;

const MODES = ["all", "year", "range", "decade"];
const MODE_LABELS = {
  all: "All",
  year: "Year",
  range: "Range",
  decade: "Decade",
};

function parseFloatOrUndef(v) {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntOrUndef(v) {
  if (v == null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function decadeStart(year) {
  return Math.floor(year / 10) * 10;
}

/**
 * Derive the year_from / year_to filter pair for the current mode + inputs.
 * Returns { yearFrom, yearTo, label } where label is the human-readable
 * period for the status row. yearFrom/yearTo are undefined when no filter
 * should be applied (e.g. mode=all, or mode=year with a blank input).
 */
function deriveYearFilter(mode, yearInput, rangeFrom, rangeTo) {
  if (mode === "all") {
    return { yearFrom: undefined, yearTo: undefined, label: "All time periods" };
  }
  if (mode === "year") {
    const y = parseIntOrUndef(yearInput);
    if (y === undefined) return { yearFrom: undefined, yearTo: undefined, label: "All time periods" };
    return { yearFrom: y, yearTo: y, label: String(y) };
  }
  if (mode === "decade") {
    const y = parseIntOrUndef(yearInput);
    if (y === undefined) return { yearFrom: undefined, yearTo: undefined, label: "All time periods" };
    const start = decadeStart(y);
    return { yearFrom: start, yearTo: start + 9, label: `${start}s` };
  }
  // range
  const from = parseIntOrUndef(rangeFrom);
  const to = parseIntOrUndef(rangeTo);
  if (from === undefined && to === undefined) {
    return { yearFrom: undefined, yearTo: undefined, label: "All time periods" };
  }
  if (from !== undefined && to !== undefined && from > to) {
    return { yearFrom: undefined, yearTo: undefined, label: "Invalid range", invalid: true };
  }
  return {
    yearFrom: from,
    yearTo: to,
    label: from != null && to != null ? `${from}–${to}` : String(from ?? to ?? ""),
  };
}

function TimelinePage() {
  const [searchParams] = useSearchParams();

  // Bounding-box passthrough — issue #488 will use these.
  const bbox = useMemo(() => {
    const latMin = parseFloatOrUndef(searchParams.get("lat_min"));
    const latMax = parseFloatOrUndef(searchParams.get("lat_max"));
    const lngMin = parseFloatOrUndef(searchParams.get("lng_min"));
    const lngMax = parseFloatOrUndef(searchParams.get("lng_max"));
    if ([latMin, latMax, lngMin, lngMax].some((v) => v === undefined)) {
      return null;
    }
    return { latMin, latMax, lngMin, lngMax };
  }, [searchParams]);

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
          latMin: bbox?.latMin,
          latMax: bbox?.latMax,
          lngMin: bbox?.lngMin,
          lngMax: bbox?.lngMax,
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
    [filter.yearFrom, filter.yearTo, bbox],
  );

  // Refetch from page 1 whenever the filter changes (or on mount).
  useEffect(() => {
    if (filter.invalid) return;
    fetchPage(1, { append: false });
  }, [fetchPage, filter.invalid]);

  function handleLoadMore() {
    if (!hasNext || loading || loadingMore) return;
    fetchPage(page + 1, { append: true });
  }

  function handleRetry() {
    fetchPage(1, { append: false });
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

        {/* Filter card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose a time window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="group" aria-label="Time window mode" className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
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

        {/* Status row */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{filter.label}</span>
          {!loading && !error && (
            <span className="text-muted-foreground" aria-live="polite">
              {count} {count === 1 ? "story" : "stories"}
            </span>
          )}
        </div>

        {/* Content */}
        {error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : loading ? (
          <div
            className="flex justify-center py-16"
            aria-busy="true"
            aria-label="Loading timeline"
          >
            <LoadingSpinner />
          </div>
        ) : count === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No stories found for this time window.
          </p>
        ) : (
          <>
            <TimelineView stories={stories} />
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={!hasNext || loadingMore}
              >
                {loadingMore ? "Loading…" : hasNext ? "Load more" : "No more stories"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default TimelinePage;
