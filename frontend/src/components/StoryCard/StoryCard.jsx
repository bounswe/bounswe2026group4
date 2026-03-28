import { Link } from "react-router-dom";
import { MapPin, Calendar, Image, Heart } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTimePeriod } from "./storyCardUtils";

const StoryCard = ({ story }) => {
  const timePeriod = formatTimePeriod(story);
  const preview = story.preview_text ?? "";
  const hasMedia = story.images?.length > 0;

  return (
    <Link
      to={`/stories/${story.id}`}
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
            {hasMedia && (
              <Image
                className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5"
                aria-label="Has media"
              />
            )}
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
            <p className="text-sm text-foreground/80 leading-relaxed">
              {preview}
            </p>
          )}
        </CardContent>

        {story.like_count > 0 && (
          <CardFooter className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{story.like_count}</span>
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
};

StoryCard.displayName = "StoryCard";

export default StoryCard;
