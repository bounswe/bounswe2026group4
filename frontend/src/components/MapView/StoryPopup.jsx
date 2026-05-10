import { MapPin, Calendar } from "lucide-react";

import { formatTimePeriod } from "@/components/StoryCard/storyCardUtils";

// NOTE: This component is rendered via renderToStaticMarkup and then handed to
// Leaflet's bindPopup as an innerHTML string. React escapes all values inside
// renderToStaticMarkup, so story fields from our trusted API are safe. Any
// future addition of user-controlled content (e.g. story body text) must be
// escaped or sanitized here to avoid XSS at that innerHTML boundary.
//
// Uses plain <a> tags (not <Link>) so the component does not require a
// react-router context during static rendering. Clicks are intercepted by
// StoryLinkInterceptor in MapView to perform client-side navigation.
function StoryPopup({ story }) {
  const timePeriod = formatTimePeriod(story);
  const lat = Number(story.location_lat);
  const lng = Number(story.location_lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  // Open the existing /timeline page with proximity params pre-applied —
  // useFilterState reads latitude/longitude/radius_km directly from the URL,
  // matching the behaviour of tapping a proximity filter chip elsewhere.
  // Coords are rounded to 6 decimals (~10 cm precision) so raw GeoJSON
  // floats don't pollute the address bar with 15-digit tails, and so the
  // tolerance window in isProximityFromDeviceLocation behaves predictably.
  const nearbyHref = hasCoords
    ? `/timeline?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&radius_km=0.5`
    : null;

  return (
    <div className="max-w-xs space-y-1.5">
      <h3 className="font-semibold text-sm line-clamp-2">{story.title}</h3>

      {story.location_name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{story.location_name}</span>
        </div>
      )}

      {timePeriod && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{timePeriod}</span>
        </div>
      )}

      <div className="flex items-center gap-3 pt-0.5">
        <a
          href={`/stories/${story.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Read more
        </a>
        {nearbyHref && (
          <a
            href={nearbyHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            View Timeline
          </a>
        )}
      </div>
    </div>
  );
}

export default StoryPopup;
