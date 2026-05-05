import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";

import ForgotPasswordPage from "../ForgotPasswordPage";

vi.mock("@/services/authService", () => ({
  forgotPassword: vi.fn(),
}));

import { forgotPassword } from "@/services/authService";

function renderPage() {
  return render(
    <BrowserRouter>
      <ForgotPasswordPage />
    </BrowserRouter>
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields", () => {
    renderPage();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error when email is empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it("shows error for invalid email format", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Email"), "notanemail");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it("calls forgotPassword with email on valid submit", async () => {
    const user = userEvent.setup();
    forgotPassword.mockResolvedValue({ message: "ok" });
    renderPage();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("shows generic confirmation that does not reveal account existence", async () => {
    const user = userEvent.setup();
    forgotPassword.mockResolvedValue({ message: "ok" });
    renderPage();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(
      await screen.findByText(/if an account exists with this email/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    forgotPassword.mockReturnValue(new Promise(() => {}));
    renderPage();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });
  });

  it("shows API error from response", async () => {
    const user = userEvent.setup();
    const error = new Error("server");
    error.response = { data: { detail: "Service unavailable." } };
    forgotPassword.mockRejectedValue(error);
    renderPage();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/service unavailable/i)).toBeInTheDocument();
  });

  it("shows backend field error for email", async () => {
    const user = userEvent.setup();
    const error = new Error("bad request");
    error.response = { data: { errors: { email: ["Enter a valid email."] } } };
    forgotPassword.mockRejectedValue(error);
    renderPage();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });
});
