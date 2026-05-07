import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { reportContent } from "@/services/reportService";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "false_content", label: "False or misleading content" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "privacy_violation", label: "Privacy violation" },
  { value: "explicit_media", label: "Explicit or inappropriate media" },
  { value: "other", label: "Other" },
];

function ReportModal({ isOpen, onClose, targetType, targetId }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  function handleClose() {
    if (submitting) return;
    onClose();
    // Defer reset so the closing animation isn't interrupted
    setTimeout(() => {
      setReason("");
      setDescription("");
      setSubmitting(false);
      setSubmitted(false);
      setError(null);
    }, 300);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);
    setError(null);
    try {
      await reportContent({
        targetType,
        targetId,
        reason,
        description: reason === "other" ? description : "",
      });
      setSubmitted(true);
    } catch (err) {
      const data = err?.response?.data;
      const errors = data?.errors || {};
      const pickFirst = (val) => (Array.isArray(val) ? val[0] : val);
      const fieldErr =
        pickFirst(errors.non_field_errors) ||
        pickFirst(errors.target_id) ||
        pickFirst(data?.non_field_errors) ||
        pickFirst(data?.target_id);
      setError(fieldErr || data?.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent aria-label="Report content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Report {targetType === "story" ? "story" : "comment"}
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-4 text-sm text-center text-foreground">
            <p role="status">Report submitted. Our team will review it.</p>
            <Button className="mt-4" variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <fieldset className="space-y-3" disabled={submitting}>
              <legend className="text-sm font-medium mb-2">
                Why are you reporting this {targetType === "story" ? "story" : "comment"}?
              </legend>
              {REASONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 cursor-pointer rounded-md px-3 py-2 hover:bg-muted has-[:checked]:bg-muted"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => {
                      setReason(value);
                      setError(null);
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </fieldset>

            {reason === "other" && (
              <div className="mt-4">
                <label htmlFor="report-description" className="text-sm font-medium block mb-1">
                  Additional details (optional)
                </label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  rows={3}
                  placeholder="Describe the issue…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!reason || submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />}
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReportModal;
