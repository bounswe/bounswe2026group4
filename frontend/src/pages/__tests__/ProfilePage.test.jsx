import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ProfilePage from "../ProfilePage";

vi.mock("@/services/userService", () => ({
  getProfile: vi.fn(),
  getOwnProfile: vi.fn(),
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

vi.mock("@/components/Profile/EditProfileForm", () => ({
  default: ({ onSave, onCancel }) => (
    <div data-testid="edit-profile-form">
      <button type="button" onClick={onSave}>mock-save</button>
      <button type="button" onClick={onCancel}>mock-cancel</button>
    </div>
  ),
}));

vi.mock("@/components/Profile/DeleteAccountDialog", () => ({
  default: ({ open, onOpenChange }) =>
    open ? (
      <div data-testid="delete-account-dialog">
        <button type="button" onClick={() => onOpenChange(false)}>mock-close-delete</button>
      </div>
    ) : null,
}));

vi.mock("@/components/Profile/SavedStoriesTab", () => ({
  default: ({ userId }) => (
    <div data-testid="saved-stories-tab" data-user-id={userId} />
  ),
}));

vi.mock("@/components/Profile/PublishedStoriesTab", () => ({
  default: ({ userId }) => (
    <div data-testid="published-stories-tab" data-user-id={userId} />
  ),
}));

vi.mock("@/components/Profile/BadgeGrid", () => ({
  default: ({ userId }) => (
    <div data-testid="badge-grid" data-user-id={userId} />
  ),
}));

import { getProfile, getOwnProfile } from "@/services/userService";
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
  followers_count: 12,
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
    getOwnProfile.mockResolvedValue(null);
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

  it("renders the published stories section with the correct userId", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("published-stories-tab")).toBeInTheDocument();
    });
    expect(screen.getByTestId("published-stories-tab")).toHaveAttribute(
      "data-user-id",
      "1"
    );
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

  it("displays 0 points prominently when total_points is zero", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, total_points: 0 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
    });
    expect(screen.getByTestId("profile-points")).toHaveTextContent(/0\s*points/i);
  });

  it("formats large point totals with comma separators", async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, total_points: 1250 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("historian")).toBeInTheDocument();
    });
    expect(screen.getByTestId("profile-points")).toHaveTextContent(/1,250\s*points/i);
  });

  it("renders the BadgeGrid for the profile user", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    renderPage();

    const badgeGrid = await screen.findByTestId("badge-grid");
    expect(badgeGrid).toHaveAttribute("data-user-id", "1");
  });

  it("shows a Badges section heading", async () => {
    getProfile.mockResolvedValue(mockProfileData);
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /^badges$/i })
      ).toBeInTheDocument();
    });
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
      getProfile.mockResolvedValue({ ...mockProfileData, followers_count: 1 });
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
        followers_count: 10,
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
      const { followers_count: _f, following_count: _g, ...rest } = mockProfileData;
      getProfile.mockResolvedValue(rest);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^0 followers$/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /^0 following$/i })).toBeInTheDocument();
    });
  });

  describe("edit profile", () => {
    it("shows Edit Profile button on own profile", async () => {
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      const btn = await screen.findByRole("button", { name: /Edit Profile/i });
      expect(btn).toBeInTheDocument();
    });

    it("does NOT show Edit Profile button on another user's profile", async () => {
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("historian")).toBeInTheDocument()
      );
      expect(
        screen.queryByRole("button", { name: /Edit Profile/i })
      ).not.toBeInTheDocument();
    });

    it("renders EditProfileForm when Edit Profile is clicked", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      getOwnProfile.mockResolvedValue({ profile: {} });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Edit Profile/i }));

      expect(await screen.findByTestId("edit-profile-form")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Edit Profile/i })
      ).not.toBeInTheDocument();
    });

    it("hides EditProfileForm, re-fetches public and own profile when onSave is called", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      getOwnProfile.mockResolvedValue({ profile: {} });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Edit Profile/i }));
      await user.click(screen.getByRole("button", { name: "mock-save" }));

      await waitFor(() =>
        expect(screen.queryByTestId("edit-profile-form")).not.toBeInTheDocument()
      );
      // initial fetch + re-fetch after save
      expect(getProfile).toHaveBeenCalledTimes(2);
      // own profile re-fetched so birth date / privacy fields are fresh
      expect(getOwnProfile).toHaveBeenCalledTimes(2);
    });

    it("hides action buttons while in edit mode", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      getOwnProfile.mockResolvedValue({ profile: {} });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Edit Profile/i }));

      expect(screen.queryByRole("button", { name: /Edit Profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Delete Profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Reset Password/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Notifications/i })).not.toBeInTheDocument();
    });

    it("hides EditProfileForm without re-fetching when onCancel is called", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      getOwnProfile.mockResolvedValue({ profile: {} });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Edit Profile/i }));
      await user.click(await screen.findByRole("button", { name: "mock-cancel" }));

      await waitFor(() =>
        expect(screen.queryByTestId("edit-profile-form")).not.toBeInTheDocument()
      );
      expect(getProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete profile", () => {
    it("shows Delete Profile button on own profile", async () => {
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      const btn = await screen.findByRole("button", { name: /Delete Profile/i });
      expect(btn).toBeInTheDocument();
    });

    it("does NOT show Delete Profile button on another user's profile", async () => {
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() => expect(screen.getByText("historian")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /Delete Profile/i })).not.toBeInTheDocument();
    });

    it("opens DeleteAccountDialog when Delete Profile button is clicked", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Delete Profile/i }));

      expect(screen.getByTestId("delete-account-dialog")).toBeInTheDocument();
    });

    it("closes DeleteAccountDialog when onOpenChange(false) is called", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Delete Profile/i }));
      await user.click(screen.getByRole("button", { name: /mock-close-delete/i }));

      expect(screen.queryByTestId("delete-account-dialog")).not.toBeInTheDocument();
    });
  });

  describe("reset password", () => {
    it("shows Reset Password link on own profile", async () => {
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      const link = await screen.findByRole("link", { name: /Reset Password/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/forgot-password");
    });

    it("does NOT show Reset Password link on another user's profile", async () => {
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
      getProfile.mockResolvedValue(mockProfileData);
      renderPage();

      await waitFor(() => expect(screen.getByText("historian")).toBeInTheDocument());
      expect(screen.queryByRole("link", { name: /Reset Password/i })).not.toBeInTheDocument();
    });
  });

  describe("public profile fields", () => {
    beforeEach(() => {
      // View as a different user so own-profile logic doesn't interfere
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
    });

    it("renders profile photo when profile_photo is present", async () => {
      getProfile.mockResolvedValue({
        ...mockProfileData,
        profile_photo: "http://example.com/photo.jpg",
      });
      renderPage();

      const img = await screen.findByAltText(/historian's profile/i);
      expect(img).toHaveAttribute("src", "http://example.com/photo.jpg");
    });

    it("renders first and last name when present", async () => {
      getProfile.mockResolvedValue({
        ...mockProfileData,
        first_name: "John",
        last_name: "Doe",
      });
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("John Doe")).toBeInTheDocument()
      );
    });

    it("renders full birth date when birth_date is present", async () => {
      getProfile.mockResolvedValue({ ...mockProfileData, birth_date: "1990-06-15" });
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("Born June 15, 1990")).toBeInTheDocument()
      );
    });

    it("falls back to birth_year when only birth_year is present", async () => {
      getProfile.mockResolvedValue({ ...mockProfileData, birth_date: null, birth_year: 1990 });
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("Born 1990")).toBeInTheDocument()
      );
    });

    it("does not render birth info when both absent", async () => {
      getProfile.mockResolvedValue({ ...mockProfileData, birth_date: null, birth_year: null });
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("historian")).toBeInTheDocument()
      );
      expect(screen.queryByText(/Born/i)).not.toBeInTheDocument();
    });
  });

  describe("own profile — birthday fallback when ownProfileData.birth_date is null", () => {
    it("falls back to profile.birth_year when own profile has no birth_date set but public", async () => {
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      // public endpoint has birth_year because is_birth_date_public = true
      getProfile.mockResolvedValue({ ...mockProfileData, birth_year: 1990, birth_date: null });
      // own profile fetch returns birth_date: null (user hasn't set it yet this session)
      getOwnProfile.mockResolvedValue({
        id: 1,
        profile: {
          birth_date: null,
          is_birth_date_public: true,
        },
      });
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("Born 1990")).toBeInTheDocument()
      );
    });
  });

  describe("own profile — private field visibility", () => {
    const ownProfileFull = {
      id: 1,
      profile: {
        first_name: "Alice",
        last_name: "Doe",
        location: "Istanbul",
        bio: "Secret bio",
        birth_date: "1990-06-15",
        is_name_public: false,
        is_location_public: false,
        is_birth_date_public: false,
        is_photo_public: true,
        profile_photo: null,
      },
    };

    beforeEach(() => {
      useAuth.mockReturnValue({ user: { id: 1 }, isAuthenticated: true });
      getProfile.mockResolvedValue({ ...mockProfileData, location: null, bio: null, birth_year: null });
      getOwnProfile.mockResolvedValue(ownProfileFull);
    });

    it("shows private location on own profile", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("Istanbul")).toBeInTheDocument()
      );
    });

    it("shows Private badge next to private location", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("Istanbul")).toBeInTheDocument()
      );
      const badges = screen.getAllByText("Private");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("shows private bio on own profile", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("Secret bio")).toBeInTheDocument()
      );
    });

    it("shows private birth date on own profile", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("Born June 15, 1990")).toBeInTheDocument()
      );
    });

    it("shows private name on own profile with Private badge", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("Alice Doe")).toBeInTheDocument()
      );
      const badges = screen.getAllByText("Private");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("does NOT show private fields on another user's profile", async () => {
      useAuth.mockReturnValue({ user: { id: 99 }, isAuthenticated: true });
      // public profile returns null for private fields (server filters them)
      getProfile.mockResolvedValue({
        ...mockProfileData,
        id: 1,
        location: null,
        bio: null,
        birth_year: null,
        first_name: null,
        last_name: null,
      });
      renderPage();

      await waitFor(() =>
        expect(screen.getByText("historian")).toBeInTheDocument()
      );
      expect(screen.queryByText("Istanbul")).not.toBeInTheDocument();
      expect(screen.queryByText("Secret bio")).not.toBeInTheDocument();
      expect(screen.queryByText("Born 1990")).not.toBeInTheDocument();
      expect(getOwnProfile).not.toHaveBeenCalled();
    });
  });
});
