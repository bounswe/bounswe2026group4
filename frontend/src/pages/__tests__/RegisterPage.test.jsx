import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import RegisterPage from "../RegisterPage";

// Mock authService
vi.mock("@/services/authService", () => ({
  register: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { register } from "@/services/authService";

function renderRegisterPage() {
  return render(
    <BrowserRouter>
      <RegisterPage />
    </BrowserRouter>
  );
}

const VALID_USERNAME = "testuser";
const VALID_EMAIL = "test@example.com";
const VALID_PASSWORD = "Password1";

async function fillForm(user, { username = VALID_USERNAME, email = VALID_EMAIL, password = VALID_PASSWORD, confirmPassword = VALID_PASSWORD } = {}) {
  if (username) await user.type(screen.getByLabelText("Username"), username);
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  if (confirmPassword) await user.type(screen.getByLabelText("Confirm Password"), confirmPassword);
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Renders correctly
  it("renders registration form with all required fields", () => {
    renderRegisterPage();

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText("Local History Story Map")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  // 2. Form validation — required fields
  it("shows error when username is empty", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
    await user.type(screen.getByLabelText("Password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm Password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when email is empty", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Username"), VALID_USERNAME);
    await user.type(screen.getByLabelText("Password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm Password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error for invalid email format", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Username"), VALID_USERNAME);
    await user.type(screen.getByLabelText("Email"), "notanemail");
    await user.type(screen.getByLabelText("Password"), VALID_PASSWORD);
    await user.type(screen.getByLabelText("Confirm Password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when password is empty", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Username"), VALID_USERNAME);
    await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
    await user.type(screen.getByLabelText("Confirm Password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when password is too short", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillForm(user, { password: "Ab1", confirmPassword: "Ab1" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/must be at least 8 characters/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when password lacks uppercase letter", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillForm(user, { password: "password1", confirmPassword: "password1" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/must contain an uppercase/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when password lacks lowercase letter", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillForm(user, { password: "PASSWORD1", confirmPassword: "PASSWORD1" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/must contain a lowercase/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when password lacks a number", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillForm(user, { password: "Passwordabc", confirmPassword: "Passwordabc" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/must contain a number/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when confirm password is empty", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Username"), VALID_USERNAME);
    await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
    await user.type(screen.getByLabelText("Password"), VALID_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/confirm your password/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillForm(user, { confirmPassword: "Different1" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  // 3. Successful submission
  it("calls register with correct arguments on valid submission", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue({ message: "Registration successful.", user: {} });
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        VALID_USERNAME,
        VALID_EMAIL,
        VALID_PASSWORD,
        VALID_PASSWORD
      );
    });
  });

  // 4. Success navigation
  it("navigates to /login on successful registration", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue({ message: "Registration successful.", user: {} });
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { state: { registered: true } });
    });
  });

  // 5. Loading state
  it("shows loading state and disables button during submission", async () => {
    const user = userEvent.setup();
    register.mockReturnValue(new Promise(() => {}));
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /creating account/i });
      expect(button).toBeDisabled();
    });
  });

  // 6. API error — generic
  it("shows generic API error on failure", async () => {
    const user = userEvent.setup();
    const error = new Error("Server error");
    error.response = { data: { detail: "An unexpected error occurred." } };
    register.mockRejectedValue(error);
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });

  it("shows API error with role='alert' for accessibility", async () => {
    const user = userEvent.setup();
    const error = new Error("Server error");
    error.response = { data: { detail: "Something went wrong." } };
    register.mockRejectedValue(error);
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const alertEl = await screen.findByRole("alert");
    expect(alertEl).toBeInTheDocument();
  });

  it("displays backend field error for duplicate email", async () => {
    const user = userEvent.setup();
    const error = new Error("Conflict");
    error.response = {
      data: {
        success: false,
        message: "A user with this email already exists.",
        errors: { email: ["A user with this email already exists."] },
      },
    };
    register.mockRejectedValue(error);
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/a user with this email already exists/i)).toBeInTheDocument();
  });

  it("displays backend field error for duplicate username", async () => {
    const user = userEvent.setup();
    const error = new Error("Conflict");
    error.response = {
      data: {
        success: false,
        message: "A user with this username already exists.",
        errors: { username: ["A user with this username already exists."] },
      },
    };
    register.mockRejectedValue(error);
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/a user with this username already exists/i)).toBeInTheDocument();
  });

  // 7. Field errors clear on input
  it("clears field error when user starts typing in that field", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    // Trigger validation
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();

    // Start typing — error should clear
    await user.type(screen.getByLabelText("Username"), "a");
    expect(screen.queryByText(/username is required/i)).not.toBeInTheDocument();
  });

  // 8. Password visibility toggles
  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("toggles confirm password visibility", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const confirmInput = screen.getByLabelText("Confirm Password");
    expect(confirmInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show confirm password/i }));
    expect(confirmInput).toHaveAttribute("type", "text");
  });

  // 9. Navigation link
  it("has a link to the login page", () => {
    renderRegisterPage();

    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});