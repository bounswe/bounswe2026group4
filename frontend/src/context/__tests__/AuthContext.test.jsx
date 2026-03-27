import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getStoredUser: vi.fn(),
  isTokenExpired: vi.fn(),
}));

import {
  login as loginService,
  logout as logoutService,
  getStoredUser,
  isTokenExpired,
} from "@/services/authService";
import { AuthContext, AuthProvider } from "@/context/AuthContext";

function Consumer() {
  const auth = React.useContext(AuthContext);

  return (
    <div>
      <p data-testid="loading">{String(auth.loading)}</p>
      <p data-testid="is-authenticated">{String(auth.isAuthenticated)}</p>
      <p data-testid="username">{auth.user?.username ?? ""}</p>
      <button onClick={() => auth.login("test@example.com", "Password1")}>
        Login
      </button>
      <button onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, "", "/");

    loginService.mockResolvedValue({
      user: {
        id: 1,
        email: "test@example.com",
        username: "testuser",
        role: "registered_user",
      },
    });
    logoutService.mockResolvedValue(undefined);
    getStoredUser.mockReturnValue(null);
    isTokenExpired.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts loading then resolves to unauthenticated when no valid session", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
  });

  it("restores user from storage when token is valid", async () => {
    localStorage.setItem("accessToken", "valid-token");
    isTokenExpired.mockReturnValue(false);
    getStoredUser.mockReturnValue({
      id: 1,
      email: "test@example.com",
      username: "restored-user",
      role: "registered_user",
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("username")).toHaveTextContent("restored-user");
  });

  it("does not restore user when token is expired", async () => {
    localStorage.setItem("accessToken", "expired-token");
    localStorage.setItem("refreshToken", "refresh-token");
    localStorage.setItem("user", JSON.stringify({ username: "old-user" }));
    isTokenExpired.mockReturnValue(true);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(getStoredUser).not.toHaveBeenCalled();
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("login updates user and authentication state", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    });

    expect(loginService).toHaveBeenCalledWith("test@example.com", "Password1");
    expect(screen.getByTestId("username")).toHaveTextContent("testuser");
  });

  it("logout clears auth state and redirects to home", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", "valid-token");
    isTokenExpired.mockReturnValue(false);
    getStoredUser.mockReturnValue({
      id: 1,
      email: "test@example.com",
      username: "restored-user",
      role: "registered_user",
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    });

    expect(logoutService).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/");
  });
});
