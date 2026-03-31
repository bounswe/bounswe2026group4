import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Calendar, User, ArrowLeft } from "lucide-react";

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
          <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Back to feed
            </Link>
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
          <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Back to feed
            </Link>
          </Button>
          <ErrorState message={error} onRetry={fetchStory} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Back to feed
          </Link>
        </Button>

        {loading ? (
          <StoryDetailSkeleton />
        ) : (
          <article>
            <h1 className="text-3xl font-bold tracking-tight mb-4">
              {story.title}
            </h1>

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

              {contributorName && (
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {contributorName}
                </span>
              )}

              {submittedDate && (
                <span className="text-muted-foreground/70">
                  {submittedDate}
                </span>
              )}
            </div>

            {/* Location map */}
            {story.location_lat && story.location_lng && (
              <div className="mb-8">
                <StoryDetailMap lat={parseFloat(story.location_lat)} lng={parseFloat(story.location_lng)} />
              </div>
            )}

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
