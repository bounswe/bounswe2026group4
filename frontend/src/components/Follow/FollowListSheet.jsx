import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/useToast";
import { getFollowers, getFollowing } from "@/services/followService";

function FollowListSheet({ userId, mode, open, onOpenChange }) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isFollowers = mode === "followers";
  const title = isFollowers ? "Followers" : "Following";
  const description = isFollowers
    ? "People who follow this user."
    : "People this user follows.";

  const fetchPage = useCallback(
    async (pageNumber, { append }) => {
      setLoading(true);
      setError(null);
      try {
        const fetcher = isFollowers ? getFollowers : getFollowing;
        const data = await fetcher(userId, { page: pageNumber });
        const results = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        setUsers((prev) => (append ? [...prev, ...results] : results));
        setHasMore(Boolean(data?.next));
        setPage(pageNumber);
      } catch (err) {
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load list. Please try again.";
        setError(message);
        if (append) {
          toastRef.current.error(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [isFollowers, userId]
  );

  useEffect(() => {
    if (!open || !userId) return;
    setUsers([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, { append: false });
  }, [open, userId, mode, fetchPage]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-4 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {loading && users.length === 0 && (
          <div className="py-8">
            <LoadingSpinner message={`Loading ${title.toLowerCase()}`} />
          </div>
        )}

        {error && users.length === 0 && (
          <ErrorState
            message={error}
            onRetry={() => fetchPage(1, { append: false })}
          />
        )}

        {!loading && !error && users.length === 0 && (
          <EmptyState
            icon={User}
            title={isFollowers ? "No followers yet" : "Not following anyone yet"}
            message={
              isFollowers
                ? "When someone follows this user, they will appear here."
                : "Users this account follows will appear here."
            }
          />
        )}

        {users.length > 0 && (
          <ul className="flex flex-col divide-y">
            {users.map((u) => (
              <li key={u.id} className="py-3">
                <Link
                  to={`/profile/${u.id}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-muted"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <User
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {u.username}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center pb-4">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => fetchPage(page + 1, { append: true })}
              aria-label={`Load more ${title.toLowerCase()}`}
            >
              {loading ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default FollowListSheet;
