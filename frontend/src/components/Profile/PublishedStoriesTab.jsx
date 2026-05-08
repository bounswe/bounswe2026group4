import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { getUserStories } from "@/services/storyService";
import StoryCard from "@/components/StoryCard/StoryCard";

const PAGE_SIZE = 10;

function is404(error) {
  return error?.response?.status === 404;
}

function PublishedStoriesTab({ userId }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const requestIdRef = useRef(0);

  function handleBookmarkChange(storyId, newBookmarked) {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, user_has_saved: newBookmarked } : s))
    );
  }

  const fetchStories = useCallback(
    async (pg) => {
      const id = ++requestIdRef.current;
      if (pg === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const data = await getUserStories(userId, { page: pg, pageSize: PAGE_SIZE });
        if (id !== requestIdRef.current) return;
        setStories((prev) => (pg === 1 ? data.results : [...prev, ...data.results]));
        setHasNext(Boolean(data.next));
        setPage(pg);
      } catch (err) {
        if (id !== requestIdRef.current) return;
        setError(
          is404(err)
            ? "This profile is unavailable or no longer active."
            : "Failed to load published stories. Please try again."
        );
      } finally {
        if (id === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchStories(1);
  }, [fetchStories]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        aria-busy="true"
        aria-label="Loading published stories"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchStories(1)} />;
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <BookOpen className="h-8 w-8" aria-hidden="true" />
        <p className="text-sm">No published stories yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} onBookmarkChange={handleBookmarkChange} />
        ))}
      </div>

      {hasNext && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchStories(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default PublishedStoriesTab;
