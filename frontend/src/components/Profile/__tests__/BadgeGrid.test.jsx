import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import BadgeGrid from "../BadgeGrid";

vi.mock("@/services/userService", () => ({
  getUserBadges: vi.fn(),
}));

import { getUserBadges } from "@/services/userService";

function makeBadge(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    badge: {
      id: overrides.badgeId ?? 1,
      name: overrides.name ?? "First Story",
      description:
        overrides.description ?? "Awarded for publishing your first story",
      criteria_type: overrides.criteria_type ?? "story_count",
      criteria_threshold: overrides.criteria_threshold ?? 1,
    },
    awarded_at: overrides.awarded_at ?? "2026-04-01T12:00:00Z",
  };
}

describe("BadgeGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while fetching", () => {
    getUserBadges.mockReturnValue(new Promise(() => {}));
    render(<BadgeGrid userId={1} />);
    expect(screen.getByLabelText(/loading badges/i)).toBeInTheDocument();
  });

  it("shows the empty state message when no badges are returned", async () => {
    getUserBadges.mockResolvedValue([]);
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText("No badges earned yet.")).toBeInTheDocument()
    );
  });

  it("shows an error state when the request fails", async () => {
    getUserBadges.mockRejectedValue(new Error("Network error"));
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText(/failed to load badges/i)).toBeInTheDocument()
    );
  });

  it("renders a card with name visible for each badge", async () => {
    getUserBadges.mockResolvedValue([
      makeBadge({ id: 1, name: "First Story", criteria_type: "story_count" }),
      makeBadge({
        id: 2,
        badgeId: 2,
        name: "Welcome Aboard",
        criteria_type: "registration",
        description: "Awarded for registering",
      }),
    ]);

    render(<BadgeGrid userId={1} />);

    await waitFor(() =>
      expect(screen.getByText("First Story")).toBeInTheDocument()
    );
    expect(screen.getByText("Welcome Aboard")).toBeInTheDocument();
  });

  it("uses the BookOpen icon for story_count badges", async () => {
    getUserBadges.mockResolvedValue([
      makeBadge({ name: "Storyteller", criteria_type: "story_count" }),
    ]);
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Storyteller")).toBeInTheDocument()
    );
    const card = screen.getByTestId("badge-card");
    expect(card).toHaveAttribute("data-criteria", "story_count");
    expect(card.querySelector('[data-icon="BookOpen"]')).toBeInTheDocument();
  });

  it("uses the Award icon for registration badges", async () => {
    getUserBadges.mockResolvedValue([
      makeBadge({ name: "Newcomer", criteria_type: "registration" }),
    ]);
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Newcomer")).toBeInTheDocument()
    );
    expect(
      screen.getByTestId("badge-card").querySelector('[data-icon="Award"]')
    ).toBeInTheDocument();
  });

  it("uses the Star icon for points badges", async () => {
    getUserBadges.mockResolvedValue([
      makeBadge({ name: "Centurion", criteria_type: "points" }),
    ]);
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Centurion")).toBeInTheDocument()
    );
    expect(
      screen.getByTestId("badge-card").querySelector('[data-icon="Star"]')
    ).toBeInTheDocument();
  });

  it("falls back to Trophy icon for unknown criteria types", async () => {
    getUserBadges.mockResolvedValue([
      makeBadge({ name: "Mystery", criteria_type: "something_unknown" }),
    ]);
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Mystery")).toBeInTheDocument()
    );
    expect(
      screen.getByTestId("badge-card").querySelector('[data-icon="Trophy"]')
    ).toBeInTheDocument();
  });

  it("exposes the badge description via tooltip content (sr-only fallback)", async () => {
    getUserBadges.mockResolvedValue([
      makeBadge({
        name: "First Story",
        description: "Awarded for publishing your first story",
      }),
    ]);
    render(<BadgeGrid userId={1} />);
    await waitFor(() =>
      expect(screen.getByText("First Story")).toBeInTheDocument()
    );
    expect(
      screen.getByText("Awarded for publishing your first story")
    ).toBeInTheDocument();
  });

  it("calls getUserBadges with the provided userId", async () => {
    getUserBadges.mockResolvedValue([]);
    render(<BadgeGrid userId={42} />);
    await waitFor(() =>
      expect(getUserBadges).toHaveBeenCalledWith(42)
    );
  });
});
