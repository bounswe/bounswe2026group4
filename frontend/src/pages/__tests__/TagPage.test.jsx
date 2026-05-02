import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/services/tagService", () => ({
  getTagStories: vi.fn(),
}));

vi.mock("@/components/StoryCard/StoryCard", () => ({
  default: ({ story }) => <div data-testid="story-card">{story.title}</div>,
}));

import { getTagStories } from "@/services/tagService";
import TagPage from "../TagPage";

function makeStory(id) {
  return {
    id,
    title: `Story ${id}`,
    location_name: "Istanbul",
    time_type: "exact_year",
    year: 1453,
    preview_text: "Preview text",
    tags: [],
  };
}

function renderPage(slug = "ottoman-era") {
  return render(
    <MemoryRouter initialEntries={[`/tags/${slug}`]}>
      <Routes>
        <Route path="/tags/:slug" element={<TagPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TagPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the tag heading from slug", async () => {
    getTagStories.mockResolvedValue({
      count: 0,
      results: [],
      next: null,
      previous: null,
    });
    renderPage("ottoman-era");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ottoman era/i })).toBeInTheDocument();
    });
  });

  it("shows story cards when stories exist", async () => {
    getTagStories.mockResolvedValue({
      count: 2,
      results: [makeStory(1), makeStory(2)],
      next: null,
      previous: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId("story-card")).toHaveLength(2);
    });
  });

  it("shows empty state when no stories match the tag", async () => {
    getTagStories.mockResolvedValue({
      count: 0,
      results: [],
      next: null,
      previous: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no stories found/i)).toBeInTheDocument();
    });
  });

  it("shows story count", async () => {
    getTagStories.mockResolvedValue({
      count: 5,
      results: Array.from({ length: 5 }, (_, i) => makeStory(i + 1)),
      next: null,
      previous: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/5 stories found/i)).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    getTagStories.mockRejectedValue({ message: "Network error" });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("disables previous button on first page", async () => {
    getTagStories.mockResolvedValue({
      count: 2,
      results: [makeStory(1), makeStory(2)],
      next: null,
      previous: null,
    });
    renderPage();
    await waitFor(() => screen.getAllByTestId("story-card"));
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
  });

  it("enables next button when more pages exist", async () => {
    getTagStories.mockResolvedValue({
      count: 20,
      results: Array.from({ length: 12 }, (_, i) => makeStory(i + 1)),
      next: "http://api/stories/feed/?tag=ottoman-era&page=2",
      previous: null,
    });
    renderPage();
    await waitFor(() => screen.getAllByTestId("story-card"));
    expect(screen.getByRole("button", { name: /next page/i })).not.toBeDisabled();
  });

  it("fetches next page when Next is clicked", async () => {
    const user = userEvent.setup();
    getTagStories.mockResolvedValue({
      count: 20,
      results: Array.from({ length: 12 }, (_, i) => makeStory(i + 1)),
      next: "http://api/stories/feed/?tag=ottoman-era&page=2",
      previous: null,
    });
    renderPage();
    await waitFor(() => screen.getAllByTestId("story-card"));

    await user.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(getTagStories).toHaveBeenCalledWith("ottoman-era", { page: 2, pageSize: 12 });
    });
  });

  it("calls getTagStories with the correct slug", async () => {
    getTagStories.mockResolvedValue({
      count: 0,
      results: [],
      next: null,
      previous: null,
    });
    renderPage("byzantine-history");
    await waitFor(() => {
      expect(getTagStories).toHaveBeenCalledWith("byzantine-history", expect.any(Object));
    });
  });
});
