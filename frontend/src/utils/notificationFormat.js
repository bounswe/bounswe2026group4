import {
  Heart,
  MessageCircle,
  Shield,
  Trash2,
  CheckCircle2,
  Trophy,
  UserPlus,
  BookOpen,
  Bell,
} from "lucide-react";

export const NOTIFICATION_TYPES = [
  { key: "new_comment", label: "New comments on your stories" },
  { key: "new_like", label: "New likes on your stories" },
  { key: "new_follower", label: "New followers" },
  { key: "moderation_action", label: "Moderation action on your content" },
  { key: "story_removed", label: "Your story removed by moderation" },
  { key: "report_resolved", label: "Resolution of reports you filed" },
  { key: "badge_earned", label: "New badge earned" },
  { key: "new_story_published", label: "New stories from people you follow" },
];

const ICON_MAP = {
  new_comment: MessageCircle,
  new_like: Heart,
  new_follower: UserPlus,
  moderation_action: Shield,
  story_removed: Trash2,
  report_resolved: CheckCircle2,
  badge_earned: Trophy,
  new_story_published: BookOpen,
};

export function getNotificationIcon(type) {
  return ICON_MAP[type] ?? Bell;
}

export function getNotificationRoute(notification) {
  if (!notification) return null;
  const { notification_type: type, story_id: storyId, comment_id: commentId, actor } = notification;

  if (type === "new_follower" && actor?.id) {
    return `/profile/${actor.id}`;
  }

  if (storyId) {
    return commentId ? `/stories/${storyId}#comment-${commentId}` : `/stories/${storyId}`;
  }

  if (type === "badge_earned") {
    return "/profile";
  }

  return null;
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.floor((Date.now() - then) / 1000);

  if (diffSec < 0) return "Just now";
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400 * 2) return "Yesterday";
  if (diffSec < 86400 * 7) {
    const d = Math.floor(diffSec / 86400);
    return `${d} days ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}
