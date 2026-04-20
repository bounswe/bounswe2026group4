import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { followUser, unfollowUser } from "@/services/followService";
import { cn } from "@/lib/utils";

function FollowButton({
  targetUserId,
  initialFollowing = false,
  onChange,
  className,
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline" size="sm" className={className}>
        <Link to="/login" aria-label="Log in to follow this user">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Log in to follow
        </Link>
      </Button>
    );
  }

  async function handleToggle() {
    if (loading) return;

    const previous = following;
    const next = !previous;

    setFollowing(next);
    setLoading(true);
    onChange?.(next);

    try {
      if (next) {
        await followUser(targetUserId);
      } else {
        await unfollowUser(targetUserId);
      }
    } catch {
      setFollowing(previous);
      onChange?.(previous);
      toast.error(
        next
          ? "Failed to follow user. Please try again."
          : "Failed to unfollow user. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={following ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      aria-pressed={following}
      aria-label={following ? "Unfollow user" : "Follow user"}
      className={cn("gap-1.5", className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : following ? (
        <UserCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <UserPlus className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{following ? "Following" : "Follow"}</span>
    </Button>
  );
}

export default FollowButton;
