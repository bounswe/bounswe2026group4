import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ProfilePage from "../ProfilePage";

vi.mock("@/services/userService", () => ({
  getProfile: vi.fn(),
  getUserStories: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getProfile, getUserStories } from "@/services/userService";

const mockProfileData = {
  id: 1,
  username: "historian",
  email: "historian@example.com",
  story_count: 2,
  date_joined: "2025-01-15T00:00:00Z",
};

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

function makeStoriesResponse(overrides = {}) {
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
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it("shows loading skeleton while fetching", () => {
    getProfile.mockReturnValue(new Promise(() => {}));
    getUserStories.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText("Loading profile")).toBeInTheDocument();
  });

  it("displays user info after successful fetch", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    getUserStories.mockResolvedValue(makeStoriesResponse());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
      expect(screen.getByText("historian@example.com")).toBeInTheDocument();
    });
  });

  it("renders story cards when user has stories", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    getUserStories.mockResolvedValue(makeStoriesResponse());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Story 1")).toBeInTheDocument();
      expect(screen.getByText("Story 2")).toBeInTheDocument();
    });
  });

  it("shows empty state when user has no stories", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, story_count: 0 });
    getUserStories.mockResolvedValue(makeStoriesResponse({ count: 0, results: [] }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No stories yet")).toBeInTheDocument();
      expect(
        screen.getByText("You haven't submitted any stories yet.")
      ).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    getProfile.mockRejectedValue(new Error("Network error"));
    getUserStories.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("retry button re-fetches data after error", async () => {
    const user = userEvent.setup();
    getProfile
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(mockProfileData);
    getUserStories
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(makeStoriesResponse());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
    });

    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it("displays story count matching number of stories", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    getUserStories.mockResolvedValue(makeStoriesResponse());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/2 stories/i)).toBeInTheDocument();
    });
  });

  it("empty state has action button to submit a story", async () => {
    const user = userEvent.setup();
    getProfile.mockResolvedValue({ ...mockProfileData, story_count: 0 });
    getUserStories.mockResolvedValue(makeStoriesResponse({ count: 0, results: [] }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No stories yet")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /submit a story/i });
    await user.click(submitBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/stories/new");
  });

  it("displays singular 'story' when story_count is 1", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, story_count: 1 });
    getUserStories.mockResolvedValue(
      makeStoriesResponse({ count: 1, results: [makeStory(1)] })
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/1 story/i)).toBeInTheDocument();
    });
    // Make sure it doesn't say "stories"
    expect(screen.queryByText(/1 stories/i)).not.toBeInTheDocument();
  });

  it("shows pagination controls with Previous/Next buttons", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, story_count: 24 });
    getUserStories.mockResolvedValue(
      makeStoriesResponse({
        count: 24,
        next: "http://api/users/me/stories/?page=2",
        previous: null,
      })
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    const prevBtn = screen.getByRole("button", { name: /previous page/i });
    const nextBtn = screen.getByRole("button", { name: /next page/i });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it("navigates to next page when Next is clicked", async () => {
    const user = userEvent.setup();
    getProfile.mockResolvedValue({ ...mockProfileData, story_count: 24 });
    getUserStories
      .mockResolvedValueOnce(
        makeStoriesResponse({
          count: 24,
          next: "http://api/users/me/stories/?page=2",
          previous: null,
        })
      )
      .mockResolvedValueOnce(
        makeStoriesResponse({
          count: 24,
          next: null,
          previous: "http://api/users/me/stories/?page=1",
          results: [makeStory(3), makeStory(4)],
        })
      );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: /next page/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });

    expect(getUserStories).toHaveBeenCalledWith({ page: 2, pageSize: 12 });
  });

  it("only calls getProfile once when paginating", async () => {
    const user = userEvent.setup();
    getProfile.mockResolvedValue({ ...mockProfileData, story_count: 24 });
    getUserStories
      .mockResolvedValueOnce(
        makeStoriesResponse({
          count: 24,
          next: "http://api/users/me/stories/?page=2",
          previous: null,
        })
      )
      .mockResolvedValueOnce(
        makeStoriesResponse({
          count: 24,
          next: null,
          previous: "http://api/users/me/stories/?page=1",
          results: [makeStory(3), makeStory(4)],
        })
      );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: /next page/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });

    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it("shows error state (not crash) when profile fails but stories succeed", async () => {
    getProfile.mockRejectedValue(new Error("Unauthorized"));
    getUserStories.mockResolvedValue(makeStoriesResponse());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Should not crash trying to render profile.username
    expect(screen.queryByText("historian")).not.toBeInTheDocument();
  });
});
