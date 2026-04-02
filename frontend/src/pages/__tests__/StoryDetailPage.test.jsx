import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import StoryDetailPage from "../StoryDetailPage";

vi.mock("@/services/storyService", () => ({
  getStoryById: vi.fn(),
}));

vi.mock("@/components/StoryDetailMap/StoryDetailMap", () => ({
  default: ({ lat, lng }) => (
    <div data-testid="story-detail-map" data-lat={lat} data-lng={lng} />
  ),
}));

vi.mock("@/components/Interactions/LikeButton", () => ({
  default: ({ storyId, initialLiked, initialCount }) => (
    <div
      data-testid="like-button"
      data-story-id={storyId}
      data-liked={String(initialLiked)}
      data-count={initialCount}
    />
  ),
}));

vi.mock("@/components/Interactions/CommentSection", () => ({
  default: ({ storyId, onCountChange, onUserCommentedChange }) => {
    onCountChange?.(3);
    onUserCommentedChange?.(false);
    return <div data-testid="comment-section" data-story-id={storyId} />;
  },
}));

import { getStoryById } from "@/services/storyService";

function makeStory(overrides = {}) {
  return {
    id: 1,
    user: 1,
    title: "The Great Fire of Beyoglu",
    narrative: "In the early hours of morning, flames spread through the district.\n\nResidents fled with what little they could carry.",
    location_name: "Beyoglu, Istanbul",
    time_type: "exact_year",
    year: 1870,
    year_start: null,
    year_end: null,
    submitted_at: "2025-06-15T10:00:00Z",
    contributor_name: "historian",
    like_count: 5,
    ...overrides,
  };
}

function renderPage(id = "1", locationState = undefined) {
  const initialEntry = locationState
    ? { pathname: `/stories/${id}`, state: locationState }
    : `/stories/${id}`;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/stories/:id" element={<StoryDetailPage />} />
        <Route path="/" element={<div>Feed Page</div>} />
        <Route path="/map" element={<div>Map Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("StoryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    getStoryById.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText("Loading story")).toBeInTheDocument();
  });

  it("renders story title after successful fetch", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });
  });

  it("renders location name", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Beyoglu, Istanbul")).toBeInTheDocument();
    });
  });

  it("renders formatted time period", async () => {
    getStoryById.mockResolvedValue(makeStory({ time_type: "exact_year", year: 1870 }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1870")).toBeInTheDocument();
    });
  });

  it("renders submitted date with 'Date added' label", async () => {
    getStoryById.mockResolvedValue(makeStory({ submitted_at: "2025-06-15T10:00:00Z" }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/date added:.*june 15, 2025/i)).toBeInTheDocument();
    });
  });

  it("renders each narrative paragraph separately", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/In the early hours of morning/)).toBeInTheDocument();
      expect(screen.getByText(/Residents fled with what little/)).toBeInTheDocument();
    });
  });

  it("shows not-found state on 404 response", async () => {
    const err = { response: { status: 404 } };
    getStoryById.mockRejectedValue(err);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story not found")).toBeInTheDocument();
    });
  });

  it("shows error state on non-404 API failure", async () => {
    getStoryById.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows API error detail message when provided", async () => {
    const err = { response: { status: 500, data: { detail: "Server exploded" } } };
    getStoryById.mockRejectedValue(err);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Server exploded")).toBeInTheDocument();
    });
  });

  it("retry button re-fetches the story after error", async () => {
    const user = userEvent.setup();
    getStoryById
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(makeStory());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(getStoryById).toHaveBeenCalledTimes(2);
  });

  it("stories link is present in loaded state", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /stories/i })).toBeInTheDocument();
  });

  it("stories link is present in not-found state", async () => {
    getStoryById.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story not found")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /stories/i })).toBeInTheDocument();
  });

  it("stories link is present in error state", async () => {
    getStoryById.mockRejectedValue(new Error("fail"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /stories/i })).toBeInTheDocument();
  });

  it("renders contributor name as a link to their profile", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "historian" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/profile/1");
    });
  });

  it("omits contributor name when absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ contributor_name: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("link", { name: "historian" })).not.toBeInTheDocument();
  });

  it("renders images when present", async () => {
    getStoryById.mockResolvedValue(makeStory({
      images: [
        { id: 10, url: "http://example.com/img1.jpg", original_filename: "fire.jpg" },
      ],
    }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "fire.jpg" })).toBeInTheDocument();
    });
  });

  it("does not render image section when images are absent", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Story images")).not.toBeInTheDocument();
  });

  it("renders map when coordinates are present", async () => {
    getStoryById.mockResolvedValue(makeStory({ location_lat: "41.0082", location_lng: "28.9784" }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("story-detail-map")).toBeInTheDocument();
    });

    expect(screen.getByTestId("story-detail-map")).toHaveAttribute("data-lat", "41.0082");
    expect(screen.getByTestId("story-detail-map")).toHaveAttribute("data-lng", "28.9784");
  });

  it("does not render map when coordinates are absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ location_lat: null, location_lng: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByTestId("story-detail-map")).not.toBeInTheDocument();
  });

  it("omits location when location_name is absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ location_name: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByText("Beyoglu, Istanbul")).not.toBeInTheDocument();
  });

  it("omits date when submitted_at is absent", async () => {
    getStoryById.mockResolvedValue(makeStory({ submitted_at: null }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    expect(screen.queryByText(/date added/i)).not.toBeInTheDocument();
  });

  it("calls getStoryById with the correct id from the URL", async () => {
    getStoryById.mockResolvedValue(makeStory({ id: 42 }));
    renderPage("42");

    await waitFor(() => {
      expect(getStoryById).toHaveBeenCalledWith("42");
    });
  });

  it("renders decade time period correctly", async () => {
    getStoryById.mockResolvedValue(makeStory({ time_type: "decade", year: 1870 }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1870s")).toBeInTheDocument();
    });
  });

  it("renders LikeButton with story like data", async () => {
    getStoryById.mockResolvedValue(makeStory({ like_count: 7, user_has_liked: true }));
    renderPage();

    await waitFor(() => {
      const btn = screen.getByTestId("like-button");
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("data-story-id", "1");
      expect(btn).toHaveAttribute("data-liked", "true");
      expect(btn).toHaveAttribute("data-count", "7");
    });
  });

  it("renders comment count from CommentSection next to like button", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument(); // count reported by mock
    });
  });

  it("renders CommentSection with story id", async () => {
    getStoryById.mockResolvedValue(makeStory());
    renderPage();

    await waitFor(() => {
      const section = screen.getByTestId("comment-section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("data-story-id", "1");
    });
  });

  it("renders year range time period correctly", async () => {
    getStoryById.mockResolvedValue(makeStory({ time_type: "year_range", year_start: 1860, year_end: 1880 }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1860\u20131880")).toBeInTheDocument();
    });
  });

  it("back button navigates to map when navigated from map view", async () => {
    const user = userEvent.setup();
    getStoryById.mockResolvedValue(makeStory());
    renderPage("1", { from: "/map" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /stories/i }));

    expect(screen.getByText("Map Page")).toBeInTheDocument();
  });

  it("back button navigates to feed when no from state", async () => {
    const user = userEvent.setup();
    getStoryById.mockResolvedValue(makeStory());

    // Seed history so navigate(-1) has an entry to go back to
    render(
      <MemoryRouter initialEntries={["/", "/stories/1"]} initialIndex={1}>
        <Routes>
          <Route path="/stories/:id" element={<StoryDetailPage />} />
          <Route path="/" element={<div>Feed Page</div>} />
          <Route path="/map" element={<div>Map Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Great Fire of Beyoglu" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /stories/i }));

    expect(screen.getByText("Feed Page")).toBeInTheDocument();
  });
});
