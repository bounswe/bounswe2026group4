import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockAuth = { isAuthenticated: true };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/services/notificationService", () => ({
  getNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "@/services/notificationService";
import { useNotifications } from "@/hooks/useNotifications";

describe("useNotifications", () => {
  beforeEach(() => {
    mockAuth = { isAuthenticated: true };
    getNotifications.mockReset();
    markAsRead.mockReset();
    markAllAsRead.mockReset();
  });

  it("fetches notifications on mount when authenticated", async () => {
    getNotifications.mockResolvedValue({
      notifications: [
        { id: 1, message: "x", is_read: false },
        { id: 2, message: "y", is_read: true },
      ],
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("does not fetch when unauthenticated", async () => {
    mockAuth = { isAuthenticated: false };
    getNotifications.mockResolvedValue({ notifications: [] });

    renderHook(() => useNotifications());
    await act(async () => {
      await Promise.resolve();
    });

    expect(getNotifications).not.toHaveBeenCalled();
  });

  it("polls for new notifications on the configured interval", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    getNotifications.mockResolvedValue({ notifications: [] });

    renderHook(() => useNotifications({ pollIntervalMs: 1000 }));

    // Wait for the initial fetch (real microtask queue still runs)
    await waitFor(() => {
      expect(getNotifications).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => {
      expect(getNotifications).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => {
      expect(getNotifications).toHaveBeenCalledTimes(3);
    });

    vi.useRealTimers();
  });

  it("optimistically marks a single notification as read", async () => {
    getNotifications.mockResolvedValue({
      notifications: [
        { id: 1, message: "x", is_read: false },
        { id: 2, message: "y", is_read: false },
      ],
    });
    markAsRead.mockResolvedValue({});

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });

    await act(async () => {
      await result.current.markRead(1);
    });

    expect(markAsRead).toHaveBeenCalledWith(1, true);
    expect(
      result.current.notifications.find((n) => n.id === 1).is_read
    ).toBe(true);
    expect(result.current.unreadCount).toBe(1);
  });

  it("marks all unread notifications as read", async () => {
    getNotifications.mockResolvedValue({
      notifications: [
        { id: 1, message: "x", is_read: false },
        { id: 2, message: "y", is_read: false },
        { id: 3, message: "z", is_read: true },
      ],
    });
    markAllAsRead.mockResolvedValue();

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(markAllAsRead).toHaveBeenCalledWith([1, 2]);
    expect(result.current.unreadCount).toBe(0);
  });
});
