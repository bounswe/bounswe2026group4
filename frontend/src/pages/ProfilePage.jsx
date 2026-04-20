import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { User, BookOpen, CalendarDays, MapPin, Star } from "lucide-react";

import { SkeletonPage } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { getProfile } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";
import StructuredData from "@/components/StructuredData/StructuredData";
import FollowButton from "@/components/Follow/FollowButton";
import FollowListSheet from "@/components/Follow/FollowListSheet";

function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const targetUserId = paramUserId ?? user?.id;
  const [profile, setProfile] = useState(null);
  const isOwnProfile =
    user?.id != null &&
    profile?.id != null &&
    String(user.id) === String(profile.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [listSheet, setListSheet] = useState({ open: false, mode: "followers" });

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const profileData = await getProfile(targetUserId);
      setProfile(profileData);
      setFollowerCount(profileData.follower_count ?? 0);
      setFollowingCount(profileData.following_count ?? 0);
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

  function handleFollowChange(nowFollowing) {
    setFollowerCount((c) => Math.max(0, c + (nowFollowing ? 1 : -1)));
  }

  function openList(mode) {
    setListSheet({ open: true, mode });
  }

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
        <StructuredData user={profile} />
        {/* Profile Header */}
        <div className="mb-8 rounded-xl border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            {!isOwnProfile && (
              <div className="sm:shrink-0">
                <FollowButton
                  key={profile.id}
                  targetUserId={profile.id}
                  initialFollowing={Boolean(profile.is_followed_by_me)}
                  onChange={handleFollowChange}
                />
              </div>
            )}
          </div>

          {/* Follow counts */}
          <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => openList("followers")}
              className="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-semibold text-foreground">
                {followerCount}
              </span>{" "}
              <span className="text-muted-foreground">
                {followerCount === 1 ? "follower" : "followers"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openList("following")}
              className="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-semibold text-foreground">
                {followingCount}
              </span>{" "}
              <span className="text-muted-foreground">following</span>
            </button>
          </div>
        </div>

        {/* Stories Section */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <p>Story listing will be available soon.</p>
        </div>

        <FollowListSheet
          userId={profile.id}
          mode={listSheet.mode}
          open={listSheet.open}
          onOpenChange={(open) =>
            setListSheet((s) => ({ ...s, open }))
          }
        />
      </div>
    </main>
  );
}

export default ProfilePage;
