import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import SavedStoriesTab from "../SavedStoriesTab";
import { ToastProvider } from "@/context/ToastContext";

vi.mock("@/services/bookmarkService", () => ({
  getBookmarks: vi.fn(),
}));

vi.mock("@/components/StoryCard/StoryCard", () => ({
  default: ({ story, onBookmarkChange }) => (
    <div data-testid="story-card" data-story-id={story.id}>
      <span>{story.title}</span>
      <button
        type="button"
        aria-label="Remove bookmark"
        onClick={() => onBookmarkChange?.(story.id, false)}
      >
        unbookmark
      </button>
    </div>
  ),
}));

import { getBookmarks } from "@/services/bookmarkService";

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
    user_has_saved: true,
    tags: [],
    ...overrides,
  };
}

function makeBookmarksResponse({ stories = [], count = 0, next = null } = {}) {
  return { count, next, previous: null, results: stories };
}

function renderTab(userId = 1) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <SavedStoriesTab userId={userId} />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("SavedStoriesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while fetching", () => {
    getBookmarks.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(screen.getByLabelText("Loading saved stories")).toBeInTheDocument();
  });

  it("shows empty state when no bookmarks", async () => {
    getBookmarks.mockResolvedValue(makeBookmarksResponse());
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/no saved stories yet/i)).toBeInTheDocument()
    );
  });

  it("renders story cards for each bookmark", async () => {
    getBookmarks.mockResolvedValue(
      makeBookmarksResponse({ stories: [makeStory(1), makeStory(2)], count: 2 })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getAllByTestId("story-card")).toHaveLength(2)
    );
    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Story 2")).toBeInTheDocument();
  });

  it("shows total count of saved stories", async () => {
    getBookmarks.mockResolvedValue(
      makeBookmarksResponse({ stories: [makeStory(1)], count: 5 })
    );
    renderTab();
    await waitFor(() => expect(screen.getByText(/5 saved stories/i)).toBeInTheDocument());
  });

  it("shows singular 'story' for count of 1", async () => {
    getBookmarks.mockResolvedValue(
      makeBookmarksResponse({ stories: [makeStory(1)], count: 1 })
    );
    renderTab();
    await waitFor(() => expect(screen.getByText(/1 saved story/i)).toBeInTheDocument());
  });

  it("shows error state on fetch failure", async () => {
    getBookmarks.mockRejectedValue(new Error("Network error"));
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/failed to load saved stories/i)).toBeInTheDocument()
    );
  });

  it("removes story from list when un-bookmarked and shows toast", async () => {
    const user = userEvent.setup();
    getBookmarks.mockResolvedValue(
      makeBookmarksResponse({ stories: [makeStory(1), makeStory(2)], count: 2 })
    );
    renderTab();

    await waitFor(() => expect(screen.getAllByTestId("story-card")).toHaveLength(2));

    const unbookmarkButtons = screen.getAllByRole("button", { name: /remove bookmark/i });
    await user.click(unbookmarkButtons[0]);

    expect(screen.getAllByTestId("story-card")).toHaveLength(1);
    expect(screen.queryByText("Story 1")).not.toBeInTheDocument();
    expect(screen.getByText("Story 2")).toBeInTheDocument();
  });

  it("shows 'Load more' button when there is a next page", async () => {
    getBookmarks.mockResolvedValue(
      makeBookmarksResponse({
        stories: [makeStory(1)],
        count: 15,
        next: "http://localhost:8000/users/1/bookmarks/?page=2",
      })
    );
    renderTab();
    await waitFor(() => expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument());
  });

  it("does not show 'Load more' when no next page", async () => {
    getBookmarks.mockResolvedValue(
      makeBookmarksResponse({ stories: [makeStory(1)], count: 1 })
    );
    renderTab();
    await waitFor(() => expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument());
  });

  it("loads more stories when 'Load more' is clicked", async () => {
    const user = userEvent.setup();
    getBookmarks
      .mockResolvedValueOnce(
        makeBookmarksResponse({
          stories: [makeStory(1)],
          count: 2,
          next: "http://localhost:8000/users/1/bookmarks/?page=2",
        })
      )
      .mockResolvedValueOnce(
        makeBookmarksResponse({ stories: [makeStory(2)], count: 2 })
      );

    renderTab();

    await waitFor(() => expect(screen.getByTestId("story-card")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => expect(screen.getAllByTestId("story-card")).toHaveLength(2));
    expect(screen.getByText("Story 2")).toBeInTheDocument();
  });

  it("calls getBookmarks with the correct userId", async () => {
    getBookmarks.mockResolvedValue(makeBookmarksResponse());
    renderTab(42);
    await waitFor(() => expect(getBookmarks).toHaveBeenCalledWith(42, expect.any(Object)));
  });
});
