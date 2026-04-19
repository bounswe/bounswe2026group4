import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ProfilePage from "../ProfilePage";

vi.mock("@/services/userService", () => ({
  getProfile: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: 1 }, isAuthenticated: true })),
}));

vi.mock("@/components/Follow/FollowButton", () => ({
  default: ({ targetUserId, initialFollowing, onChange }) => (
    <button
      type="button"
      data-testid="follow-button"
      data-target-user-id={targetUserId}
      data-initial-following={String(initialFollowing)}
      onClick={() => onChange?.(!initialFollowing)}
    >
      mock-follow
    </button>
  ),
}));

vi.mock("@/components/Follow/FollowListSheet", () => ({
  default: ({ userId, mode, open }) =>
    open ? (
      <div
        data-testid="follow-list-sheet"
        data-user-id={userId}
        data-mode={mode}
      />
    ) : null,
}));

import { getProfile } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";

const mockProfileData = {
  id: 1,
  username: "historian",
  published_story_count: 2,
  date_joined: "2025-01-15T00:00:00Z",
  total_points: 10,
  bio: "History lover",
  location: "Istanbul",
  profile_photo: null,
  birth_year: 1990,
  follower_count: 12,
  following_count: 5,
  is_followed_by_me: false,
};

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
    useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
  });

  it("shows loading skeleton while fetching", () => {
    getProfile.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText("Loading profile")).toBeInTheDocument();
  });

  it("displays user info after successful fetch", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
    });

    expect(screen.getByText(/January 2025/)).toBeInTheDocument();
    expect(screen.getByText(/2 stories/i)).toBeInTheDocument();
    expect(screen.getByText("History lover")).toBeInTheDocument();
    expect(screen.getByText("Istanbul")).toBeInTheDocument();
    expect(screen.getByText(/10 points/i)).toBeInTheDocument();
    expect(getProfile).toHaveBeenCalledWith(1);
  });

  it("shows story listing coming soon message", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Story listing will be available soon.")
      ).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    getProfile.mockRejectedValue(new Error("Network error"));
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

  it("displays story count matching published_story_count", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/2 stories/i)).toBeInTheDocument();
    });
  });

  it("displays singular 'story' when published_story_count is 1", async () => {
    getProfile.mockResolvedValue({
      ...mockProfileData,
      published_story_count: 1,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/1 story/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/1 stories/i)).not.toBeInTheDocument();
  });

  it("hides bio when not present", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, bio: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
    });
    expect(screen.queryByText("History lover")).not.toBeInTheDocument();
  });

  it("hides total_points when zero", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, total_points: 0 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
    });
    expect(screen.queryByText(/points/i)).not.toBeInTheDocument();
  });

  describe("follow integration", () => {
    it("does NOT render the follow button on the user's own profile", async () => {
      // mockProfileData.id === auth user id === 1
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("historian")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("follow-button")).not.toBeInTheDocument();
    });

    it("renders the follow button on someone else's profile with initial state", async () => {
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
      getProfile.mockResolvedValue({ ...mockProfileData, is_followed_by_me: true });
      renderPage();

      const button = await screen.findByTestId("follow-button");
      expect(button).toHaveAttribute("data-target-user-id", "1");
      expect(button).toHaveAttribute("data-initial-following", "true");
    });

    it("displays follower and following counts from the profile payload", async () => {
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /12 followers/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /5 following/i })).toBeInTheDocument();
    });

    it("uses singular 'follower' when count is 1", async () => {
      getProfile.mockResolvedValue({ ...mockProfileData, follower_count: 1 });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /1 follower/i })).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: /1 followers/i })
      ).not.toBeInTheDocument();
    });

    it("opens the followers sheet when the followers count is clicked", async () => {
      const user = userEvent.setup();
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /12 followers/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /12 followers/i }));

      const sheet = await screen.findByTestId("follow-list-sheet");
      expect(sheet).toHaveAttribute("data-mode", "followers");
      expect(sheet).toHaveAttribute("data-user-id", "1");
    });

    it("opens the following sheet when the following count is clicked", async () => {
      const user = userEvent.setup();
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /5 following/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /5 following/i }));

      const sheet = await screen.findByTestId("follow-list-sheet");
      expect(sheet).toHaveAttribute("data-mode", "following");
    });

    it("optimistically updates the follower count when follow toggles", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
      getProfile.mockResolvedValue({
        ...mockProfileData,
        follower_count: 10,
        is_followed_by_me: false,
      });
      renderPage();

      const button = await screen.findByTestId("follow-button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /11 followers/i })).toBeInTheDocument();
      });
    });

    it("defaults follower/following counts to zero when missing from payload", async () => {
      const { follower_count: _f, following_count: _g, ...rest } = mockProfileData;
      getProfile.mockResolvedValue(rest);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^0 followers$/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /^0 following$/i })).toBeInTheDocument();
    });
  });
});
