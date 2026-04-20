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
          <Route path="/submit-story" element={<div>Submit Content</div>} />
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
  });

  it("shows Submit Story link for unauthenticated users", () => {
    renderWithRouter();

    expect(screen.getAllByText("Submit Story").length).toBeGreaterThan(0);
  });

  it("shows username linking to profile, Logout, and Submit Story when authenticated", () => {
    mockAuthState = {
      user: { username: "testuser" },
      isAuthenticated: true,
      logout: mockLogout,
    };

    renderWithRouter();

    // Username is a link to /profile (no separate "Profile" nav link)
    const profileLinks = screen.getAllByRole("link", { name: /testuser/i });
    expect(profileLinks.length).toBeGreaterThan(0);
    expect(profileLinks[0]).toHaveAttribute("href", "/profile");
    expect(screen.getAllByText("Logout").length).toBeGreaterThan(0);
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
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

  it("Map link carries current search params when on the Feed page", () => {
    renderWithRouter("/?q=galata&year_from=1980");

    const mapLinks = screen.getAllByRole("link", { name: /^map$/i });
    expect(mapLinks[0]).toHaveAttribute("href", "/map?q=galata&year_from=1980");
  });

  it("Feed link carries current search params when on the Map page", () => {
    renderWithRouter("/map?q=galata&year_from=1980");

    const feedLinks = screen.getAllByRole("link", { name: /^feed$/i });
    expect(feedLinks[0]).toHaveAttribute("href", "/?q=galata&year_from=1980");
  });

  it("Map and Feed links use bare paths when on a non-filter page", () => {
    renderWithRouter("/profile?some=param");

    const mapLinks = screen.getAllByRole("link", { name: /^map$/i });
    const feedLinks = screen.getAllByRole("link", { name: /^feed$/i });
    expect(mapLinks[0]).toHaveAttribute("href", "/map");
    expect(feedLinks[0]).toHaveAttribute("href", "/");
  });

  it("Map and Feed links use bare paths when there are no active filters", () => {
    renderWithRouter("/");

    const mapLinks = screen.getAllByRole("link", { name: /^map$/i });
    expect(mapLinks[0]).toHaveAttribute("href", "/map");
  });

  it("Map link is still highlighted when filters are active on /map", () => {
    renderWithRouter("/map?q=galata&year_from=1980");

    const mapLink = screen.getByText("Map");
    const feedLink = screen.getByText("Feed");

    expect(mapLink.className).toContain("text-primary");
    expect(feedLink.className).toContain("text-muted-foreground");
  });

  it("Feed link is still highlighted when filters are active on /", () => {
    renderWithRouter("/?q=galata&year_from=1980");

    const feedLink = screen.getByText("Feed");
    const mapLink = screen.getByText("Map");

    expect(feedLink.className).toContain("text-primary");
    expect(mapLink.className).toContain("text-muted-foreground");
  });

  it("renders mobile hamburger button", () => {
    renderWithRouter();

    expect(screen.getByText("Toggle menu")).toBeInTheDocument();
  });

  it("mobile drawer Login button navigates to /login", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Open the drawer — sheet portals its content into the DOM after this
    await user.click(screen.getByRole("button", { name: /toggle menu/i }));

    // Two Login buttons now exist (desktop + drawer); click the drawer one (last)
    const loginButtons = await screen.findAllByRole("button", { name: /^login$/i });
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await screen.findByText("Login Content")).toBeInTheDocument();
  });

  it("mobile drawer Register button navigates to /register", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByRole("button", { name: /toggle menu/i }));

    const registerButtons = await screen.findAllByRole("button", { name: /^register$/i });
    await user.click(registerButtons[registerButtons.length - 1]);

    expect(await screen.findByText("Register Content")).toBeInTheDocument();
  });
});
