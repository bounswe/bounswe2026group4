import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ProfilePage from "../ProfilePage";
import { AuthContext } from "@/context/AuthContext";

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

const mockUser = {
  id: 1,
  username: "historian",
  email: "historian@example.com",
};

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

function renderPage(authValue = { user: mockUser, isAuthenticated: true }) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <ProfilePage />
      </AuthContext.Provider>
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
});
