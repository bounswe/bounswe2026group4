import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  getComments,
  addComment,
  deleteComment,
} from "@/services/interactionService";

function formatCommentDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CommentSection({ storyId, onCountChange, onUserCommentedChange }) {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const username = user?.username ?? null;

  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  useEffect(() => {
    const hasCommented =
      username != null && comments.some((c) => c.author_username === username);
    onUserCommentedChange?.(hasCommented);
  }, [comments, username, onUserCommentedChange]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getComments(storyId);
      setComments(data);
    } catch {
      setError("Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const newComment = await addComment(storyId, text.trim());
      // Append so that after reversal the new comment appears at the top
      setComments((prev) => [...prev, newComment]);
      setText("");
    } catch (err) {
      setSubmitError(
        err?.response?.data?.text?.[0] ||
          err?.response?.data?.detail ||
          "Failed to post comment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete(commentId) {
    setDeleteError(null);
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setConfirmDeleteId(null);
    } catch {
      setDeleteError("Failed to delete comment. Please try again.");
      setConfirmDeleteId(null);
    }
  }

  // Backend returns oldest-first; display most recent first
  const displayed = [...comments].reverse();

  return (
    <section aria-label="Comments" className="mt-10 border-t pt-8">
      <h2 className="text-lg font-semibold mb-6">
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {/* Comment form or login prompt */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} aria-label="Add comment" className="mb-8">
          <label htmlFor="comment-input" className="sr-only">
            Your comment
          </label>
          <textarea
            id="comment-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSubmitError(null);
            }}
            placeholder="Write a comment…"
            rows={3}
            disabled={submitting}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          {submitError && (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {submitError}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !text.trim()}
            >
              {submitting && (
                <Loader2
                  className="h-4 w-4 animate-spin mr-1"
                  aria-hidden="true"
                />
              )}
              {submitting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>{" "}
          to leave a comment.
        </p>
      )}

      {deleteError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {deleteError}
        </p>
      )}

      {/* Comment list */}
      {loading ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-label="Loading comments"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading comments…
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first!
        </p>
      ) : (
        <ul aria-label="Comment list" className="space-y-6">
          {displayed.map((comment) => {
            const isOwn =
              isAuthenticated && user?.username === comment.author_username;
            const awaitingConfirm = confirmDeleteId === comment.id;

            return (
              <li key={comment.id}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {comment.author_username ?? "Anonymous"}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatCommentDate(comment.created_at)}
                    </span>
                    {isOwn && !awaitingConfirm && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setConfirmDeleteId(comment.id)}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-1 text-sm text-foreground/80 whitespace-pre-line">
                  {comment.text}
                </p>

                {awaitingConfirm && (
                  <div
                    className="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    role="group"
                    aria-label="Confirm delete"
                  >
                    <span className="text-xs text-destructive font-medium flex-1">
                      Delete this comment?
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-3 text-xs"
                      onClick={() => handleConfirmDelete(comment.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default CommentSection;
