import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { MapPin, Calendar, ArrowLeft, MessageSquare, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getStoryById, deleteStory } from "@/services/storyService";
import { formatTimePeriod } from "@/components/StoryCard/storyCardUtils";
import TagChip from "@/components/Tags/TagChip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import StoryDetailMap from "@/components/StoryDetailMap/StoryDetailMap";
import LikeButton from "@/components/Interactions/LikeButton";
import CommentSection from "@/components/Interactions/CommentSection";
import StructuredData from "@/components/StructuredData/StructuredData";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const handleBack = () => locationState?.from ? navigate(locationState.from) : navigate(-1);
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [userHasCommented, setUserHasCommented] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const canDelete = story && (user?.id === story.user || user?.role === "admin");

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteStory(id);
      toast.success("Story deleted successfully");
      if (locationState?.from) navigate(locationState.from);
      else navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete story. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchStory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setCommentCount(0);
    setUserHasCommented(false);
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
  const images = (story?.media_items ?? []).filter((m) => m.media_type === "image");

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
          <>
            <StructuredData story={story} />
            <article aria-labelledby="story-title">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h1 id="story-title" className="text-3xl font-bold tracking-tight">
                {story.title}
              </h1>
              {canDelete && (
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                    aria-label="Delete story"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete story?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this story? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={handleDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

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

            {story.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {story.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div
                className={`mb-8 grid gap-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}
                aria-label="Story images"
              >
                {images.map((img, idx) => (
                  <figure key={img.id ?? idx} className="overflow-hidden rounded-xl bg-muted">
                    <img
                      src={img.url}
                      alt={`Story image ${idx + 1}`}
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

            {/* Location map */}
            {(() => {
              const lat = parseFloat(story.location_lat);
              const lng = parseFloat(story.location_lng);
              return !isNaN(lat) && !isNaN(lng) ? (
                <div className="mt-8">
                  <StoryDetailMap lat={lat} lng={lng} />
                </div>
              ) : null;
            })()}

            <div className="mt-6 flex items-center gap-4">
              <LikeButton
                storyId={story.id}
                initialLiked={story.user_has_liked ?? false}
                initialCount={story.like_count ?? 0}
              />
              <span
                className={`flex items-center gap-1.5 text-sm ${userHasCommented ? "text-primary" : "text-muted-foreground"}`}
                aria-label={userHasCommented ? "You have commented on this story" : undefined}
              >
                <MessageSquare
                  className={`h-4 w-4 shrink-0 ${userHasCommented ? "fill-primary stroke-primary" : ""}`}
                  aria-hidden="true"
                />
                {commentCount}
              </span>
            </div>

            <CommentSection
              storyId={story.id}
              onCountChange={setCommentCount}
              onUserCommentedChange={setUserHasCommented}
            />
          </article>
          </>
        )}
      </div>
    </main>
  );
}

export default StoryDetailPage;
