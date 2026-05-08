import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/services/userService";
import { clear as clearTokens } from "@/services/tokenStore";
import { useToast } from "@/hooks/useToast";

// Body lives in a separate component so its state resets on every open/close
// cycle: Radix unmounts AlertDialogContent on close, remounting this fresh.
function DeleteAccountForm({ onOpenChange }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [deleteStories, setDeleteStories] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm(e) {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password to confirm.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteAccount(password, deleteStories);
      // tokenStore.clear() dispatches an "auth:logout" event that the
      // AuthContext listens for to drop the in-memory user.
      clearTokens();
      onOpenChange(false);
      toast.success("Your account has been deleted.");
      navigate("/");
    } catch (err) {
      const data = err?.response?.data;
      const message =
        (Array.isArray(data?.password) && data.password[0]) ||
        data?.detail ||
        err?.message ||
        "Failed to delete account. Please try again.";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleConfirm} noValidate>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
        <AlertDialogDescription>
          Your account will be permanently deleted. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          By default, your stories will remain on the platform but your name
          will be replaced with <span className="font-medium">Anonymous</span>.
        </p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={deleteStories}
            onChange={(e) => setDeleteStories(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 rounded border-input"
            data-testid="delete-stories-checkbox"
          />
          <span>
            Also delete all my stories.
            <span className="block text-xs text-muted-foreground">
              Story content, comments, and uploads will be permanently removed.
              This is irreversible.
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="delete-account-password">
            Confirm with your password
          </Label>
          <Input
            id="delete-account-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel disabled={submitting} type="button">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          type="submit"
          variant="destructive"
          disabled={submitting || !password}
          onClick={handleConfirm}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {submitting ? "Deleting…" : "Delete my account"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </form>
  );
}

function DeleteAccountDialog({ open, onOpenChange }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {open && <DeleteAccountForm onOpenChange={onOpenChange} />}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteAccountDialog;
