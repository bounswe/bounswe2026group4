import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import VerifyEmailPage from "../VerifyEmailPage";
import { ToastProvider } from "@/context/ToastContext";
import { Toaster } from "@/components/ui/toaster";

vi.mock("@/services/authService", () => ({
  verifyEmail: vi.fn(),
  resendVerificationCode: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { verifyEmail, resendVerificationCode } from "@/services/authService";

const TEST_EMAIL = "test@example.com";

function renderPage({ state = { email: TEST_EMAIL } } = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: "/verify-email", state }]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/register" element={<div>Register page</div>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </ToastProvider>
  );
}

async function typeCode(user, code) {
  const inputs = screen.getAllByLabelText(/digit \d/i);
  inputs[0].focus();
  await user.keyboard(code);
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /register when no email is in route state", () => {
    renderPage({ state: null });
    expect(screen.getByText("Register page")).toBeInTheDocument();
  });

  it("renders 6 digit boxes and the email", () => {
    renderPage();
    expect(screen.getAllByLabelText(/digit \d/i)).toHaveLength(6);
    expect(screen.getByText(TEST_EMAIL)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify email/i })).toBeInTheDocument();
  });

  it("disables submit until all 6 digits are entered", async () => {
    const user = userEvent.setup();
    renderPage();
    const submit = screen.getByRole("button", { name: /verify email/i });
    expect(submit).toBeDisabled();

    const inputs = screen.getAllByLabelText(/digit \d/i);
    inputs[0].focus();
    await user.keyboard("12345");
    expect(submit).toBeDisabled();

    await user.keyboard("6");
    expect(submit).not.toBeDisabled();
  });

  it("auto-advances focus to the next box when typing a digit", async () => {
    const user = userEvent.setup();
    renderPage();
    const inputs = screen.getAllByLabelText(/digit \d/i);
    inputs[0].focus();
    await user.keyboard("4");
    expect(inputs[1]).toHaveFocus();
  });

  it("submits with email and code on success and navigates to /login", async () => {
    const user = userEvent.setup();
    verifyEmail.mockResolvedValue({ message: "ok" });
    renderPage();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith(TEST_EMAIL, "123456");
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        state: { from: null },
        replace: true,
      });
    });
  });

  it("shows success toast on verification", async () => {
    const user = userEvent.setup();
    verifyEmail.mockResolvedValue({ message: "ok" });
    renderPage();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    expect(
      await screen.findByText(/account verified/i)
    ).toBeInTheDocument();
  });

  it("forwards from-state to /login on success", async () => {
    const user = userEvent.setup();
    verifyEmail.mockResolvedValue({ message: "ok" });
    const from = { pathname: "/submit-story", search: "", hash: "", state: null };
    renderPage({ state: { email: TEST_EMAIL, from } });
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        state: { from },
        replace: true,
      });
    });
  });

  it("shows inline error for invalid code", async () => {
    const user = userEvent.setup();
    const error = new Error("bad");
    error.response = { status: 400, data: { errors: { code: ["Invalid verification code."] } } };
    verifyEmail.mockRejectedValue(error);
    renderPage();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    expect(
      await screen.findByText(/invalid verification code/i)
    ).toBeInTheDocument();
  });

  it("shows resend option when code is expired", async () => {
    const user = userEvent.setup();
    const error = new Error("expired");
    error.response = { status: 400, data: { errors: { code: ["Code has expired."] } } };
    verifyEmail.mockRejectedValue(error);
    renderPage();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    expect(
      await screen.findByRole("button", { name: /resend code/i })
    ).toBeInTheDocument();
  });

  it("handles 429 rate limiting on submit", async () => {
    const user = userEvent.setup();
    const error = new Error("rate");
    error.response = { status: 429, data: {} };
    verifyEmail.mockRejectedValue(error);
    renderPage();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    verifyEmail.mockReturnValue(new Promise(() => {}));
    renderPage();
    await typeCode(user, "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /verifying/i })).toBeDisabled();
    });
  });

  describe("resend cooldown", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts 60s cooldown after a successful resend", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      resendVerificationCode.mockResolvedValue({ message: "ok" });
      renderPage();

      await user.click(screen.getByRole("button", { name: /^resend$/i }));
      await waitFor(() => {
        expect(resendVerificationCode).toHaveBeenCalledWith(TEST_EMAIL);
      });

      const cooldownButton = await screen.findByRole("button", { name: /resend in 60s/i });
      expect(cooldownButton).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(
        await screen.findByRole("button", { name: /resend in 58s/i })
      ).toBeDisabled();
    });
  });
});
