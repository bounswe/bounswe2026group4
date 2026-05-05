import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import ResetPasswordPage from "../ResetPasswordPage";
import { ToastProvider } from "@/context/ToastContext";
import { Toaster } from "@/components/ui/toaster";

vi.mock("@/services/authService", () => ({
  resetPassword: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { resetPassword } from "@/services/authService";

const TOKEN = "abc123-token";
const VALID_PASSWORD = "Password1";

function renderPage({ token = TOKEN } = {}) {
  const path = token ? `/reset-password/${token}` : "/reset-password";
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </ToastProvider>
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows missing-token state when token path param is absent", () => {
    renderPage({ token: "" });
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a new reset link/i })
    ).toBeInTheDocument();
  });

  it("renders form when token is present", () => {
    renderPage();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
  });

  it("shows error when password is empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("validates password strength rules", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("New password"), "weak");
    await user.type(screen.getByLabelText("Confirm password"), "weak");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/password must be at least 8 characters/i)
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("New password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), "DifferentPwd1");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("calls resetPassword with token, password, confirmation on valid submit", async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ message: "ok" });
    renderPage();
    await user.type(screen.getByLabelText("New password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith(TOKEN, VALID_PASSWORD, VALID_PASSWORD);
    });
  });

  it("navigates to /login and shows success toast on success", async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ message: "ok" });
    renderPage();
    await user.type(screen.getByLabelText("New password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
    expect(
      await screen.findByText(/password reset successfully/i)
    ).toBeInTheDocument();
  });

  it("shows expired-token state with link to forgot-password on token error", async () => {
    const user = userEvent.setup();
    const error = new Error("bad token");
    error.response = { status: 400, data: { errors: { token: ["Invalid or expired token."] } } };
    resetPassword.mockRejectedValue(error);
    renderPage();
    await user.type(screen.getByLabelText("New password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/reset link expired/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a new reset link/i })
    ).toBeInTheDocument();
  });

  it("shows backend new_password field error", async () => {
    const user = userEvent.setup();
    const error = new Error("bad");
    error.response = {
      status: 400,
      data: { errors: { new_password: ["This password is too common."] } },
    };
    resetPassword.mockRejectedValue(error);
    renderPage();
    await user.type(screen.getByLabelText("New password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/this password is too common/i)
    ).toBeInTheDocument();
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    resetPassword.mockReturnValue(new Promise(() => {}));
    renderPage();
    await user.type(screen.getByLabelText("New password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /resetting/i })).toBeDisabled();
    });
  });
});
