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

const EMAIL = "test@example.com";

function renderPage({ state = { email: EMAIL }, initialEntries } = {}) {
  const entries = initialEntries ?? [{ pathname: "/verify-email", state }];
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={entries}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/register" element={<div>Register page</div>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </ToastProvider>
  );
}

function getCodeInputs() {
  return screen.getAllByRole("textbox").filter((input) =>
    /^Digit \d+$/.test(input.getAttribute("aria-label") || "")
  );
}

async function typeCode(user, code) {
  const inputs = getCodeInputs();
  for (let i = 0; i < code.length; i += 1) {
    // Focus the next empty input explicitly since jsdom doesn't carry focus
    // through our auto-advance as reliably as a real browser.
    inputs[i].focus();
    await user.type(inputs[i], code[i]);
  }
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the verification UI with the email address", () => {
      renderPage();
      expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      expect(screen.getByText(EMAIL)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /verify account/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /resend verification code/i })
      ).toBeInTheDocument();
    });

    it("renders six digit input boxes", () => {
      renderPage();
      expect(getCodeInputs()).toHaveLength(6);
    });

    it("disables submit button until all six digits are entered", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();

      const submit = screen.getByRole("button", { name: /verify account/i });
      expect(submit).toBeDisabled();

      await typeCode(user, "12345");
      expect(submit).toBeDisabled();

      const inputs = getCodeInputs();
      inputs[5].focus();
      await user.type(inputs[5], "6");
      expect(submit).toBeEnabled();
    });

    it("redirects to /register when opened without an email in state", () => {
      renderPage({ state: undefined, initialEntries: ["/verify-email"] });
      expect(screen.getByText(/register page/i)).toBeInTheDocument();
    });
  });

  describe("code input", () => {
    it("accepts only digits", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();

      const inputs = getCodeInputs();
      inputs[0].focus();
      await user.type(inputs[0], "abc");

      expect(inputs[0]).toHaveValue("");
    });

    it("distributes a pasted 6-digit code across the boxes", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();

      const inputs = getCodeInputs();
      inputs[0].focus();
      await user.paste("654321");

      expect(inputs[0]).toHaveValue("6");
      expect(inputs[1]).toHaveValue("5");
      expect(inputs[2]).toHaveValue("4");
      expect(inputs[3]).toHaveValue("3");
      expect(inputs[4]).toHaveValue("2");
      expect(inputs[5]).toHaveValue("1");
    });

    it("moves focus back on backspace when the current box is empty", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();

      const inputs = getCodeInputs();
      inputs[0].focus();
      await user.type(inputs[0], "1");

      inputs[1].focus();
      await user.keyboard("{Backspace}");

      expect(inputs[0]).toHaveFocus();
    });
  });

  describe("submit", () => {
    it("calls verifyEmail with email and code", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      verifyEmail.mockResolvedValue({ success: true });
      renderPage();

      await typeCode(user, "123456");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      await waitFor(() => {
        expect(verifyEmail).toHaveBeenCalledWith(EMAIL, "123456");
      });
    });

    it("navigates to /login with success toast on successful verification", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      verifyEmail.mockResolvedValue({ success: true });
      renderPage();

      await typeCode(user, "123456");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/login", {
          replace: true,
          state: undefined,
        });
      });
      expect(
        await screen.findByText(/account verified.*you can now log in/i)
      ).toBeInTheDocument();
    });

    it("preserves the 'from' state when navigating to /login", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      verifyEmail.mockResolvedValue({ success: true });
      const from = { pathname: "/submit-story", search: "", hash: "" };
      renderPage({ state: { email: EMAIL, from } });

      await typeCode(user, "123456");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/login", {
          replace: true,
          state: { from },
        });
      });
    });

    it("shows inline error on invalid code", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const err = new Error("Invalid");
      err.response = { status: 400, data: { message: "Invalid verification code." } };
      verifyEmail.mockRejectedValue(err);
      renderPage();

      await typeCode(user, "000000");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      expect(
        await screen.findByText(/invalid verification code/i)
      ).toBeInTheDocument();
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("shows expired error with resend guidance when code is expired", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const err = new Error("Expired");
      err.response = { status: 410, data: { code: "expired" } };
      verifyEmail.mockRejectedValue(err);
      renderPage();

      await typeCode(user, "999999");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      expect(
        await screen.findByText(/code has expired.*resend/i)
      ).toBeInTheDocument();
    });

    it("shows a rate-limit toast on 429 responses", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const err = new Error("Too many");
      err.response = { status: 429, data: {} };
      verifyEmail.mockRejectedValue(err);
      renderPage();

      await typeCode(user, "123456");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      expect(
        await screen.findByText(/too many attempts/i)
      ).toBeInTheDocument();
    });

    it("shows loading state while the verification request is in flight", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      verifyEmail.mockReturnValue(new Promise(() => {}));
      renderPage();

      await typeCode(user, "123456");
      await user.click(screen.getByRole("button", { name: /verify account/i }));

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /verifying/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe("resend", () => {
    it("calls resendVerificationCode with the email", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      resendVerificationCode.mockResolvedValue({ success: true });
      renderPage();

      await user.click(
        screen.getByRole("button", { name: /resend verification code/i })
      );

      await waitFor(() => {
        expect(resendVerificationCode).toHaveBeenCalledWith(EMAIL);
      });
    });

    it("starts a 60-second cooldown after a successful resend", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      resendVerificationCode.mockResolvedValue({ success: true });
      renderPage();

      await user.click(
        screen.getByRole("button", { name: /resend verification code/i })
      );

      const resendBtn = await screen.findByRole("button", {
        name: /resend available in 60 seconds/i,
      });
      expect(resendBtn).toBeDisabled();
      expect(resendBtn).toHaveTextContent(/resend in 60s/i);
    });

    it("decrements the cooldown each second", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      resendVerificationCode.mockResolvedValue({ success: true });
      renderPage();

      await user.click(
        screen.getByRole("button", { name: /resend verification code/i })
      );
      await screen.findByText(/resend in 60s/i);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText(/resend in 57s/i)).toBeInTheDocument();
    });

    it("re-enables the resend button once the cooldown elapses", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      resendVerificationCode.mockResolvedValue({ success: true });
      renderPage();

      await user.click(
        screen.getByRole("button", { name: /resend verification code/i })
      );
      await screen.findByText(/resend in 60s/i);

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(
        await screen.findByRole("button", { name: /resend verification code/i })
      ).toBeEnabled();
    });

    it("shows a success toast after a successful resend", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      resendVerificationCode.mockResolvedValue({ success: true });
      renderPage();

      await user.click(
        screen.getByRole("button", { name: /resend verification code/i })
      );

      expect(
        await screen.findByText(/verification code sent/i)
      ).toBeInTheDocument();
    });

    it("enters cooldown on 429 rate-limit response", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const err = new Error("Too many");
      err.response = { status: 429, data: {} };
      resendVerificationCode.mockRejectedValue(err);
      renderPage();

      await user.click(
        screen.getByRole("button", { name: /resend verification code/i })
      );

      await screen.findByText(/resend in 60s/i);
      expect(
        await screen.findByText(/please wait before requesting another code/i)
      ).toBeInTheDocument();
    });
  });
});
