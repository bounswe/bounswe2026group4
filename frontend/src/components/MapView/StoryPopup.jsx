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
  // URL keys mirror useFilterState's `latitude` / `longitude` so the target
  // page can pick them up via the same hook the rest of the app uses.
  const nearbyHref = hasCoords
    ? `/nearby-timeline?latitude=${lat}&longitude=${lng}`
    : null;

  return (
    <div className="max-w-xs">
      <h3 className="font-semibold text-sm mb-1">{story.title}</h3>
      {story.location_name && (
        <p className="text-xs text-muted-foreground mb-0.5">{story.location_name}</p>
      )}
      {timePeriod && (
        <p className="text-xs text-muted-foreground mb-1">{timePeriod}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
