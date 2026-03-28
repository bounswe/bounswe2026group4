import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";

import FeedPage from "../FeedPage";

vi.mock("@/services/storyService", () => ({
  getStories: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getStories } from "@/services/storyService";

function makeStory(id, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    preview_text: "A short preview about history.",
    location_name: `Location ${id}`,
    time_type: "exact_year",
    year: 1900 + id,
    year_start: null,
    year_end: null,
    contributor_name: "historian",
    images: [],
    ...overrides,
  };
}

function makeResponse(overrides = {}) {
  return {
    count: 2,
    next: null,
    previous: null,
    results: [makeStory(1), makeStory(2)],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <BrowserRouter>
      <FeedPage />
    </BrowserRouter>
  );
}

describe("FeedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it("shows loading skeletons while fetching", () => {
    // Never resolve so we stay in loading state
    getStories.mockReturnValue(new Promise(() => {}));
    renderPage();

    const loadingRegion = screen.getByLabelText("Loading stories");
    expect(loadingRegion).toBeInTheDocument();
    // No real story cards should be present
    expect(screen.queryByRole("link", { name: /read story/i })).not.toBeInTheDocument();
  });

  it("renders story cards after successful fetch", async () => {
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story 1")).toBeInTheDocument();
      expect(screen.getByText("Story 2")).toBeInTheDocument();
    });
  });

  it("shows empty state when results are empty", async () => {
    getStories.mockResolvedValue(makeResponse({ count: 0, results: [] }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No stories yet")).toBeInTheDocument();
    });
  });

  it("shows error state when API throws", async () => {
    getStories.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("retry button calls service again after error", async () => {
    const user = userEvent.setup();
    getStories
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(makeResponse());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Story 1")).toBeInTheDocument();
    });

    expect(getStories).toHaveBeenCalledTimes(2);
  });

  it("shows pagination controls when stories are present", async () => {
    getStories.mockResolvedValue(makeResponse({ count: 25, next: "http://api/stories/?page=2" }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
  });

  it("previous button is disabled on page 1", async () => {
    getStories.mockResolvedValue(makeResponse({ previous: null }));
    renderPage();

    await waitFor(() => {
      const prevBtn = screen.getByRole("button", { name: /previous page/i });
      expect(prevBtn).toBeDisabled();
    });
  });

  it("next button is disabled when next is null", async () => {
    getStories.mockResolvedValue(makeResponse({ next: null }));
    renderPage();

    await waitFor(() => {
      const nextBtn = screen.getByRole("button", { name: /next page/i });
      expect(nextBtn).toBeDisabled();
    });
  });

  it("next button is enabled when next is not null", async () => {
    getStories.mockResolvedValue(
      makeResponse({ count: 25, next: "http://api/stories/?page=2" })
    );
    renderPage();

    await waitFor(() => {
      const nextBtn = screen.getByRole("button", { name: /next page/i });
      expect(nextBtn).not.toBeDisabled();
    });
  });

  it("clicking next button fetches page 2", async () => {
    const user = userEvent.setup();
    getStories
      .mockResolvedValueOnce(
        makeResponse({ count: 25, next: "http://api/stories/?page=2", previous: null })
      )
      .mockResolvedValue(
        makeResponse({ count: 25, next: null, previous: "http://api/stories/?page=1" })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next page/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(getStories).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("clicking previous button fetches previous page", async () => {
    const user = userEvent.setup();
    // Start on page 2 by navigating there first
    getStories
      .mockResolvedValueOnce(
        makeResponse({ count: 25, next: "http://api/?page=2", previous: null })
      )
      .mockResolvedValueOnce(
        makeResponse({ count: 25, next: null, previous: "http://api/?page=1" })
      )
      .mockResolvedValue(makeResponse({ count: 25, next: "http://api/?page=2", previous: null }));

    renderPage();

    // Go to page 2
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next page/i })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /next page/i }));

    // Now click previous
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /previous page/i })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /previous page/i }));

    await waitFor(() => {
      expect(getStories).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  it("displays current page and total pages", async () => {
    getStories.mockResolvedValue(makeResponse({ count: 24, next: "http://api/?page=2" }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    });
  });

  it("shows 'Most Recent' sort toggle button", async () => {
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    // Button is visible immediately (sort control is in header, not gated on data)
    expect(screen.getByRole("button", { name: /sort: most recent/i })).toBeInTheDocument();
  });

  it("renders the page heading", async () => {
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    expect(screen.getByRole("heading", { name: /story feed/i })).toBeInTheDocument();
  });

  it("each story card is a link to /stories/:id", async () => {
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /read story: story 1/i });
      expect(link).toHaveAttribute("href", "/stories/1");
    });
  });

  it("map view button navigates to /map", async () => {
    const user = userEvent.setup();
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    await user.click(screen.getByRole("button", { name: /map view/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/map");
  });

  it("add story button navigates to /stories/new", async () => {
    const user = userEvent.setup();
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    await user.click(screen.getByRole("button", { name: /add story/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/stories/new");
  });

  it("profile button navigates to /profile", async () => {
    const user = userEvent.setup();
    getStories.mockResolvedValue(makeResponse());
    renderPage();

    await user.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });

  it("feed view button is marked active", () => {
    getStories.mockReturnValue(new Promise(() => {}));
    renderPage();

    const feedBtn = screen.getByRole("button", { name: /feed view/i });
    expect(feedBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("map view button is not marked active on feed page", () => {
    getStories.mockReturnValue(new Promise(() => {}));
    renderPage();

    const mapBtn = screen.getByRole("button", { name: /map view/i });
    expect(mapBtn).toHaveAttribute("aria-pressed", "false");
  });
});
