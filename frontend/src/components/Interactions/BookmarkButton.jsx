import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/context/ToastContext";
import { addBookmark, removeBookmark } from "@/services/bookmarkService";
import { cn } from "@/lib/utils";

function BookmarkButton({ storyId, initialBookmarked = false, onToggle }) {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToastContext();
  const navigate = useNavigate();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  async function handleClick(e) {
    e?.stopPropagation();
    if (loading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    setLoading(true);

    try {
      if (newBookmarked) {
        await addBookmark(storyId);
      } else {
        await removeBookmark(storyId);
      }
      onToggle?.(newBookmarked);
    } catch {
      setBookmarked(bookmarked);
      addToast({ message: "Failed to update bookmark. Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      aria-label={bookmarked ? "Remove bookmark" : "Save story"}
      aria-pressed={bookmarked}
      className={cn("h-7 w-7 p-0", bookmarked && "text-primary")}
    >
      <Bookmark
        className={cn("h-4 w-4", bookmarked && "fill-current")}
        aria-hidden="true"
      />
    </Button>
  );
}

export default BookmarkButton;
