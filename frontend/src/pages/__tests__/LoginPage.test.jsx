import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom";

import LoginPage from "../LoginPage";
import { ToastProvider } from "@/context/ToastContext";
import { Toaster } from "@/components/ui/toaster";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { useAuth } from "@/hooks/useAuth";

function renderLoginPage() {
  return render(
    <ToastProvider>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
      <Toaster />
    </ToastProvider>
  );
}

describe("LoginPage", () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockReset();

    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: mockLogin,
      logout: vi.fn(),
    });
  });

  it("renders login form correctly", () => {
    renderLoginPage();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Local History Story Map")).toBeInTheDocument();
  });

  it("shows validation error for empty email", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it("shows validation error for empty password", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/password is required/i)
    ).toBeInTheDocument();
  });

  it("does not submit when email format is invalid", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "notanemail");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("submits form with valid credentials via auth context", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      access: "fake-access-token",
      refresh: "fake-refresh-token",
      user: { username: "alice" },
    });
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
    });
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    mockLogin.mockReturnValue(new Promise(() => {}));
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /signing in/i });
      expect(button).toBeDisabled();
    });
  });

  it("shows API error message on login failure", async () => {
    const user = userEvent.setup();
    const error = new Error("Network error");
    error.response = { data: { message: "Invalid credentials" } };
    mockLogin.mockRejectedValue(error);
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid credentials/i)
    ).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", {
      name: /show password/i,
    });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("navigates to home on successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ access: "a", refresh: "b", user: { username: "alice" } });
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("displays API error with role='alert' for accessibility", async () => {
    const user = userEvent.setup();
    const error = new Error("Network error");
    error.response = { data: { message: "Invalid credentials" } };
    mockLogin.mockRejectedValue(error);
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alertElement = await screen.findByRole("alert");
    expect(alertElement).toHaveTextContent(/invalid credentials/i);
  });

  it("navigates to redirect path from location state after login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ access: "a", refresh: "b", user: { username: "alice" } });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/dashboard" } } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ToastProvider>
    );

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("has link to registration page", () => {
    renderLoginPage();

    const signUpLink = screen.getByRole("link", { name: /sign up/i });
    expect(signUpLink).toBeInTheDocument();
  });

  it("has link to forgot password page", () => {
    renderLoginPage();

    const forgotLink = screen.getByRole("link", { name: /forgot your password/i });
    expect(forgotLink).toHaveAttribute("href", "/forgot-password");
  });

  it("shows contextual message when redirected from submit-story", () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/submit-story" } } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ToastProvider>
    );

    expect(screen.getByText("Log in to submit a story")).toBeInTheDocument();
  });

  it("navigates to /submit-story after login when redirected from submit-story", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ access: "a", refresh: "b", user: { username: "alice" } });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/submit-story" } } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ToastProvider>
    );

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/submit-story", { replace: true });
    });
  });

  it("shows success toast on successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ access: "a", refresh: "b", user: { username: "alice" } });
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Welcome back!")).toBeInTheDocument();
  });

  it("shows error.response.data.detail when message is absent", async () => {
    const user = userEvent.setup();
    const error = new Error("Network error");
    error.response = { data: { detail: "Account locked" } };
    mockLogin.mockRejectedValue(error);
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/account locked/i)).toBeInTheDocument();
  });

  it("shows hardcoded fallback when no response data is available", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error("Network error"));
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/login failed\. please check your credentials and try again\./i)
    ).toBeInTheDocument();
  });

  it("redirects away from login page when already authenticated", () => {
    useAuth.mockReturnValue({
      user: { username: "alice" },
      isAuthenticated: true,
      login: mockLogin,
      logout: vi.fn(),
    });

    renderLoginPage();

    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
  });
});
