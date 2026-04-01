import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { User, BookOpen, CalendarDays, MapPin, Star } from "lucide-react";

import { SkeletonPage } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { getProfile } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";

function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const targetUserId = paramUserId ?? user?.id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const profileData = await getProfile(targetUserId);
      setProfile(profileData);
      setError(null);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  if (!profile && !loading && !error) {
    return null;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <ErrorState message={error} onRetry={fetchProfile} />
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
                  {profile.published_story_count}{" "}
                  {profile.published_story_count === 1 ? "story" : "stories"}
                </span>
              </div>
              {profile.location && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.total_points > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Star className="h-4 w-4" aria-hidden="true" />
                  <span>{profile.total_points} points</span>
                </div>
              )}
              {profile.bio && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stories Section */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <p>Story listing will be available soon.</p>
        </div>
      </div>
    </main>
  );
}

export default ProfilePage;
