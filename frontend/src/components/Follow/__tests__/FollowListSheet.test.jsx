import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import FollowListSheet from "../FollowListSheet";
import { ToastProvider } from "@/context/ToastContext";

vi.mock("@/services/followService", () => ({
  getFollowers: vi.fn(),
  getFollowing: vi.fn(),
}));

import { getFollowers, getFollowing } from "@/services/followService";

function renderSheet(props = {}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <ToastProvider>
      <MemoryRouter>
        <FollowListSheet
          userId={42}
          mode="followers"
          open={true}
          onOpenChange={onOpenChange}
          {...props}
        />
      </MemoryRouter>
    </ToastProvider>
  );
  return { ...utils, onOpenChange };
}

describe("FollowListSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads followers on open and renders them", async () => {
    getFollowers.mockResolvedValue({
      results: [
        { id: 1, username: "alice" },
        { id: 2, username: "bob" },
      ],
      next: null,
    });
    renderSheet();

    await waitFor(() => expect(getFollowers).toHaveBeenCalledWith(42, { page: 1 }));
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /alice/i })).toHaveAttribute(
      "href",
      "/profile/1"
    );
  });

  it("appends the second page when 'Load more' is clicked", async () => {
    getFollowers
      .mockResolvedValueOnce({
        results: [{ id: 1, username: "alice" }],
        next: "page=2",
      })
      .mockResolvedValueOnce({
        results: [{ id: 2, username: "bob" }],
        next: null,
      });
    const user = userEvent.setup();
    renderSheet();

    await screen.findByText("alice");
    const loadMore = screen.getByRole("button", { name: /load more followers/i });
    await user.click(loadMore);

    await waitFor(() =>
      expect(getFollowers).toHaveBeenLastCalledWith(42, { page: 2 })
    );
    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("shows an ErrorState with retry when the initial load fails", async () => {
    getFollowers.mockRejectedValue(new Error("Network down"));
    renderSheet();

    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows an EmptyState when there are no followers", async () => {
    getFollowers.mockResolvedValue({ results: [], next: null });
    renderSheet();

    expect(await screen.findByText(/no followers yet/i)).toBeInTheDocument();
  });

  it("closes the sheet when a user link is clicked", async () => {
    getFollowers.mockResolvedValue({
      results: [{ id: 7, username: "charlie" }],
      next: null,
    });
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    const link = await screen.findByRole("link", { name: /charlie/i });
    await user.click(link);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses the following endpoint in following mode and renders its empty copy", async () => {
    getFollowing.mockResolvedValue({ results: [], next: null });
    renderSheet({ mode: "following" });

    await waitFor(() => expect(getFollowing).toHaveBeenCalledWith(42, { page: 1 }));
    expect(await screen.findByText(/not following anyone yet/i)).toBeInTheDocument();
  });

  it("treats malformed payloads as an empty list", async () => {
    getFollowers.mockResolvedValue("not-an-array");
    renderSheet();

    expect(await screen.findByText(/no followers yet/i)).toBeInTheDocument();
  });
});
