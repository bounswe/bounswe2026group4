import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, MapPin, AlertCircle, Check, X } from "lucide-react";

import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui";
import { resetPassword } from "@/services/authService";
import { useToast } from "@/hooks/useToast";

const PASSWORD_RULES = [
  { id: "length",    label: "At least 8 characters",     test: (p) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "number",    label: "One number (0–9)",           test: (p) => /[0-9]/.test(p) },
];

function validatePasswordStrength(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return "";
}

function isInvalidTokenError(error) {
  if (!error.response) return false;
  const data = error.response.data || {};
  const tokenErr = data.errors?.token;
  const detail = (data.detail || data.message || "").toString().toLowerCase();
  if (tokenErr) return true;
  if (error.response.status === 410) return true;
  return detail.includes("token") && (detail.includes("invalid") || detail.includes("expired"));
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: "", confirmPassword: "" });
  const [apiError, setApiError] = useState("");
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-2xl font-bold">Invalid reset link</CardTitle>
            </div>
            <CardDescription>
              This password reset link is missing a token.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Request a new reset link
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  function validate() {
    const errors = { password: "", confirmPassword: "" };
    let valid = true;
    if (!password) {
      errors.password = "Password is required.";
      valid = false;
    } else {
      const msg = validatePasswordStrength(password);
      if (msg) {
        errors.password = msg;
        valid = false;
      }
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
      valid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
      valid = false;
    }
    setFieldErrors(errors);
    return valid;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;
    setIsLoading(true);
    try {
      await resetPassword(token, password, confirmPassword);
      toast.success("Password reset successfully. Please log in with your new password.");
      navigate("/login", { replace: true });
    } catch (error) {
      if (isInvalidTokenError(error)) {
        setTokenInvalid(true);
      } else {
        const data = error.response?.data;
        const fieldErrs = data?.errors || {};
        const next = { password: "", confirmPassword: "" };
        if (fieldErrs.new_password) {
          next.password = Array.isArray(fieldErrs.new_password)
            ? fieldErrs.new_password[0]
            : fieldErrs.new_password;
        }
        if (fieldErrs.new_password_confirmation) {
          next.confirmPassword = Array.isArray(fieldErrs.new_password_confirmation)
            ? fieldErrs.new_password_confirmation[0]
            : fieldErrs.new_password_confirmation;
        }
        if (next.password || next.confirmPassword) {
          setFieldErrors(next);
        } else {
          setApiError(
            data?.message || data?.detail || "Could not reset password. Please try again."
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (tokenInvalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-2xl font-bold">Reset link expired</CardTitle>
            </div>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Request a new reset link
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">
              Local History Story Map
            </CardTitle>
          </div>
          <CardDescription>Choose a new password</CardDescription>
        </CardHeader>

        <CardContent>
          {apiError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  className="pl-9 pr-9"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby="password-error"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((p) => ({ ...p, password: "" }));
                    }
                  }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(password);
                  const showRed = !!fieldErrors.password && !passed;
                  return (
                    <li
                      key={rule.id}
                      className={`flex items-center gap-1.5 text-xs ${
                        showRed
                          ? "text-destructive"
                          : passed
                            ? "text-green-600 dark:text-green-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {passed
                        ? <Check className="h-3 w-3 shrink-0" />
                        : <X className="h-3 w-3 shrink-0" />}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  className="pl-9 pr-9"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={
                    fieldErrors.confirmPassword ? "confirmPassword-error" : undefined
                  }
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((p) => ({ ...p, confirmPassword: "" }));
                    }
                  }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={
                    showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="confirmPassword-error" className="text-sm text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
