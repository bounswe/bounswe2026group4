import TimelineEntry from "./TimelineEntry";

/**
 * Pure presentational vertical timeline. Caller owns loading / empty / error
 * states; this component just renders one row per story over a vertical line.
 */
function TimelineView({ stories }) {
  if (!stories?.length) return null;

  return (
    <div className="relative pl-4">
      <div
        className="pointer-events-none absolute bottom-0 left-7 top-0 w-px bg-border"
        aria-hidden="true"
      />
      <ul className="space-y-6">
        {stories.map((story) => (
          <li key={story.id}>
            <TimelineEntry story={story} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TimelineView;
