import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthContext } from "@/context/AuthContext";

/** Helper that renders location.state.from.pathname so tests can verify redirect state */
function LoginPageWithState() {
  const location = useLocation();
  return <div>{location.state?.from?.pathname ?? "no-state"}</div>;
}

function renderWithAuth(authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("ProtectedRoute", () => {
  it("renders children when authenticated", () => {
    renderWithAuth({
      user: { username: "alice" },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    renderWithAuth({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("redirects to /login with from state preserving the original path", () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPageWithState />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText("/dashboard")).toBeInTheDocument();
  });
});
