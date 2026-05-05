import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import BookmarkButton from "../BookmarkButton";
import { ToastProvider } from "@/context/ToastContext";

vi.mock("@/hooks/useAuth");
vi.mock("@/services/bookmarkService", () => ({
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useAuth } from "@/hooks/useAuth";
import { addBookmark, removeBookmark } from "@/services/bookmarkService";

function renderButton(props = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <BookmarkButton storyId={1} initialBookmarked={false} {...props} />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("BookmarkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated user", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: false });
    });

    it("renders the bookmark button", () => {
      renderButton();
      expect(screen.getByRole("button", { name: /save story/i })).toBeInTheDocument();
    });

    it("navigates to login on click", async () => {
      const user = userEvent.setup();
      renderButton();
      await user.click(screen.getByRole("button", { name: /save story/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    it("does not call addBookmark when unauthenticated", async () => {
      const user = userEvent.setup();
      renderButton();
      await user.click(screen.getByRole("button", { name: /save story/i }));
      expect(addBookmark).not.toHaveBeenCalled();
    });
  });

  describe("authenticated user", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: true });
    });

    it("renders 'Save story' button when not bookmarked", () => {
      renderButton({ initialBookmarked: false });
      expect(screen.getByRole("button", { name: /save story/i })).toBeInTheDocument();
    });

    it("renders 'Remove bookmark' button when already bookmarked", () => {
      renderButton({ initialBookmarked: true });
      expect(screen.getByRole("button", { name: /remove bookmark/i })).toBeInTheDocument();
    });

    it("optimistically sets bookmarked and calls addBookmark", async () => {
      const user = userEvent.setup();
      addBookmark.mockResolvedValue({});
      renderButton({ initialBookmarked: false });

      await user.click(screen.getByRole("button", { name: /save story/i }));

      expect(screen.getByRole("button", { name: /remove bookmark/i })).toBeInTheDocument();
      await waitFor(() => expect(addBookmark).toHaveBeenCalledWith(1));
    });

    it("optimistically unsets bookmarked and calls removeBookmark", async () => {
      const user = userEvent.setup();
      removeBookmark.mockResolvedValue(undefined);
      renderButton({ initialBookmarked: true });

      await user.click(screen.getByRole("button", { name: /remove bookmark/i }));

      expect(screen.getByRole("button", { name: /save story/i })).toBeInTheDocument();
      await waitFor(() => expect(removeBookmark).toHaveBeenCalledWith(1));
    });

    it("reverts to unbookmarked on addBookmark failure", async () => {
      const user = userEvent.setup();
      addBookmark.mockRejectedValue(new Error("Network error"));
      renderButton({ initialBookmarked: false });

      await user.click(screen.getByRole("button", { name: /save story/i }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /save story/i })).toBeInTheDocument()
      );
    });

    it("reverts to bookmarked on removeBookmark failure", async () => {
      const user = userEvent.setup();
      removeBookmark.mockRejectedValue(new Error("Network error"));
      renderButton({ initialBookmarked: true });

      await user.click(screen.getByRole("button", { name: /remove bookmark/i }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /remove bookmark/i })).toBeInTheDocument()
      );
    });

    it("calls onToggle with new state after successful bookmark", async () => {
      const user = userEvent.setup();
      addBookmark.mockResolvedValue({});
      const onToggle = vi.fn();
      renderButton({ initialBookmarked: false, onToggle });

      await user.click(screen.getByRole("button", { name: /save story/i }));

      await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true));
    });

    it("calls onToggle with false after successful unbookmark", async () => {
      const user = userEvent.setup();
      removeBookmark.mockResolvedValue(undefined);
      const onToggle = vi.fn();
      renderButton({ initialBookmarked: true, onToggle });

      await user.click(screen.getByRole("button", { name: /remove bookmark/i }));

      await waitFor(() => expect(onToggle).toHaveBeenCalledWith(false));
    });

    it("does not call onToggle on API failure", async () => {
      const user = userEvent.setup();
      addBookmark.mockRejectedValue(new Error("fail"));
      const onToggle = vi.fn();
      renderButton({ initialBookmarked: false, onToggle });

      await user.click(screen.getByRole("button", { name: /save story/i }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /save story/i })).toBeInTheDocument()
      );
      expect(onToggle).not.toHaveBeenCalled();
    });
  });
});
