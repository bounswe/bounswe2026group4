import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ConfirmDialog from "@/components/AdminPanel/ConfirmDialog";
import { getPublicProfile } from "@/services/userService";
import { banUser } from "@/services/adminService";

/**
 * No backend endpoint lists users for admins, so this page works as a
 * single-result lookup by user ID. Once the backend exposes a paginated
 * search/list endpoint we can switch to a true paginated table.
 */
function AdminUsersPage() {
  const [idInput, setIdInput] = useState("");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const lookup = async (e) => {
    e.preventDefault();
    const id = Number(idInput);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Enter a positive numeric user ID.");
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const data = await getPublicProfile(id);
      setProfile({ ...data, _lookupId: id });
    } catch (err) {
      setError(err?.response?.status === 404 ? "User not found." : "Failed to load user.");
    } finally {
      setLoading(false);
    }
  };

  const submitBan = async () => {
    if (!profile) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await banUser(profile.id ?? profile._lookupId);
      setProfile((prev) => (prev ? { ...prev, is_active: res.is_active } : prev));
      setConfirming(false);
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Ban failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isBanned = profile && profile.is_active === false;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up a user by ID and ban their account.
        </p>
      </div>

      <form onSubmit={lookup} className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex flex-col gap-1">
          <Label htmlFor="user-id-input">User ID</Label>
          <Input
            id="user-id-input"
            type="number"
            min="1"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="e.g. 42"
            className="w-40"
          />
        </div>
        <Button type="submit" variant="outline">Look up</Button>
      </form>

      <div className="mt-6">
        {loading && (
          <div className="flex justify-center py-8" data-testid="users-loading">
            <LoadingSpinner />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {profile && !loading && (
          <div className="rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">{profile.username || "Unknown"}</div>
                <div className="text-sm text-muted-foreground">
                  ID #{profile.id ?? profile._lookupId}
                </div>
                <div className="mt-1 text-sm">
                  Status: {isBanned ? (
                    <span className="font-medium text-destructive">Banned</span>
                  ) : (
                    <span className="font-medium text-green-600">Active</span>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                disabled={isBanned}
                onClick={() => { setActionError(null); setConfirming(true); }}
              >
                {isBanned ? "Already banned" : "Ban user"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Ban user"
        description={
          profile
            ? `Ban ${profile.username || `user #${profile.id ?? profile._lookupId}`}? This disables their account.`
            : ""
        }
        confirmLabel="Ban"
        confirming={submitting}
        onConfirm={submitBan}
      >
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      </ConfirmDialog>
    </section>
  );
}

export default AdminUsersPage;
