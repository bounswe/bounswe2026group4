import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link, Navigate } from "react-router-dom";
import { Mail, Loader2, MapPin } from "lucide-react";

import {
  Button,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui";
import { verifyEmail, resendVerificationCode } from "@/services/authService";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const EMPTY_DIGITS = Array(CODE_LENGTH).fill("");

function extractApiError(error, fallback) {
  const data = error.response?.data;
  if (!data) return fallback;
  const fieldErrors = data.errors || {};
  const codeError = fieldErrors.code;
  if (codeError) return Array.isArray(codeError) ? codeError[0] : codeError;
  const emailError = fieldErrors.email;
  if (emailError) return Array.isArray(emailError) ? emailError[0] : emailError;
  const nonField = fieldErrors.non_field_errors;
  if (nonField) return Array.isArray(nonField) ? nonField[0] : nonField;
  return data.message || data.detail || fallback;
}

function isExpiredCodeError(error) {
  const message = extractApiError(error, "");
  if (!message) return false;
  const lower = String(message).toLowerCase();
  return lower.includes("expired") || error.response?.status === 410;
}

function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const email = location.state?.email || "";
  const fromAfterLogin = location.state?.from || null;

  const [digits, setDigits] = useState(EMPTY_DIGITS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showResendOnError, setShowResendOnError] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  const code = digits.join("");
  const isCodeComplete = code.length === CODE_LENGTH && digits.every((d) => /^\d$/.test(d));

  function setDigitAt(index, value) {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleDigitChange(index, raw) {
    const value = raw.replace(/\D/g, "");
    if (apiError) {
      setApiError("");
      setShowResendOnError(false);
    }
    if (value.length === 0) {
      setDigitAt(index, "");
      return;
    }
    if (value.length === 1) {
      setDigitAt(index, value);
      if (index < CODE_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      return;
    }
    // Pasted multiple digits — distribute starting at this index
    setDigits((prev) => {
      const next = [...prev];
      const chars = value.slice(0, CODE_LENGTH - index).split("");
      for (let i = 0; i < chars.length; i += 1) {
        next[index + i] = chars[i];
      }
      return next;
    });
    const nextFocus = Math.min(index + value.length, CODE_LENGTH - 1);
    inputsRef.current[nextFocus]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        setDigitAt(index, "");
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        setDigitAt(index - 1, "");
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
      e.preventDefault();
    }
  }

  function handlePaste(index, e) {
    const text = e.clipboardData.getData("text") || "";
    const digitsOnly = text.replace(/\D/g, "").slice(0, CODE_LENGTH - index);
    if (!digitsOnly) return;
    e.preventDefault();
    handleDigitChange(index, digitsOnly);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isCodeComplete || isSubmitting) return;
    setApiError("");
    setShowResendOnError(false);
    setIsSubmitting(true);
    try {
      await verifyEmail(email, code);
      toast.success("Account verified! You can now log in.");
      navigate("/login", { state: { from: fromAfterLogin }, replace: true });
    } catch (error) {
      if (error.response?.status === 429) {
        setApiError("Too many attempts. Please wait a moment and try again.");
      } else if (isExpiredCodeError(error)) {
        setApiError("Code has expired. Click resend to get a new code.");
        setShowResendOnError(true);
      } else {
        setApiError(extractApiError(error, "Invalid verification code. Please try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || isResending) return;
    setApiError("");
    setShowResendOnError(false);
    setIsResending(true);
    try {
      await resendVerificationCode(email);
      toast.success("A new code has been sent to your email.");
      setDigits(EMPTY_DIGITS);
      inputsRef.current[0]?.focus();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (error.response?.status === 429) {
        setApiError("Too many requests. Please wait before requesting another code.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setApiError(extractApiError(error, "Could not resend code. Please try again."));
      }
    } finally {
      setIsResending(false);
    }
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
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <CardDescription className="text-sm">
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {apiError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <p>{apiError}</p>
              {showResendOnError && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isResending}
                  className="mt-2 font-medium underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {isResending ? "Resending..." : "Resend code"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="code-0" className="block text-center">Verification code</Label>
              <div
                className="flex justify-center gap-2"
                role="group"
                aria-label="Enter 6-digit verification code"
              >
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    id={`code-${i}`}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH}
                    aria-label={`Digit ${i + 1}`}
                    aria-invalid={!!apiError}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={(e) => handlePaste(i, e)}
                    disabled={isSubmitting}
                    className={cn(
                      "h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      apiError && "border-destructive"
                    )}
                  />
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isCodeComplete || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Didn&apos;t receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className="font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
            >
              {isResending
                ? "Resending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend"}
            </button>
          </div>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Wrong email?{" "}
            <Link
              to="/register"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Register again
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default VerifyEmailPage;
