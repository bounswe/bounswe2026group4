import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmDialog from "@/components/AdminPanel/ConfirmDialog";
import Pagination from "@/components/AdminPanel/Pagination";
import { getStories } from "@/services/storyService";
import { removeStory } from "@/services/adminService";

const PAGE_SIZE = 12;

function AdminStoriesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStories({ q: query || undefined, page, pageSize: PAGE_SIZE });
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load stories.");
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const openRemove = (story) => {
    setTarget(story);
    setReason("");
    setActionError(null);
  };

  const submitRemove = async () => {
    if (!target) return;
    if (!reason.trim()) {
      setActionError("Reason is required.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await removeStory(target.id, reason.trim());
      setTarget(null);
      await fetchStories();
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Removal failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Stories</h2>
        <form onSubmit={submitSearch} className="flex gap-2" role="search">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title or location"
            aria-label="Search stories"
            className="w-64"
          />
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-12" data-testid="stories-loading">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <ErrorState title="Could not load stories" message={error} onRetry={fetchStories} />
      ) : data.results.length === 0 ? (
        <EmptyState title="No stories" message="No stories match this search." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Author</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link to={`/stories/${s.id}`} className="hover:underline">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.location_name || "—"}</td>
                  <td className="px-3 py-2">{s.user?.username || s.author?.username || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="destructive" size="sm" onClick={() => openRemove(s)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        count={data.count}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        disabled={loading}
      />

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => { if (!open && !submitting) setTarget(null); }}
        title="Remove story"
        description={target ? `This will remove "${target.title}". This action is logged.` : ""}
        confirmLabel="Remove"
        confirming={submitting}
        confirmDisabled={!reason.trim()}
        onConfirm={submitRemove}
      >
        <div className="space-y-2 text-left">
          <Label htmlFor="story-removal-reason">Reason (required)</Label>
          <Input
            id="story-removal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this story being removed?"
          />
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        </div>
      </ConfirmDialog>
    </section>
  );
}

export default AdminStoriesPage;
