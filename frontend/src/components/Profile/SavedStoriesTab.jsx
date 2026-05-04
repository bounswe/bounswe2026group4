import { useState, useEffect, useCallback } from "react";
import { Bookmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { getBookmarks } from "@/services/bookmarkService";
import { useToastContext } from "@/context/ToastContext";
import StoryCard from "@/components/StoryCard/StoryCard";

const PAGE_SIZE = 10;

function SavedStoriesTab({ userId }) {
  const { addToast } = useToastContext();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const fetchBookmarks = useCallback(
    async (pg) => {
      if (pg === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const data = await getBookmarks(userId, { page: pg, pageSize: PAGE_SIZE });
        setStories((prev) => (pg === 1 ? data.results : [...prev, ...data.results]));
        setTotalCount(data.count);
        setHasNext(Boolean(data.next));
        setPage(pg);
      } catch {
        setError("Failed to load saved stories. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchBookmarks(1);
  }, [fetchBookmarks]);

  function handleBookmarkChange(storyId, newBookmarked) {
    if (!newBookmarked) {
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      addToast({ message: "Story removed from saved stories.", variant: "success" });
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        aria-busy="true"
        aria-label="Loading saved stories"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchBookmarks(1)} />;
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Bookmark className="h-8 w-8" aria-hidden="true" />
        <p className="text-sm">No saved stories yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        <span>
          {totalCount} saved {totalCount === 1 ? "story" : "stories"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            onBookmarkChange={handleBookmarkChange}
          />
        ))}
      </div>

      {hasNext && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchBookmarks(page + 1)}
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

export default SavedStoriesTab;
