import { cn } from "@/lib/utils";
import TimelineEntry from "./TimelineEntry";

/**
 * Snake-like (zigzag) variant of TimelineView used by NearbyTimelinePage.
 *
 * Layout: a single vertical spine. Cards stack on the right of the spine on
 * narrow viewports; on md+ they alternate left and right of the spine to
 * produce the snake/kıvrımlı flow described in issue #488. Each entry gets a
 * bullet anchored on the spine to reinforce the chronological connection.
 */
function SnakeTimelineView({ stories }) {
  if (!stories?.length) return null;

  return (
    <div className="relative" data-testid="snake-timeline">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-4 w-px bg-border md:left-1/2 md:-translate-x-1/2"
      />
      <ol>
        {stories.map((story, index) => {
          const placeRight = index % 2 === 1;
          return (
            <li
              key={story.id}
              className={cn(
                "relative pb-10 pl-10",
                "md:grid md:grid-cols-2 md:gap-x-12 md:pl-0",
              )}
            >
              <span
                aria-hidden="true"
                className="absolute left-3 top-3 h-3 w-3 rounded-full border-2 border-primary bg-background md:left-1/2 md:-translate-x-1/2"
              />
              <div className={placeRight ? "md:col-start-2" : "md:col-start-1"}>
                <TimelineEntry story={story} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default SnakeTimelineView;
