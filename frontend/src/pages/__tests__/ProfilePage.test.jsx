import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ProfilePage from "../ProfilePage";

vi.mock("@/services/userService", () => ({
  getProfile: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: 1 } })),
}));

import { getProfile } from "@/services/userService";

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
});
