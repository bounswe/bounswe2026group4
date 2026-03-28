import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

import {
  login as loginService,
  logout as logoutService,
} from "@/services/authService";
import * as tokenStore from "@/services/tokenStore";
import { AuthContext, AuthProvider } from "@/context/AuthContext";

function Consumer() {
  const auth = React.useContext(AuthContext);

  return (
    <div>
      <p data-testid="is-authenticated">{String(auth.isAuthenticated)}</p>
      <p data-testid="username">{auth.user?.username ?? ""}</p>
      <button onClick={() => auth.login("test@example.com", "Password1").catch(() => {})}>
        Login
      </button>
      <button onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.clear();

    loginService.mockResolvedValue({
      access: "fake-access",
      refresh: "fake-refresh",
      user: {
        id: 1,
        email: "test@example.com",
        username: "testuser",
        role: "registered_user",
      },
    });
    logoutService.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts unauthenticated with no user", () => {
    renderWithRouter();

    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("username")).toHaveTextContent("");
  });

  it("login updates user and authentication state", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    });

    expect(loginService).toHaveBeenCalledWith("test@example.com", "Password1");
    expect(screen.getByTestId("username")).toHaveTextContent("testuser");
  });

  it("logout clears auth state and tokens", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Login first
    await user.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    });

    // Logout
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    });

    expect(logoutService).toHaveBeenCalledTimes(1);
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it("login failure keeps isAuthenticated false and user null", async () => {
    const user = userEvent.setup();
    loginService.mockRejectedValue(new Error("Invalid credentials"));

    renderWithRouter();

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(loginService).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("username")).toHaveTextContent("");
  });

  it("clears user when auth:logout event is dispatched", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Login first
    await user.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    });

    // Simulate 401 interceptor clearing tokens (which dispatches auth:logout)
    tokenStore.clear();

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    });
  });
});
