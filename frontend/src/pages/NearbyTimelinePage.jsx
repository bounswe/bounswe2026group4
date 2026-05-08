import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import SnakeTimelineView from "@/components/Timeline/SnakeTimelineView";
import { useFilterState } from "@/hooks/useFilterState";
import { getTimeline } from "@/services/timelineService";
import { formatDistanceKm } from "@/utils/distance";

const DEFAULT_RADIUS_KM = 0.5;
// Matches FALLBACK_FETCH_PAGE_SIZE in timelineService — the fallback path
// already fetches up to 100 rows from the backend, so requesting fewer would
// silently drop in-radius stories ranked beyond the slice.
const PAGE_SIZE = 100;

function NearbyTimelinePage() {
  const { latitude, longitude, radiusKm: radiusKmParam } = useFilterState();
  const radiusKm = radiusKmParam ?? DEFAULT_RADIUS_KM;

  const hasValidCoords =
    latitude != null &&
    longitude != null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(hasValidCoords);
  const [error, setError] = useState(null);

  // URL params can't change without a navigation, so the only race source is
  // a double-clicked retry button — discard responses from the prior attempt.
  const generationRef = useRef(0);

  const fetchStories = useCallback(async () => {
    if (!hasValidCoords) return;
    const myGen = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTimeline({
        latitude,
        longitude,
        radiusKm,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      if (myGen !== generationRef.current) return;
      setStories(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      if (myGen !== generationRef.current) return;
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load nearby stories. Please try again.",
      );
    } finally {
      if (myGen === generationRef.current) setLoading(false);
    }
  }, [hasValidCoords, latitude, longitude, radiusKm]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  function renderContent() {
    if (!hasValidCoords) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">
          A valid latitude and longitude are required.
        </p>
      );
    }
    if (loading) {
      return (
        <div
          className="flex justify-center py-16"
          aria-busy="true"
          aria-label="Loading nearby stories"
        >
          <LoadingSpinner />
        </div>
      );
    }
    if (error) return <ErrorState message={error} onRetry={fetchStories} />;
    if (stories.length === 0) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No stories within {formatDistanceKm(radiusKm)} of this point.
        </p>
      );
    }
    return <SnakeTimelineView stories={stories} />;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 h-8 px-2"
          >
            <Link to="/map">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to map
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Stories nearby</h1>
          {hasValidCoords && (
            <p
              className="mt-1 text-sm text-muted-foreground"
              data-testid="nearby-timeline-subtitle"
            >
              Within {formatDistanceKm(radiusKm)} of {latitude.toFixed(4)},{" "}
              {longitude.toFixed(4)}
            </p>
          )}
        </div>

        {!loading && !error && hasValidCoords && stories.length > 0 && (
          <div className="mb-4 text-right text-sm">
            <span className="text-muted-foreground" aria-live="polite">
              {stories.length} {stories.length === 1 ? "story" : "stories"}
            </span>
          </div>
        )}

        {renderContent()}
      </div>
    </main>
  );
}

export default NearbyTimelinePage;
