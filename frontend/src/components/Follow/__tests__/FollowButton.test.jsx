import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import FollowButton from "../FollowButton";
import { ToastProvider } from "@/context/ToastContext";

vi.mock("@/hooks/useAuth");
vi.mock("@/services/followService", () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { followUser, unfollowUser } from "@/services/followService";

function renderButton(props = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <FollowButton targetUserId={42} {...props} />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("FollowButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated visitor", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: false });
    });

    it("renders a login link instead of a toggle button", () => {
      renderButton();
      const link = screen.getByRole("link", { name: /log in to follow/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/login");
      expect(
        screen.queryByRole("button", { name: /^follow user$/i })
      ).not.toBeInTheDocument();
    });

    it("does not call follow APIs", async () => {
      const user = userEvent.setup();
      renderButton();
      await user.click(screen.getByRole("link", { name: /log in to follow/i }));
      expect(followUser).not.toHaveBeenCalled();
      expect(unfollowUser).not.toHaveBeenCalled();
    });
  });

  describe("authenticated user, not yet following", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: true });
    });

    it("renders 'Follow' label", () => {
      renderButton({ initialFollowing: false });
      expect(
        screen.getByRole("button", { name: /follow user/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Follow")).toBeInTheDocument();
    });

    it("optimistically switches to 'Following' on click and calls followUser", async () => {
      const user = userEvent.setup();
      followUser.mockResolvedValue({});
      renderButton({ initialFollowing: false });

      await user.click(screen.getByRole("button", { name: /follow user/i }));

      expect(screen.getByText("Following")).toBeInTheDocument();
      await waitFor(() => expect(followUser).toHaveBeenCalledWith(42));
    });

    it("invokes onChange with the new following state", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      followUser.mockResolvedValue({});
      renderButton({ initialFollowing: false, onChange });

      await user.click(screen.getByRole("button", { name: /follow user/i }));

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("reverts to 'Follow' and calls onChange(false) when followUser rejects", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      followUser.mockRejectedValue(new Error("Network error"));
      renderButton({ initialFollowing: false, onChange });

      await user.click(screen.getByRole("button", { name: /follow user/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /follow user/i })
        ).toBeInTheDocument()
      );
      expect(onChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe("authenticated user, already following", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: true });
    });

    it("renders 'Following' label", () => {
      renderButton({ initialFollowing: true });
      expect(
        screen.getByRole("button", { name: /unfollow user/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Following")).toBeInTheDocument();
    });

    it("optimistically switches to 'Follow' on click and calls unfollowUser", async () => {
      const user = userEvent.setup();
      unfollowUser.mockResolvedValue(undefined);
      renderButton({ initialFollowing: true });

      await user.click(screen.getByRole("button", { name: /unfollow user/i }));

      expect(screen.getByText("Follow")).toBeInTheDocument();
      await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith(42));
    });

    it("reverts to 'Following' when unfollowUser rejects", async () => {
      const user = userEvent.setup();
      unfollowUser.mockRejectedValue(new Error("Network error"));
      renderButton({ initialFollowing: true });

      await user.click(screen.getByRole("button", { name: /unfollow user/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /unfollow user/i })
        ).toBeInTheDocument()
      );
    });
  });
});
