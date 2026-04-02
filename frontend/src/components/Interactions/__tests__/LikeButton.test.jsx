import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import LikeButton from "../LikeButton";
import { ToastProvider } from "@/context/ToastContext";

vi.mock("@/hooks/useAuth");
vi.mock("@/services/interactionService", () => ({
  likeStory: vi.fn(),
  unlikeStory: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { likeStory, unlikeStory } from "@/services/interactionService";

function renderLikeButton(props = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <LikeButton storyId={1} initialLiked={false} initialCount={3} {...props} />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("LikeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated user", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: false });
    });

    it("displays the like count", () => {
      renderLikeButton({ initialCount: 5 });
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("shows a login prompt instead of a toggle button", () => {
      renderLikeButton();
      expect(screen.getByRole("link", { name: /log in to like/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /like story/i })).not.toBeInTheDocument();
    });

    it("login prompt links to /login", () => {
      renderLikeButton();
      expect(screen.getByRole("link", { name: /log in to like/i })).toHaveAttribute("href", "/login");
    });
  });

  describe("authenticated user", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: true });
    });

    it("renders a like button with the current count", () => {
      renderLikeButton({ initialCount: 3 });
      expect(screen.getByRole("button", { name: /like story/i })).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("shows 'Unlike story' label when already liked", () => {
      renderLikeButton({ initialLiked: true });
      expect(screen.getByRole("button", { name: /unlike story/i })).toBeInTheDocument();
    });

    it("optimistically increments count and calls likeStory on click", async () => {
      const user = userEvent.setup();
      likeStory.mockResolvedValue({});
      renderLikeButton({ initialLiked: false, initialCount: 3 });

      await user.click(screen.getByRole("button", { name: /like story/i }));

      // Optimistic update happens immediately
      expect(screen.getByText("4")).toBeInTheDocument();
      await waitFor(() => expect(likeStory).toHaveBeenCalledWith(1));
    });

    it("optimistically decrements count and calls unlikeStory when unliking", async () => {
      const user = userEvent.setup();
      unlikeStory.mockResolvedValue(undefined);
      renderLikeButton({ initialLiked: true, initialCount: 4 });

      await user.click(screen.getByRole("button", { name: /unlike story/i }));

      expect(screen.getByText("3")).toBeInTheDocument();
      await waitFor(() => expect(unlikeStory).toHaveBeenCalledWith(1));
    });

    it("reverts like on API error", async () => {
      const user = userEvent.setup();
      likeStory.mockRejectedValue(new Error("Network error"));
      renderLikeButton({ initialLiked: false, initialCount: 3 });

      await user.click(screen.getByRole("button", { name: /like story/i }));

      // After the rejected promise resolves, the state should revert
      await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /like story/i })).toBeInTheDocument();
    });

    it("reverts unlike on API error", async () => {
      const user = userEvent.setup();
      unlikeStory.mockRejectedValue(new Error("Network error"));
      renderLikeButton({ initialLiked: true, initialCount: 4 });

      await user.click(screen.getByRole("button", { name: /unlike story/i }));

      await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /unlike story/i })).toBeInTheDocument();
    });
  });
});
