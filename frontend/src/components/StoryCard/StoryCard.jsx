import { Link, useLocation } from "react-router-dom";
import { MapPin, Calendar, Heart, User } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTimePeriod } from "./storyCardUtils";
import TagChip from "@/components/Tags/TagChip";
import BookmarkButton from "@/components/Interactions/BookmarkButton";

const StoryCard = ({ story, onBookmarkChange }) => {
  const location = useLocation();
  const timePeriod = formatTimePeriod(story);
  const preview = story.preview_text ?? "";

  return (
    <div className="relative h-full">
      <Link
        to={`/stories/${story.id}`}
        state={{ from: location.pathname }}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        aria-label={`Read story: ${story.title}`}
      >
        <Card
          className={cn(
            "h-full transition-shadow hover:shadow-md cursor-pointer"
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start gap-2">
              <CardTitle className="text-base line-clamp-2 flex-1 pr-10">
                {story.title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {story.contributor_name ?? "Anonymous"}
              </span>
            </div>
          </CardHeader>

          <CardContent className="pb-2 space-y-2">
            {story.location_name && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{story.location_name}</span>
              </div>
            )}

            {timePeriod && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{timePeriod}</span>
              </div>
            )}

            {preview && (
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3 break-words">
                {preview}…
              </p>
            )}

            {story.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {story.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Absolute overlay: like indicator + bookmark toggle */}
      <div className="absolute top-5 right-4 z-10 flex items-center gap-0.5">
        <Heart
          className={cn(
            "h-4 w-4 shrink-0",
            story.user_has_liked ? "fill-current text-red-500" : "text-muted-foreground"
          )}
          aria-label={story.user_has_liked ? "Liked" : "Not liked"}
        />
        <BookmarkButton
          storyId={story.id}
          initialBookmarked={story.user_has_saved ?? false}
          onToggle={(newBookmarked) => onBookmarkChange?.(story.id, newBookmarked)}
        />
      </div>
    </div>
  );
};

StoryCard.displayName = "StoryCard";

export default StoryCard;
