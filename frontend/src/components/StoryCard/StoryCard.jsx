import { Link, useLocation } from "react-router-dom";
import { MapPin, Calendar, Heart, User } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTimePeriod } from "./storyCardUtils";

const StoryCard = ({ story }) => {
  const location = useLocation();
  const timePeriod = formatTimePeriod(story);
  const preview = story.preview_text ?? "";

  return (
    <Link
      to={`/stories/${story.id}`}
      state={{ from: location.pathname }}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      aria-label={`Read story: ${story.title}`}
    >
      <Card
        className={cn(
          "h-full transition-shadow hover:shadow-md cursor-pointer"
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2 flex-1">
              {story.title}
            </CardTitle>
            <Heart
              className={cn("h-4 w-4 shrink-0 mt-0.5", story.user_has_liked ? "fill-current text-red-500" : "text-muted-foreground")}
              aria-label={story.user_has_liked ? "Liked" : "Not liked"}
            />
          </div>
          {story.contributor_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{story.contributor_name}</span>
            </div>
          )}
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
        </CardContent>
      </Card>
    </Link>
  );
};

StoryCard.displayName = "StoryCard";

export default StoryCard;
