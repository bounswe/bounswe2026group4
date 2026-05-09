import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmDialog from "@/components/AdminPanel/ConfirmDialog";
import Pagination from "@/components/AdminPanel/Pagination";
import { searchTags } from "@/services/tagService";
import { deleteTag } from "@/services/adminService";

const PAGE_SIZE = 20;

function AdminTagsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await searchTags(query || undefined);
      setTags(all);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load tags.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const openRemove = (tag) => {
    setTarget(tag);
    setActionError(null);
  };

  const submitRemove = async () => {
    if (!target) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await deleteTag(target.id);
      setTarget(null);
      await fetchTags();
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Tag removal failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const start = (page - 1) * PAGE_SIZE;
  const visibleTags = tags.slice(start, start + PAGE_SIZE);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Tags</h2>
        <form onSubmit={submitSearch} className="flex gap-2" role="search">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tag name"
            aria-label="Search tags"
            className="w-64"
          />
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-12" data-testid="tags-loading">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <ErrorState title="Could not load tags" message={error} onRetry={fetchTags} />
      ) : visibleTags.length === 0 ? (
        <EmptyState title="No tags" message="No tags match this search." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Predefined</th>
                <th className="px-3 py-2 text-left">Stories</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleTags.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2">{t.is_predefined ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{t.story_count ?? 0}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="destructive" size="sm" onClick={() => openRemove(t)}>
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
        count={tags.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        disabled={loading}
      />

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title="Remove tag"
        description={
          target ? `Remove the tag "${target.name}"? It will be detached from ${target.story_count ?? 0} stories.` : ""
        }
        confirmLabel="Remove"
        confirming={submitting}
        onConfirm={submitRemove}
      >
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      </ConfirmDialog>
    </section>
  );
}

export default AdminTagsPage;
