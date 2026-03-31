import { Link } from "react-router-dom";
import { formatTimePeriod } from "@/components/StoryCard/storyCardUtils";

function StoryPopup({ story }) {
  const timePeriod = formatTimePeriod(story);
  const words = (story.preview_text || "").split(/\s+/);
  const preview = words.slice(0, 20).join(" ") + (words.length > 20 ? "..." : "");

  return (
    <div className="max-w-xs">
      <h3 className="font-semibold text-sm mb-1">{story.title}</h3>
      {story.location_name && (
        <p className="text-xs text-muted-foreground mb-0.5">{story.location_name}</p>
      )}
      {timePeriod && (
        <p className="text-xs text-muted-foreground mb-1">{timePeriod}</p>
      )}
      {preview && (
        <p className="text-xs mb-2">{preview}</p>
      )}
      <Link
        to={`/stories/${story.id}`}
        className="text-xs font-medium text-primary hover:underline"
      >
        Read more
      </Link>
    </div>
  );
}

export default StoryPopup;
