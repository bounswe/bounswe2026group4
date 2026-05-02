import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import StoryCard from "@/components/StoryCard/StoryCard";
import { getTagStories } from "@/services/tagService";

const PAGE_SIZE = 12;

function formatTagName(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function TagPage() {
  const { slug } = useParams();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTagStories(slug, { page, pageSize: PAGE_SIZE });
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
  }, [slug, page]);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const tagLabel = formatTagName(slug);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{tagLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stories tagged with &ldquo;{slug}&rdquo;
          </p>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={fetchStories} />
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
            title="No stories found"
            message={`No stories have been tagged with "${tagLabel}" yet.`}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
              {totalCount} {totalCount === 1 ? "story" : "stories"} found
            </p>

            <section
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Stories"
            >
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </section>

            <nav
              className="mt-10 flex items-center justify-center gap-4"
              aria-label="Pagination"
            >
              <Button
                variant="outline"
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
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

export default TagPage;
