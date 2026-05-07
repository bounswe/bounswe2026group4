import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import NotificationItem from "@/components/Notifications/NotificationItem";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeNotification(overrides = {}) {
  return {
    id: 1,
    notification_type: "new_like",
    message: "Ali liked your story",
    actor: { id: 42, username: "ali" },
    story_id: 99,
    comment_id: null,
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationItem", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("labels itself as unread when is_read is false", () => {
    render(
      <MemoryRouter>
        <NotificationItem notification={makeNotification({ is_read: false })} />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("button", { name: /^Unread notification:/ })
    ).toBeInTheDocument();
  });

  it("labels itself without 'unread' prefix when read", () => {
    render(
      <MemoryRouter>
        <NotificationItem notification={makeNotification({ is_read: true })} />
      </MemoryRouter>
    );
    const btn = screen.getByRole("button", { name: /^Notification:/ });
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute("aria-label")).not.toMatch(/Unread/);
  });

  it("calls onMarkRead and navigates to story on click for unread item", async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotification({ is_read: false })}
          onMarkRead={onMarkRead}
          onClose={onClose}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button"));

    expect(onMarkRead).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/stories/99");
  });

  it("does not call onMarkRead when item is already read", async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotification({ is_read: true })}
          onMarkRead={onMarkRead}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button"));
    expect(onMarkRead).not.toHaveBeenCalled();
  });
});
