import { useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { likeStory, unlikeStory } from "@/services/interactionService";
import { cn } from "@/lib/utils";

function LikeButton({ storyId, initialLiked = false, initialCount = 0 }) {
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (loading) return;

    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : count - 1;

    // Optimistic update
    setLiked(newLiked);
    setCount(newCount);
    setLoading(true);

    try {
      if (newLiked) {
        await likeStory(storyId);
      } else {
        await unlikeStory(storyId);
      }
    } catch {
      // Revert on failure
      setLiked(liked);
      setCount(count);
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Heart className="h-4 w-4" aria-hidden="true" />
        <span>{count}</span>
        <Link to="/login" className="text-primary hover:underline">
          Log in to like
        </Link>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      aria-label={liked ? "Unlike story" : "Like story"}
      aria-pressed={liked}
      className={cn("gap-1.5", liked && "text-rose-500 hover:text-rose-600")}
    >
      <Heart
        className={cn("h-4 w-4", liked && "fill-current")}
        aria-hidden="true"
      />
      <span>{count}</span>
    </Button>
  );
}

export default LikeButton;
