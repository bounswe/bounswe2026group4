import { Link } from "react-router-dom";
import { formatTimePeriod } from "@/components/StoryCard/storyCardUtils";

function StoryPopup({ story }) {
  const timePeriod = formatTimePeriod(story);

  return (
    <div className="max-w-xs">
      <h3 className="font-semibold text-sm mb-1">{story.title}</h3>
      {story.location_name && (
        <p className="text-xs text-muted-foreground mb-0.5">{story.location_name}</p>
      )}
      {timePeriod && (
        <p className="text-xs text-muted-foreground mb-1">{timePeriod}</p>
      )}
      <Link
        to={`/stories/${story.id}`}
        state={{ from: "/map" }}
        className="text-xs font-medium text-primary hover:underline"
      >
        Read more
      </Link>
    </div>
  );
}

export default StoryPopup;
