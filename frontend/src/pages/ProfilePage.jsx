import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { User, BookOpen, CalendarDays, MapPin, Star, Pencil, Lock, Loader2, Bell } from "lucide-react";

import { SkeletonPage } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { getProfile, getOwnProfile } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";
import StructuredData from "@/components/StructuredData/StructuredData";
import FollowButton from "@/components/Follow/FollowButton";
import FollowListSheet from "@/components/Follow/FollowListSheet";
import EditProfileForm from "@/components/Profile/EditProfileForm";
import SavedStoriesTab from "@/components/Profile/SavedStoriesTab";
import BadgeGrid from "@/components/Profile/BadgeGrid";

function formatBirthDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function PrivateBadge() {
  return (
    <span
      className="flex items-center gap-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
      title="Only visible to you"
    >
      <Lock className="h-3 w-3" aria-hidden="true" />
      Private
    </span>
  );
}

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
  const [editMode, setEditMode] = useState(false);
  const [ownProfileData, setOwnProfileData] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const profileData = await getProfile(targetUserId);
      setProfile(profileData);
      setFollowerCount(profileData.followers_count ?? 0);
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

  const fetchOwnProfile = useCallback(async () => {
    if (!isOwnProfile) return null;
    const result = await getOwnProfile().catch(() => null);
    setOwnProfileData(result ?? null);
    return result;
  }, [isOwnProfile]);

  useEffect(() => {
    fetchOwnProfile();
  }, [fetchOwnProfile]);

  function handleFollowChange(nowFollowing) {
    setFollowerCount((c) => Math.max(0, c + (nowFollowing ? 1 : -1)));
  }

  async function handleEditSave() {
    setEditMode(false);
    await Promise.all([fetchProfile(), fetchOwnProfile()]);
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
          {editMode ? (
            ownProfileData ? (
              <EditProfileForm
                initialProfile={ownProfileData}
                onSave={handleEditSave}
                onCancel={() => setEditMode(false)}
              />
            ) : (
              <div className="flex items-center justify-center py-12" aria-label="Loading profile data" aria-busy="true">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                {/* Photo — own profile: show regardless of is_photo_public */}
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {(isOwnProfile ? ownProfileData?.profile?.profile_photo : profile.profile_photo) ? (
                    <img
                      src={isOwnProfile ? ownProfileData.profile.profile_photo : profile.profile_photo}
                      alt={`${profile.username}'s profile`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  )}
                  {isOwnProfile && ownProfileData?.profile?.profile_photo && !ownProfileData.profile.is_photo_public && (
                    <span
                      className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/80"
                      aria-label="Photo is private"
                      title="Only visible to you"
                    >
                      <Lock className="h-3 w-3 text-background" aria-hidden="true" />
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight">
                      {profile.username}
                    </h1>
                    <span
                      data-testid="profile-points"
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary"
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {Number(profile.total_points ?? 0).toLocaleString("en-US")} points
                      </span>
                    </span>
                  </div>

                  {/* Name — own profile: show even if private */}
                  {(() => {
                    const op = ownProfileData?.profile;
                    const firstName = isOwnProfile && op ? op.first_name : profile.first_name;
                    const lastName = isOwnProfile && op ? op.last_name : profile.last_name;
                    const name = [firstName, lastName].filter(Boolean).join(" ");
                    if (!name) return null;
                    return (
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-muted-foreground">{name}</p>
                        {isOwnProfile && op && !op.is_name_public && <PrivateBadge />}
                      </div>
                    );
                  })()}

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

                  {/* Location — own profile: show even if private */}
                  {(() => {
                    const op = ownProfileData?.profile;
                    const loc = isOwnProfile && op ? op.location : profile.location;
                    if (!loc) return null;
                    return (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        <span>{loc}</span>
                        {isOwnProfile && op && !op.is_location_public && <PrivateBadge />}
                      </div>
                    );
                  })()}

                  {/* Birth date — own profile: show full date even if private */}
                  {(() => {
                    const op = ownProfileData?.profile;
                    let birthLabel = null;
                    if (isOwnProfile && op?.birth_date) {
                      birthLabel = `Born ${formatBirthDate(op.birth_date)}`;
                    } else if (profile.birth_date) {
                      birthLabel = `Born ${formatBirthDate(profile.birth_date)}`;
                    } else if (profile.birth_year) {
                      birthLabel = `Born ${profile.birth_year}`;
                    }
                    if (!birthLabel) return null;
                    return (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        <span>{birthLabel}</span>
                        {isOwnProfile && op && !op.is_birth_date_public && <PrivateBadge />}
                      </div>
                    );
                  })()}

                  {/* Bio — own profile: show even if set (bio has no privacy flag) */}
                  {(() => {
                    const op = ownProfileData?.profile;
                    const bio = isOwnProfile && op ? op.bio : profile.bio;
                    if (!bio) return null;
                    return (
                      <p className="mt-2 text-sm text-muted-foreground">{bio}</p>
                    );
                  })()}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {isOwnProfile && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/notifications/preferences">
                        <Bell className="h-4 w-4" />
                        Notifications
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMode(true)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  </>
                )}
                {!isOwnProfile && (
                  <FollowButton
                    key={profile.id}
                    targetUserId={profile.id}
                    initialFollowing={Boolean(profile.is_followed_by_me)}
                    onChange={handleFollowChange}
                  />
                )}
              </div>
            </div>
          )}

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

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Badges</h2>
          <BadgeGrid userId={profile.id} />
        </section>

        {/* Stories Section */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <p>Story listing will be available soon.</p>
        </div>

        {/* Saved Stories — only shown on own profile */}
        {isOwnProfile && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Saved Stories</h2>
            <SavedStoriesTab userId={profile.id} />
          </div>
        )}

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
