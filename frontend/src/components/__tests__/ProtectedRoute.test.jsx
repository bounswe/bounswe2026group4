import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthContext } from "@/context/AuthContext";

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
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    renderWithAuth({
      user: null,
      isAuthenticated: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("shows loading state while auth is loading", () => {
    renderWithAuth({
      user: null,
      isAuthenticated: false,
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});
