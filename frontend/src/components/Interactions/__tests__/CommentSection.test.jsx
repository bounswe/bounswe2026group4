import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import CommentSection from "../CommentSection";

vi.mock("@/hooks/useAuth");
vi.mock("@/services/interactionService", () => ({
  getComments: vi.fn(),
  addComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { getComments, addComment, deleteComment } from "@/services/interactionService";

function makeComment(overrides = {}) {
  return {
    id: 1,
    story_id: 42,
    author_username: "alice",
    text: "Great story!",
    is_anonymized: false,
    created_at: "2025-06-10T10:00:00Z",
    ...overrides,
  };
}

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <CommentSection storyId={42} {...props} />
    </MemoryRouter>
  );
}

describe("CommentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading and error states", () => {
    it("shows loading indicator while fetching", () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockReturnValue(new Promise(() => {}));
      renderSection();

      expect(screen.getByLabelText("Loading comments")).toBeInTheDocument();
    });

    it("shows error message when fetch fails", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockRejectedValue(new Error("Network error"));
      renderSection();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/failed to load comments/i);
      });
    });
  });

  describe("comment list rendering", () => {
    it("shows empty state when no comments", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockResolvedValue([]);
      renderSection();

      await waitFor(() => {
        expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
      });
    });

    it("renders a list of comments with author and text", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: "alice", text: "First comment" }),
        makeComment({ id: 2, author_username: "bob", text: "Second comment" }),
      ]);
      renderSection();

      await waitFor(() => {
        expect(screen.getByText("First comment")).toBeInTheDocument();
        expect(screen.getByText("Second comment")).toBeInTheDocument();
        expect(screen.getByText("alice")).toBeInTheDocument();
        expect(screen.getByText("bob")).toBeInTheDocument();
      });
    });

    it("displays comments in reverse chronological order (most recent first)", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      // Backend returns oldest-first
      getComments.mockResolvedValue([
        makeComment({ id: 1, text: "Oldest", created_at: "2025-01-01T00:00:00Z" }),
        makeComment({ id: 2, text: "Newest", created_at: "2025-06-01T00:00:00Z" }),
      ]);
      renderSection();

      await waitFor(() => {
        const items = screen.getAllByRole("listitem");
        expect(within(items[0]).getByText("Newest")).toBeInTheDocument();
        expect(within(items[1]).getByText("Oldest")).toBeInTheDocument();
      });
    });

    it("shows the comment count in the heading", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockResolvedValue([
        makeComment({ id: 1 }),
        makeComment({ id: 2 }),
      ]);
      renderSection();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /comments \(2\)/i })).toBeInTheDocument();
      });
    });

    it("renders 'Anonymous' for comments without an author username", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: null }),
      ]);
      renderSection();

      await waitFor(() => {
        expect(screen.getByText("Anonymous")).toBeInTheDocument();
      });
    });
  });

  describe("unauthenticated user", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockResolvedValue([]);
    });

    it("shows a login prompt instead of the comment form", async () => {
      renderSection();

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
    });

    it("login prompt links to /login", async () => {
      renderSection();

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
      });
    });
  });

  describe("authenticated user", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
    });

    it("shows the comment input form", async () => {
      getComments.mockResolvedValue([]);
      renderSection();

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /post comment/i })).toBeInTheDocument();
      });
    });

    it("submits a new comment and shows it at the top", async () => {
      const user = userEvent.setup();
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: "bob", text: "Older comment" }),
      ]);
      addComment.mockResolvedValue(
        makeComment({ id: 99, author_username: "alice", text: "My new comment" })
      );
      renderSection();

      await waitFor(() => screen.getByRole("textbox"));

      await user.type(screen.getByRole("textbox"), "My new comment");
      await user.click(screen.getByRole("button", { name: /post comment/i }));

      await waitFor(() => {
        expect(addComment).toHaveBeenCalledWith(42, "My new comment");
        const items = screen.getAllByRole("listitem");
        expect(within(items[0]).getByText("My new comment")).toBeInTheDocument();
      });
    });

    it("disables submit button and shows loading state during submission", async () => {
      const user = userEvent.setup();
      getComments.mockResolvedValue([]);
      addComment.mockReturnValue(new Promise(() => {}));
      renderSection();

      await waitFor(() => screen.getByRole("textbox"));

      await user.type(screen.getByRole("textbox"), "Hello");
      await user.click(screen.getByRole("button", { name: /post comment/i }));

      expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();
    });

    it("clears the input after successful submission", async () => {
      const user = userEvent.setup();
      getComments.mockResolvedValue([]);
      addComment.mockResolvedValue(makeComment({ id: 10, text: "Done" }));
      renderSection();

      await waitFor(() => screen.getByRole("textbox"));

      await user.type(screen.getByRole("textbox"), "Hello");
      await user.click(screen.getByRole("button", { name: /post comment/i }));

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toHaveValue("");
      });
    });

    it("shows an error message when comment submission fails", async () => {
      const user = userEvent.setup();
      getComments.mockResolvedValue([]);
      addComment.mockRejectedValue({ response: { data: { detail: "Submission failed" } } });
      renderSection();

      await waitFor(() => screen.getByRole("textbox"));

      await user.type(screen.getByRole("textbox"), "Hello");
      await user.click(screen.getByRole("button", { name: /post comment/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Submission failed");
      });
    });

    it("disables submit when text is empty", async () => {
      getComments.mockResolvedValue([]);
      renderSection();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /post comment/i })).toBeDisabled();
      });
    });

    it("shows delete button only on own comments", async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: "alice", text: "My comment" }),
        makeComment({ id: 2, author_username: "bob", text: "Their comment" }),
      ]);
      renderSection();

      await waitFor(() => {
        const items = screen.getAllByRole("listitem");
        // Most recent first: bob's is index 0, alice's is index 1
        // The list is reversed, so newest created_at is first.
        // Both have same created_at in makeComment, so order is by array reversal.
        // After reversal: [bob(id=2), alice(id=1)]
        expect(within(items[0]).queryByRole("button", { name: /delete comment/i })).not.toBeInTheDocument();
        expect(within(items[1]).getByRole("button", { name: /delete comment/i })).toBeInTheDocument();
      });
    });

    it("clicking delete shows inline confirmation with Delete and Cancel buttons", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 5, author_username: "alice", text: "My comment" }),
      ]);
      renderSection();

      await waitFor(() => screen.getByRole("button", { name: /delete comment/i }));

      await user.click(screen.getByRole("button", { name: /delete comment/i }));

      expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("hides the trash icon while inline confirmation is open", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 5, author_username: "alice", text: "My comment" }),
      ]);
      renderSection();

      await waitFor(() => screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /delete comment/i }));

      expect(screen.queryByRole("button", { name: /delete comment/i })).not.toBeInTheDocument();
    });

    it("deletes own comment after inline confirmation", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 5, author_username: "alice", text: "My comment" }),
      ]);
      deleteComment.mockResolvedValue(undefined);
      renderSection();

      await waitFor(() => screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(deleteComment).toHaveBeenCalledWith(5);
        expect(screen.queryByText("My comment")).not.toBeInTheDocument();
      });
    });

    it("cancelling inline confirmation keeps the comment and restores the trash icon", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 5, author_username: "alice", text: "My comment" }),
      ]);
      renderSection();

      await waitFor(() => screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(deleteComment).not.toHaveBeenCalled();
      expect(screen.getByText("My comment")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete comment/i })).toBeInTheDocument();
    });

    it("shows an error message when delete fails", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 5, author_username: "alice", text: "My comment" }),
      ]);
      deleteComment.mockRejectedValue(new Error("Server error"));
      renderSection();

      await waitFor(() => screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/failed to delete comment/i);
      });
      expect(screen.getByText("My comment")).toBeInTheDocument();
    });
  });

  describe("onUserCommentedChange callback", () => {
    it("calls onUserCommentedChange(false) when the current user has no comments", async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: "bob", text: "Not mine" }),
      ]);
      const onUserCommentedChange = vi.fn();
      render(
        <MemoryRouter>
          <CommentSection storyId={42} onUserCommentedChange={onUserCommentedChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(onUserCommentedChange).toHaveBeenCalledWith(false);
      });
    });

    it("calls onUserCommentedChange(true) when the current user has a comment", async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: "alice", text: "My comment" }),
      ]);
      const onUserCommentedChange = vi.fn();
      render(
        <MemoryRouter>
          <CommentSection storyId={42} onUserCommentedChange={onUserCommentedChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(onUserCommentedChange).toHaveBeenCalledWith(true);
      });
    });

    it("calls onUserCommentedChange(false) when user is unauthenticated", async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, user: null });
      getComments.mockResolvedValue([
        makeComment({ id: 1, author_username: "alice", text: "Some comment" }),
      ]);
      const onUserCommentedChange = vi.fn();
      render(
        <MemoryRouter>
          <CommentSection storyId={42} onUserCommentedChange={onUserCommentedChange} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(onUserCommentedChange).toHaveBeenCalledWith(false);
      });
    });

    it("calls onUserCommentedChange(true) after the user posts a new comment", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
      getComments.mockResolvedValue([]);
      addComment.mockResolvedValue(
        makeComment({ id: 10, author_username: "alice", text: "Fresh comment" })
      );
      const onUserCommentedChange = vi.fn();
      render(
        <MemoryRouter>
          <CommentSection storyId={42} onUserCommentedChange={onUserCommentedChange} />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByRole("textbox"));

      await user.type(screen.getByRole("textbox"), "Fresh comment");
      await user.click(screen.getByRole("button", { name: /post comment/i }));

      await waitFor(() => {
        expect(onUserCommentedChange).toHaveBeenCalledWith(true);
      });
    });
  });
});
