import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatTimePeriod } from "@/components/StoryCard/storyCardUtils";
import { formatHistoricalDecade, formatHistoricalYear } from "@/utils/year";

/**
 * Best-effort label for the bullet on the timeline. Prefers the formatted
 * time period (year, "1870s", c. 1875, etc.); falls back to year_start
 * or the leading 4 digits of date_value when present.
 */
function bulletLabel(story) {
  const formatted = formatTimePeriod(story);
  if (formatted) return formatted;
  if (story.year != null) return formatHistoricalYear(story.year);
  if (story.year_start != null) return formatHistoricalYear(story.year_start);
  if (typeof story.date_value === "string") {
    const match = story.date_value.match(/-?\d{4}/);
    if (match) return formatHistoricalYear(Number(match[0]));
  }
  return "";
}

function decadeChip(story) {
  const yearForDecade = story.year ?? story.year_start;
  if (yearForDecade == null) return null;
  return formatHistoricalDecade(yearForDecade);
}

function TimelineEntry({ story }) {
  const label = bulletLabel(story);
  const decade = story.time_type === "decade" ? null : decadeChip(story);
  const hasCoords =
    story.location_lat != null && story.location_lng != null;
  const locationName =
    typeof story.location_name === "string" && story.location_name.trim()
      ? story.location_name.trim()
      : null;
  const locationText = locationName
    ? locationName
    : hasCoords
      ? `Mapped at ${Number(story.location_lat).toFixed(4)}, ${Number(story.location_lng).toFixed(4)}`
      : null;

  return (
    <div className="relative flex gap-4 pl-2">
      {/* Bullet */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "z-10 flex min-w-[3.5rem] items-center justify-center rounded-full border bg-background px-2 py-1",
            "text-xs font-medium text-foreground shadow-sm",
          )}
        >
          {label}
        </div>
      </div>

      {/* Card */}
      <Link
        to={`/stories/${story.id}`}
        className={cn(
          "group flex-1 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
          "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={`Read story: ${story.title}`}
      >
        {story.photo_url && (
          <img
            src={story.photo_url}
            alt={story.title}
            className="h-40 w-full object-cover"
            loading="lazy"
          />
        )}
        <div className="space-y-2 p-4">
          <h3 className="text-base font-semibold leading-snug text-foreground line-clamp-2">
            {story.title}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {label && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {label}
              </span>
            )}
            {decade && decade !== label && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {decade}
              </span>
            )}
            {story.temporal_coverage && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {story.temporal_coverage}
              </span>
            )}
          </div>

          {locationText && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{locationText}</span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

export default TimelineEntry;
