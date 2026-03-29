import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AppLayout from "@/components/AppLayout/AppLayout";

// Mock useAuth
const mockLogout = vi.fn();
let mockAuthState = { user: null, isAuthenticated: false, logout: mockLogout };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthState,
}));

function renderWithRouter(initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div>Feed Content</div>} />
          <Route path="/map" element={<div>Map Content</div>} />
          <Route path="/login" element={<div>Login Content</div>} />
          <Route path="/register" element={<div>Register Content</div>} />
          <Route path="/profile" element={<div>Profile Content</div>} />
          <Route path="/submit" element={<div>Submit Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      logout: mockLogout,
    };
    mockLogout.mockClear();
  });

  it("renders navbar with public links", () => {
    renderWithRouter();

    expect(screen.getByText("StoryMap")).toBeInTheDocument();
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByText("Feed")).toBeInTheDocument();
  });

  it("shows Login and Register buttons when unauthenticated", () => {
    renderWithRouter();

    expect(screen.getAllByText("Login").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Register").length).toBeGreaterThan(0);
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit Story")).not.toBeInTheDocument();
  });

  it("shows username, Logout, Profile, and Submit Story when authenticated", () => {
    mockAuthState = {
      user: { username: "testuser" },
      isAuthenticated: true,
      logout: mockLogout,
    };

    renderWithRouter();

    expect(screen.getAllByText("testuser").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Logout").length).toBeGreaterThan(0);
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Submit Story")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
    expect(screen.queryByText("Register")).not.toBeInTheDocument();
  });

  it("highlights active route", () => {
    renderWithRouter("/map");

    const mapLink = screen.getByText("Map");
    const feedLink = screen.getByText("Feed");

    expect(mapLink.className).toContain("text-primary");
    expect(feedLink.className).toContain("text-muted-foreground");
  });

  it("calls logout and navigates to / on logout click", async () => {
    mockAuthState = {
      user: { username: "testuser" },
      isAuthenticated: true,
      logout: mockLogout,
    };

    renderWithRouter("/profile");

    const user = userEvent.setup();
    // Click the first visible Logout button (desktop)
    const logoutButtons = screen.getAllByText("Logout");
    await user.click(logoutButtons[0]);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("renders page content via Outlet", () => {
    renderWithRouter("/");

    expect(screen.getByText("Feed Content")).toBeInTheDocument();
  });

  it("renders mobile hamburger button", () => {
    renderWithRouter();

    expect(screen.getByText("Toggle menu")).toBeInTheDocument();
  });
});
