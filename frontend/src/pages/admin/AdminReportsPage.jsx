import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmDialog from "@/components/AdminPanel/ConfirmDialog";
import Pagination from "@/components/AdminPanel/Pagination";
import { listReports, resolveReportWithAction } from "@/services/adminService";
import { getStoryById } from "@/services/storyService";

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];
const OUTCOMES = [
  { value: "no_action", label: "No action" },
  { value: "remove_content", label: "Remove content" },
  { value: "ban_user", label: "Ban user" },
];

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeReport, setActiveReport] = useState(null);
  const [outcome, setOutcome] = useState("no_action");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listReports({ status: statusFilter || undefined, page, pageSize: PAGE_SIZE });
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const openResolve = (report) => {
    setActiveReport(report);
    setOutcome("no_action");
    setNote("");
    setActionError(null);
  };

  const submitResolve = async () => {
    if (!activeReport) return;
    setSubmitting(true);
    setActionError(null);
    try {
      let targetUserId = null;
      if (outcome === "ban_user" && activeReport.target_type === "story") {
        // The list payload doesn't include the story author, so look it up.
        const story = await getStoryById(activeReport.target_id);
        targetUserId = story?.user?.id ?? story?.user_id ?? null;
        if (!targetUserId) {
          throw new Error("Could not resolve target user for ban.");
        }
      }
      await resolveReportWithAction({ report: activeReport, action: outcome, note, targetUserId });
      setActiveReport(null);
      await fetchReports();
    } catch (err) {
      setActionError(err?.response?.data?.detail || err.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Reports</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="report-status-filter" className="text-sm">Status:</Label>
          <select
            id="report-status-filter"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12" data-testid="reports-loading">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <ErrorState title="Could not load reports" message={error} onRetry={fetchReports} />
      ) : data.results.length === 0 ? (
        <EmptyState title="No reports" message="No reports match this filter." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Reporter</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.reporter?.username || "—"}</td>
                  <td className="px-3 py-2">{r.target_type} #{r.target_id}</td>
                  <td className="px-3 py-2">{r.reason}</td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "pending" ? (
                      <Button size="sm" onClick={() => openResolve(r)}>Resolve</Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{formatDate(r.resolved_at)}</span>
                    )}
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
        open={Boolean(activeReport)}
        onOpenChange={(open) => { if (!open && !submitting) setActiveReport(null); }}
        title="Resolve report"
        description={
          activeReport
            ? `Resolve report on ${activeReport.target_type} #${activeReport.target_id}.`
            : ""
        }
        confirmLabel="Resolve"
        confirming={submitting}
        destructive={outcome !== "no_action"}
        confirmDisabled={
          outcome === "ban_user" && activeReport?.target_type === "comment"
        }
        onConfirm={submitResolve}
      >
        <div className="space-y-3 text-left">
          <div className="space-y-1">
            <Label>Outcome</Label>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={o.value}
                    checked={outcome === o.value}
                    onChange={() => setOutcome(o.value)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="resolution-note">Note</Label>
            <Input
              id="resolution-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional resolution note"
            />
          </div>
          {outcome === "ban_user" && activeReport?.target_type === "comment" && (
            <p className="text-xs text-destructive">
              Banning via comment reports is not supported yet.
            </p>
          )}
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        </div>
      </ConfirmDialog>
    </section>
  );
}

export default AdminReportsPage;
