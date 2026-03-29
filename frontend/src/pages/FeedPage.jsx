import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ChevronLeft, ChevronRight, Plus, User, Map, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import StoryCard from "@/components/StoryCard/StoryCard";
import { getStories } from "@/services/storyService";

const PAGE_SIZE = 12;

function FeedPage() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchStories = useCallback(async (page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStories({ page, pageSize: PAGE_SIZE });
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
  }, []);

  useEffect(() => {
    fetchStories(currentPage);
  }, [currentPage, fetchStories]);

  function handleNext() {
    if (hasNext) setCurrentPage((p) => p + 1);
  }

  function handlePrevious() {
    if (hasPrevious) setCurrentPage((p) => p - 1);
  }

  function handleRetry() {
    fetchStories(currentPage);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top nav bar */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Story Feed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore local history stories from communities around the world.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle: Feed ↔ Map */}
            <div className="flex rounded-md border border-input overflow-hidden" role="group" aria-label="View toggle">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Feed view"
                aria-pressed="true"
                className="rounded-none border-r border-input h-9 w-9 bg-accent"
              >
                <List aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Map view"
                aria-pressed="false"
                className="rounded-none h-9 w-9"
                onClick={() => navigate("/map")}
              >
                <Map aria-hidden="true" />
              </Button>
            </div>

            {/* Sort toggle */}
            <Button
              variant="outline"
              aria-label="Sort: Most Recent"
            >
              <Clock aria-hidden="true" />
              <span className="hidden sm:inline">Most Recent</span>
            </Button>

            {/* Add story */}
            <Button
              size="icon"
              aria-label="Add story"
              onClick={() => navigate("/stories/new")}
            >
              <Plus aria-hidden="true" />
            </Button>

            {/* Profile */}
            <Button
              variant="outline"
              size="icon"
              aria-label="Profile"
              onClick={() => navigate("/profile")}
            >
              <User aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        {error ? (
          <ErrorState
            message={error}
            onRetry={handleRetry}
          />
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
          <EmptyState
            title="No stories yet"
            message="Be the first to share a story from your community."
          />
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
                Page {currentPage} of {totalPages}
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
