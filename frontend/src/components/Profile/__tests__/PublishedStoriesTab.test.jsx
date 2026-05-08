import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import PublishedStoriesTab from "../PublishedStoriesTab";

vi.mock("@/services/storyService", () => ({
  getUserStories: vi.fn(),
}));

vi.mock("@/components/StoryCard/StoryCard", () => ({
  default: ({ story }) => (
    <div data-testid="story-card" data-story-id={story.id}>
      <span>{story.title}</span>
    </div>
  ),
}));

import { getUserStories } from "@/services/storyService";

function makeStory(id = 1, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    location_name: "Istanbul",
    time_type: "exact_year",
    year: 1900,
    preview_text: "A short preview",
    contributor_name: "author",
    user_has_liked: false,
    user_has_saved: false,
    tags: [],
    ...overrides,
  };
}

function makeStoriesResponse({ stories = [], count = 0, next = null } = {}) {
  return { count, next, previous: null, results: stories };
}

function renderTab(userId = 1) {
  return render(
    <MemoryRouter>
      <PublishedStoriesTab userId={userId} />
    </MemoryRouter>
  );
}

describe("PublishedStoriesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while fetching", () => {
    getUserStories.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(screen.getByLabelText("Loading published stories")).toBeInTheDocument();
  });

  it("shows empty state when user has no published stories", async () => {
    getUserStories.mockResolvedValue(makeStoriesResponse());
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/no published stories yet/i)).toBeInTheDocument()
    );
  });

  it("renders story cards for each published story", async () => {
    getUserStories.mockResolvedValue(
      makeStoriesResponse({ stories: [makeStory(1), makeStory(2)], count: 2 })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getAllByTestId("story-card")).toHaveLength(2)
    );
    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Story 2")).toBeInTheDocument();
  });

  it("shows total count of published stories", async () => {
    getUserStories.mockResolvedValue(
      makeStoriesResponse({ stories: [makeStory(1)], count: 7 })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/7 published stories/i)).toBeInTheDocument()
    );
  });

  it("shows singular 'story' for count of 1", async () => {
    getUserStories.mockResolvedValue(
      makeStoriesResponse({ stories: [makeStory(1)], count: 1 })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/1 published story/i)).toBeInTheDocument()
    );
  });

  it("shows generic error state on fetch failure", async () => {
    getUserStories.mockRejectedValue(new Error("Network error"));
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/failed to load published stories/i)).toBeInTheDocument()
    );
  });

  it("shows 404-specific message when profile is unavailable", async () => {
    const err = new Error("Not found");
    err.response = { status: 404 };
    getUserStories.mockRejectedValue(err);
    renderTab();
    await waitFor(() =>
      expect(
        screen.getByText("This profile is unavailable or no longer active.")
      ).toBeInTheDocument()
    );
  });

  it("shows 'Load more' button when there is a next page", async () => {
    getUserStories.mockResolvedValue(
      makeStoriesResponse({
        stories: [makeStory(1)],
        count: 15,
        next: "http://localhost:8000/users/1/stories/?page=2",
      })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()
    );
  });

  it("does not show 'Load more' when no next page", async () => {
    getUserStories.mockResolvedValue(
      makeStoriesResponse({ stories: [makeStory(1)], count: 1 })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument()
    );
  });

  it("loads more stories when 'Load more' is clicked", async () => {
    const user = userEvent.setup();
    getUserStories
      .mockResolvedValueOnce(
        makeStoriesResponse({
          stories: [makeStory(1)],
          count: 2,
          next: "http://localhost:8000/users/1/stories/?page=2",
        })
      )
      .mockResolvedValueOnce(
        makeStoriesResponse({ stories: [makeStory(2)], count: 2 })
      );

    renderTab();

    await waitFor(() => expect(screen.getByTestId("story-card")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => expect(screen.getAllByTestId("story-card")).toHaveLength(2));
    expect(screen.getByText("Story 2")).toBeInTheDocument();
  });

  it("calls getUserStories with the correct userId", async () => {
    getUserStories.mockResolvedValue(makeStoriesResponse());
    renderTab(42);
    await waitFor(() =>
      expect(getUserStories).toHaveBeenCalledWith(42, expect.any(Object))
    );
  });

  it("reflects user_has_liked and user_has_saved from story data", async () => {
    getUserStories.mockResolvedValue(
      makeStoriesResponse({
        stories: [makeStory(1, { user_has_liked: true, user_has_saved: true })],
        count: 1,
      })
    );
    renderTab();
    await waitFor(() => expect(screen.getByTestId("story-card")).toBeInTheDocument());
    expect(screen.getByTestId("story-card")).toHaveAttribute("data-story-id", "1");
  });
});
