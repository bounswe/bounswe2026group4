import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import NotificationBell from "@/components/Notifications/NotificationBell";

let mockAuth = { isAuthenticated: true };
let mockHook = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => mockHook,
}));

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mockAuth = { isAuthenticated: true };
    mockHook = {
      notifications: [],
      unreadCount: 0,
      loading: false,
      refresh: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
    };
  });

  it("renders nothing when user is not authenticated", () => {
    mockAuth = { isAuthenticated: false };
    const { container } = renderBell();
    expect(container.firstChild).toBeNull();
  });

  it("renders bell button when authenticated", () => {
    renderBell();
    expect(
      screen.getByRole("button", { name: /notifications/i })
    ).toBeInTheDocument();
  });

  it("does not show a badge when unread count is 0", () => {
    renderBell();
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("shows the unread count in a badge", () => {
    mockHook = { ...mockHook, unreadCount: 3 };
    renderBell();
    const badge = screen.getByTestId("notification-badge");
    expect(badge).toHaveTextContent("3");
    expect(
      screen.getByRole("button", { name: /3 unread/i })
    ).toBeInTheDocument();
  });

  it("shows '99+' when unread count exceeds 99", () => {
    mockHook = { ...mockHook, unreadCount: 150 };
    renderBell();
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("99+");
  });

  it("opens the panel when clicked", async () => {
    const user = userEvent.setup();
    renderBell();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
  });

  it("closes the panel when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <div>
          <NotificationBell />
          <button type="button" data-testid="outside">
            outside
          </button>
        </div>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();

    await user.click(screen.getByTestId("outside"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the panel when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
