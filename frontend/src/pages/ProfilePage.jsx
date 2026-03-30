import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User, BookOpen, Mail, CalendarDays } from "lucide-react";

import { SkeletonPage } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import StoryCard from "@/components/StoryCard/StoryCard";
import { getProfile, getUserStories } from "@/services/userService";

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, storiesData] = await Promise.all([
        getProfile(),
        getUserStories(),
      ]);
      setProfile(profileData);
      setStories(storiesData.results);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
          aria-label="Loading profile"
          aria-busy="true"
        >
          <SkeletonPage />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <ErrorState message={error} onRetry={fetchData} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="mb-8 rounded-xl border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {profile.username}
              </h1>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>{profile.email}</span>
              </div>
              {profile.date_joined && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Joined{" "}
                    {new Date(profile.date_joined).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>
                  {profile.story_count ?? stories.length}{" "}
                  {(profile.story_count ?? stories.length) === 1
                    ? "story"
                    : "stories"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stories Section */}
        <h2 className="mb-4 text-xl font-semibold">Your Stories</h2>

        {stories.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No stories yet"
            message="You haven't submitted any stories yet."
            actionLabel="Submit a story"
            onAction={() => navigate("/stories/new")}
          />
        ) : (
          <section
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Your stories"
          >
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default ProfilePage;
