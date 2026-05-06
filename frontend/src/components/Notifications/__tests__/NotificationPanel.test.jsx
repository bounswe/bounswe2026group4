import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

import NotificationPanel from "@/components/Notifications/NotificationPanel";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <NotificationPanel
        notifications={[]}
        unreadCount={0}
        loading={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onClose={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("NotificationPanel", () => {
  it("renders empty state when there are no notifications", () => {
    renderPanel();
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("renders a list of notifications with messages", () => {
    const notifications = [
      {
        id: 1,
        notification_type: "new_like",
        message: "Ali liked your story",
        created_at: new Date().toISOString(),
        is_read: false,
      },
      {
        id: 2,
        notification_type: "new_comment",
        message: "Veli commented on your story",
        created_at: new Date().toISOString(),
        is_read: true,
      },
    ];
    renderPanel({ notifications, unreadCount: 1 });

    expect(screen.getByText("Ali liked your story")).toBeInTheDocument();
    expect(screen.getByText("Veli commented on your story")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("shows 'Mark all as read' button only when there is at least one unread", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();

    const { rerender } = renderPanel({
      notifications: [
        {
          id: 1,
          notification_type: "new_like",
          message: "x",
          created_at: new Date().toISOString(),
          is_read: true,
        },
      ],
      unreadCount: 0,
      onMarkAllRead,
    });
    expect(
      screen.queryByRole("button", { name: /mark all as read/i })
    ).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NotificationPanel
          notifications={[
            {
              id: 1,
              notification_type: "new_like",
              message: "x",
              created_at: new Date().toISOString(),
              is_read: false,
            },
          ]}
          unreadCount={1}
          loading={false}
          onMarkRead={vi.fn()}
          onMarkAllRead={onMarkAllRead}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    const btn = screen.getByRole("button", { name: /mark all as read/i });
    await user.click(btn);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("navigates to preferences when settings icon clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel({ onClose });

    await user.click(
      screen.getByRole("button", { name: /notification preferences/i })
    );

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/notifications/preferences");
  });
});
