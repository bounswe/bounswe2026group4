import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Heart,
  MessageCircle,
  UserPlus,
  Trophy,
  Bell,
} from "lucide-react";

import {
  getNotificationIcon,
  getNotificationRoute,
  formatRelativeTime,
  NOTIFICATION_TYPES,
} from "../notificationFormat";

describe("getNotificationIcon", () => {
  it("returns the correct icon component for each known type", () => {
    expect(getNotificationIcon("new_comment")).toBe(MessageCircle);
    expect(getNotificationIcon("new_like")).toBe(Heart);
    expect(getNotificationIcon("new_follower")).toBe(UserPlus);
    expect(getNotificationIcon("badge_earned")).toBe(Trophy);
  });

  it("falls back to Bell for unknown types", () => {
    expect(getNotificationIcon("totally_unknown")).toBe(Bell);
    expect(getNotificationIcon(undefined)).toBe(Bell);
  });
});

describe("getNotificationRoute", () => {
  it("routes to actor profile for new_follower", () => {
    expect(
      getNotificationRoute({
        notification_type: "new_follower",
        actor: { id: 42, username: "ali" },
      })
    ).toBe("/profile/42");
  });

  it("routes to story page when story_id present", () => {
    expect(
      getNotificationRoute({
        notification_type: "new_like",
        story_id: 99,
      })
    ).toBe("/stories/99");
  });

  it("routes to comment anchor when both story and comment present", () => {
    expect(
      getNotificationRoute({
        notification_type: "new_comment",
        story_id: 99,
        comment_id: 7,
      })
    ).toBe("/stories/99#comment-7");
  });

  it("routes to /profile for badge_earned without story context", () => {
    expect(
      getNotificationRoute({ notification_type: "badge_earned" })
    ).toBe("/profile");
  });

  it("returns null when no useful target exists", () => {
    expect(
      getNotificationRoute({ notification_type: "moderation_action" })
    ).toBe(null);
    expect(getNotificationRoute(null)).toBe(null);
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Just now' for recent timestamps", () => {
    expect(formatRelativeTime("2026-05-06T11:59:30Z")).toBe("Just now");
  });

  it("returns minutes for under-an-hour values", () => {
    expect(formatRelativeTime("2026-05-06T11:55:00Z")).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-05-06T11:59:00Z")).toBe("1 minute ago");
  });

  it("returns hours for under-a-day values", () => {
    expect(formatRelativeTime("2026-05-06T10:00:00Z")).toBe("2 hours ago");
    expect(formatRelativeTime("2026-05-06T11:00:00Z")).toBe("1 hour ago");
  });

  it("returns 'Yesterday' for one-day-old timestamps", () => {
    expect(formatRelativeTime("2026-05-05T10:00:00Z")).toBe("Yesterday");
  });

  it("returns days for 2–6 day old timestamps", () => {
    expect(formatRelativeTime("2026-05-03T12:00:00Z")).toBe("3 days ago");
  });

  it("returns a locale date for week-old or older timestamps", () => {
    const result = formatRelativeTime("2026-04-01T12:00:00Z");
    expect(result).not.toMatch(/ago|Yesterday|Just now/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty string for falsy or invalid input", () => {
    expect(formatRelativeTime(null)).toBe("");
    expect(formatRelativeTime("")).toBe("");
    expect(formatRelativeTime("not-a-date")).toBe("");
  });
});

describe("NOTIFICATION_TYPES", () => {
  it("covers all 8 backend notification types", () => {
    const keys = NOTIFICATION_TYPES.map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "new_comment",
        "new_like",
        "new_follower",
        "moderation_action",
        "story_removed",
        "report_resolved",
        "badge_earned",
        "new_story_published",
      ])
    );
    expect(keys).toHaveLength(8);
  });
});
