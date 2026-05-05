import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, MapPin, MailCheck } from "lucide-react";

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
import { forgotPassword } from "@/services/authService";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    if (!email.trim()) {
      setEmailError("Email is required.");
      return false;
    }
    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (error) {
      const data = error.response?.data;
      const fieldEmail = data?.errors?.email;
      if (fieldEmail) {
        setEmailError(Array.isArray(fieldEmail) ? fieldEmail[0] : fieldEmail);
      } else {
        setApiError(
          data?.message || data?.detail || "Could not submit request. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
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
          <CardDescription>
            {submitted
              ? "Check your inbox"
              : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div
              role="status"
              className="flex flex-col items-center gap-3 rounded-md border border-input bg-muted/40 px-4 py-6 text-center"
            >
              <MailCheck className="h-10 w-10 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                If an account exists with this email, we&apos;ve sent a password
                reset link. Check your inbox.
              </p>
            </div>
          ) : (
            <>
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
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      autoComplete="email"
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "email-error" : undefined}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError("");
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  {emailError && (
                    <p id="email-error" className="text-sm text-destructive">
                      {emailError}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
            </>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ForgotPasswordPage;
