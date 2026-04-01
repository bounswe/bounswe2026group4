import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { MapPin, Calendar, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { getStoryById } from "@/services/storyService";
import { formatTimePeriod } from "@/components/StoryCard/storyCardUtils";
import StoryDetailMap from "@/components/StoryDetailMap/StoryDetailMap";

function formatDate(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StoryDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading story">
      <Skeleton className="h-9 w-2/3" />
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

function StoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state: locationState } = useLocation();
  const handleBack = () => locationState?.from ? navigate(locationState.from) : navigate(-1);
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  const fetchStory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await getStoryById(id);
      setStory(data);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load story. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const timePeriod = story ? formatTimePeriod(story) : null;
  const submittedDate = story ? formatDate(story.submitted_at) : null;
  const contributorName = story?.contributor_name ?? null;
  const images = story?.images ?? [];

  if (notFound) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Stories
          </Button>
          <ErrorState
            title="Story not found"
            message="This story does not exist or may have been removed."
          />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Stories
          </Button>
          <ErrorState message={error} onRetry={fetchStory} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={handleBack}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Stories
        </Button>

        {loading ? (
          <StoryDetailSkeleton />
        ) : (
          <article aria-labelledby="story-title">
            <h1 id="story-title" className="text-3xl font-bold tracking-tight mb-1">
              {story.title}
            </h1>

            {contributorName && (
              <p className="text-sm text-muted-foreground mb-4">
                by{" "}
                <Link
                  to={`/profile/${story.user}`}
                  className="hover:underline"
                >
                  {contributorName}
                </Link>
              </p>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground mb-6">
              {story.location_name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {story.location_name}
                </span>
              )}

              {timePeriod && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {timePeriod}
                </span>
              )}

              {submittedDate && (
                <span className="text-muted-foreground/70">
                  Date added: {submittedDate}
                </span>
              )}
            </div>

            {/* Location map */}
            {(() => {
              const lat = parseFloat(story.location_lat);
              const lng = parseFloat(story.location_lng);
              return !isNaN(lat) && !isNaN(lng) ? (
                <div className="mb-8">
                  <StoryDetailMap lat={lat} lng={lng} />
                </div>
              ) : null;
            })()}

            {/* Images — rendered only when the backend returns them */}
            {images.length > 0 && (
              <div
                className={`mb-8 grid gap-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}
                aria-label="Story images"
              >
                {images.map((img, idx) => (
                  <figure key={img.id ?? idx} className="overflow-hidden rounded-xl bg-muted">
                    <img
                      src={img.url}
                      alt={img.original_filename || `Story image ${idx + 1}`}
                      className="w-full object-cover max-h-96"
                    />
                  </figure>
                ))}
              </div>
            )}

            <div className="prose prose-neutral max-w-none">
              {story.narrative.split(/\n\n+/).map((paragraph, idx) => (
                <p key={idx} className="mb-4 leading-7 text-foreground/90 whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}

export default StoryDetailPage;
