import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
      // Aligned with mobile: account deletion always hard-deletes the user's
      // stories, comments, and uploads — no opt-in checkbox.
      await deleteAccount(password, true);
      // tokenStore.clear() dispatches an "auth:logout" event that the
      // AuthContext listens for to drop the in-memory user.
      clearTokens();
      onOpenChange(false);
      toast.success("Account deleted successfully.");
      navigate("/");
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const passwordFieldError =
        Array.isArray(data?.password) && data.password.length > 0
          ? data.password[0]
          : null;
      const message =
        passwordFieldError
          ?? data?.detail
          ?? (status === 400 ? "Wrong password, please try again." : null)
          ?? err?.message
          ?? "Failed to delete account. Please try again.";
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
          Your stories, comments, and likes will also be permanently deleted.
        </p>

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
            aria-describedby={error ? "delete-account-error" : undefined}
            aria-invalid={error ? true : undefined}
          />
        </div>

        {error && (
          <p
            id="delete-account-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel disabled={submitting} type="button">
          Cancel
        </AlertDialogCancel>
        {/*
         * NOTE: This is a plain <Button>, not an <AlertDialogAction>.
         * Radix's AlertDialogAction wraps Dialog.Close, which calls
         * onOpenChange(false) on click — that would unmount the form
         * before our async API call resolves, hiding the loading state
         * and any inline error. We close the dialog ourselves only after
         * a successful deletion (in handleConfirm).
         */}
        <Button
          type="submit"
          variant="destructive"
          disabled={submitting || !password}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {submitting ? "Deleting…" : "Delete my account"}
        </Button>
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
