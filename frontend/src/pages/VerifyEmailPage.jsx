import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { Mail, Loader2, MapPin } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui";
import { verifyEmail, resendVerificationCode } from "@/services/authService";
import { useToast } from "@/hooks/useToast";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const email = location.state?.email;
  const from = location.state?.from;

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== "");

  function clearErrors() {
    if (error) setError("");
    if (isExpired) setIsExpired(false);
  }

  function focusInput(index) {
    const target = inputsRef.current[index];
    if (target) {
      target.focus();
      target.select?.();
    }
  }

  function handleDigitChange(index, value) {
    clearErrors();
    // Strip everything but digits; if the user pasted or typed multiple chars,
    // spread them across subsequent boxes.
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < cleaned.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = cleaned[i];
      }
      return next;
    });

    const nextIndex = Math.min(index + cleaned.length, CODE_LENGTH - 1);
    focusInput(nextIndex);
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
        focusInput(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusInput(index + 1);
    } else if (e.key === "Enter" && isComplete) {
      handleSubmit();
    }
  }

  function handlePaste(e) {
    const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    clearErrors();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < Math.min(text.length, CODE_LENGTH); i += 1) {
      next[i] = text[i];
    }
    setDigits(next);
    focusInput(Math.min(text.length, CODE_LENGTH - 1));
  }

  function extractErrorMessage(err, fallback) {
    const data = err?.response?.data;
    return (
      data?.errors?.code?.[0] ||
      data?.errors?.non_field_errors?.[0] ||
      data?.message ||
      data?.detail ||
      fallback
    );
  }

  const handleSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      if (!isComplete || isSubmitting) return;

      setIsSubmitting(true);
      setError("");
      setIsExpired(false);

      try {
        await verifyEmail(email, code);
        toast.success("Account verified! You can now log in.");
        navigate("/login", {
          replace: true,
          state: from ? { from } : undefined,
        });
      } catch (err) {
        const status = err?.response?.status;
        const errorCode = err?.response?.data?.code;

        if (status === 429) {
          toast.error("Too many attempts. Please wait before trying again.");
        } else if (errorCode === "expired" || status === 410) {
          setIsExpired(true);
          setError("Code has expired. Click to resend a new one.");
        } else {
          setError(
            extractErrorMessage(err, "Invalid verification code. Please try again.")
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [code, email, from, isComplete, isSubmitting, navigate, toast]
  );

  async function handleResend() {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setError("");
    setIsExpired(false);

    try {
      await resendVerificationCode(email);
      toast.success("Verification code sent. Check your email.");
      setDigits(Array(CODE_LENGTH).fill(""));
      focusInput(0);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err?.response?.status === 429) {
        toast.error("Please wait before requesting another code.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.error(
          extractErrorMessage(err, "Failed to resend code. Please try again.")
        );
      }
    } finally {
      setIsResending(false);
    }
  }

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">
              Verify your email
            </CardTitle>
          </div>
          <CardDescription>
            We sent a 6-digit verification code to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Enter it below to activate your account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div
              role="group"
              aria-label="Verification code"
              className="flex justify-between gap-2"
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={CODE_LENGTH}
                  aria-label={`Digit ${index + 1}`}
                  aria-invalid={!!error}
                  value={digit}
                  disabled={isSubmitting}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.target.select()}
                  className="h-14 w-full flex-1 rounded-md border border-input bg-background text-center text-xl font-semibold tracking-widest shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              ))}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isComplete || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Verify account
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">Didn't receive the code?</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              aria-label={
                cooldown > 0
                  ? `Resend available in ${cooldown} seconds`
                  : "Resend verification code"
              }
              className={isExpired ? "font-semibold" : ""}
            >
              {isResending
                ? "Sending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend code"}
            </Button>
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
