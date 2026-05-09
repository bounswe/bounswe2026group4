import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";
import AdminRoute from "../AdminRoute";

function renderAt(path = "/admin") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/admin"
          element={(
            <AdminRoute>
              <div>ADMIN CONTENT</div>
            </AdminRoute>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated users to /login", () => {
    useAuth.mockReturnValue({ user: null, isAuthenticated: false });
    renderAt("/admin");
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN CONTENT")).not.toBeInTheDocument();
  });

  it("shows Not authorized for authenticated non-admin users", () => {
    useAuth.mockReturnValue({
      user: { id: 1, role: "user" },
      isAuthenticated: true,
    });
    renderAt("/admin");
    expect(screen.getByRole("heading", { name: /not authorized/i })).toBeInTheDocument();
    expect(screen.queryByText("ADMIN CONTENT")).not.toBeInTheDocument();
  });

  it("renders children for admin users", () => {
    useAuth.mockReturnValue({
      user: { id: 1, role: "admin" },
      isAuthenticated: true,
    });
    renderAt("/admin");
    expect(screen.getByText("ADMIN CONTENT")).toBeInTheDocument();
  });
});
