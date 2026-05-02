import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, MapPin, User, Check, X } from "lucide-react";

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
import { register } from "@/services/authService";
import { useToast } from "@/hooks/useToast";

const INITIAL_FIELD_ERRORS = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const PASSWORD_RULES = [
  { id: "length",    label: "At least 8 characters",      test: (p) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter (A–Z)",  test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter (a–z)",  test: (p) => /[a-z]/.test(p) },
  { id: "number",    label: "One number (0–9)",            test: (p) => /[0-9]/.test(p) },
];

function validatePasswordStrength(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return "";
}

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState(INITIAL_FIELD_ERRORS);

  function clearFieldError(field) {
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validateForm() {
    const errors = { ...INITIAL_FIELD_ERRORS };
    let isValid = true;

    if (!username.trim()) {
      errors.username = "Username is required.";
      isValid = false;
    }

    if (!email.trim()) {
      errors.email = "Email is required.";
      isValid = false;
    } else if (!validateEmail(email)) {
      errors.email = "Enter a valid email address.";
      isValid = false;
    }

    if (!password) {
      errors.password = "Password is required.";
      isValid = false;
    } else {
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        errors.password = passwordError;
        isValid = false;
      }
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
      isValid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  }

  function extractApiErrors(error) {
    const data = error.response?.data;
    if (!data) return "Registration failed. Please try again.";

    const fieldMap = {
      username: "username",
      email: "email",
      password: "password",
      password_confirmation: "confirmPassword",
    };

    const backendErrors = data.errors || {};
    const newFieldErrors = { ...INITIAL_FIELD_ERRORS };
    let hasFieldErrors = false;

    for (const [apiField, stateField] of Object.entries(fieldMap)) {
      if (backendErrors[apiField]) {
        const msg = Array.isArray(backendErrors[apiField])
          ? backendErrors[apiField][0]
          : backendErrors[apiField];
        newFieldErrors[stateField] = msg;
        hasFieldErrors = true;
      }
    }

    if (hasFieldErrors) {
      setFieldErrors(newFieldErrors);
      return "";
    }

    const nonField = backendErrors.non_field_errors;
    if (nonField) {
      return Array.isArray(nonField) ? nonField[0] : nonField;
    }

    return data.message || data.detail || "Registration failed. Please try again.";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register(username, email, password, confirmPassword);
      toast.info("Account created! Check your email for a verification code.");
      // Forward the password (held in route state, not in the URL) so
      // VerifyEmailPage can auto-login the user the moment verification
      // succeeds and send them straight to profile completion.
      navigate("/verify-email", {
        state: { email, password, from: location.state?.from || null },
        replace: true,
      });
    } catch (error) {
      const msg = extractApiErrors(error);
      setApiError(msg);
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
            Create an account to explore and share local history stories
          </CardDescription>
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
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="your_username"
                  className="pl-9"
                  autoComplete="username"
                  aria-invalid={!!fieldErrors.username}
                  aria-describedby={fieldErrors.username ? "username-error" : undefined}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) clearFieldError("username");
                  }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.username && (
                <p id="username-error" className="text-sm text-destructive">{fieldErrors.username}</p>
              )}
            </div>

            {/* Email */}
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
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) clearFieldError("email");
                  }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="pl-9 pr-9"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby="password-error"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) clearFieldError("password");
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
              <ul id="password-requirements" className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(password);
                  const showRed = !!fieldErrors.password && !passed;
                  return (
                    <li key={rule.id} className={`flex items-center gap-1.5 text-xs ${showRed ? "text-destructive" : passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                      {passed
                        ? <Check className="h-3 w-3 shrink-0" />
                        : <X className="h-3 w-3 shrink-0" />}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  className="pl-9 pr-9"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) clearFieldError("confirmPassword");
                  }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="confirmPassword-error" className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
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

export default RegisterPage;