import { useState, useEffect, useCallback } from "react";
import { Clock, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import StoryCard from "@/components/StoryCard/StoryCard";
import SearchFilter from "@/components/SearchFilter/SearchFilter";
import { getStories } from "@/services/storyService";
import { useFilterState } from "@/hooks/useFilterState";

const PAGE_SIZE = 12;

function FeedPage() {
  const { q, yearFrom, yearTo, location, latMin, latMax, lngMin, tags, lngMax, latitude, longitude, radiusKm, page, sortBy, hasActiveFilters, setFilters } =
    useFilterState();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStories({ q, yearFrom, yearTo, location, latMin, latMax, lngMin, lngMax, latitude, longitude, radiusKm, tags, page, pageSize: PAGE_SIZE, sortBy });
      setStories(data.results);
      setTotalCount(data.count);
      setHasNext(Boolean(data.next));
      setHasPrevious(Boolean(data.previous));
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load stories. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [q, yearFrom, yearTo, location, latMin, latMax, lngMin, lngMax, latitude, longitude, radiusKm, tags, page, sortBy]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  function handleNext() {
    if (hasNext) setFilters({ page: page + 1 });
  }

  function handlePrevious() {
    if (hasPrevious) setFilters({ page: page - 1 });
  }

  function handleRetry() {
    fetchStories();
  }

  const emptyTitle = hasActiveFilters ? "No results found" : "No stories yet";
  const emptyMessage = hasActiveFilters
    ? "Try adjusting your search or removing some filters."
    : "Be the first to share a story from your community.";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Story Feed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore local history stories from communities around the world.
            </p>
          </div>

          <div
            role="group"
            aria-label="Sort order"
            className="flex overflow-hidden rounded-md border border-input text-sm font-medium"
          >
            <button
              aria-pressed={sortBy === "recent"}
              aria-label="Sort by Most Recent"
              onClick={() => setFilters({ sort_by: "recent" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                sortBy === "recent"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>Most Recent</span>
            </button>
            <div className="w-px bg-border" />
            <button
              aria-pressed={sortBy === "popular"}
              aria-label="Sort by Most Popular"
              onClick={() => setFilters({ sort_by: "popular" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                sortBy === "popular"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              <span>Most Popular</span>
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-6">
          <SearchFilter />
        </div>

        {/* Result count while searching */}
        {hasActiveFilters && !loading && !error && (
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {totalCount === 0
              ? "No stories match your search."
              : `${totalCount} ${totalCount === 1 ? "story" : "stories"} found`}
          </p>
        )}

        {/* Content area */}
        {error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : loading ? (
          <div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Loading stories"
            aria-busy="true"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <EmptyState title={emptyTitle} message={emptyMessage} />
        ) : (
          <>
            <section
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Stories"
            >
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </section>

            {/* Pagination */}
            <nav
              className="mt-10 flex items-center justify-center gap-4"
              aria-label="Pagination"
            >
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={!hasPrevious}
                aria-label="Previous page"
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground" aria-live="polite">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                onClick={handleNext}
                disabled={!hasNext}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}

export default FeedPage;
