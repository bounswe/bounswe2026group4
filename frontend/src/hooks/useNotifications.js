import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  getNotifications,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from "@/services/notificationService";

const POLL_INTERVAL_MS = 45_000;

export function useNotifications({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Use a ref so the polling interval always sees fresh auth state.
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Tracks how many mark-read PATCHes are in flight. While > 0, polling is
  // suppressed so a stale server response can't clobber our optimistic
  // is_read: true before the PATCH is persisted.
  const inFlightMarksRef = useRef(0);

  // Mirror of `notifications` so callbacks can read latest state without
  // re-creating on every render (keeps the callback identity stable).
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const refresh = useCallback(async () => {
    if (!isAuthenticatedRef.current) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return undefined;
    }
    refresh();
    const intervalId = setInterval(() => {
      if (isAuthenticatedRef.current && inFlightMarksRef.current === 0) {
        refresh();
      }
    }, pollIntervalMs);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, pollIntervalMs, refresh]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    inFlightMarksRef.current += 1;
    try {
      await markAsReadService(id, true);
    } catch (err) {
      setError(err);
      // Roll back the optimistic update on failure.
      await refresh();
    } finally {
      inFlightMarksRef.current -= 1;
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const unreadIds = notificationsRef.current
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    inFlightMarksRef.current += 1;
    try {
      await markAllAsReadService(unreadIds);
    } catch (err) {
      setError(err);
      await refresh();
    } finally {
      inFlightMarksRef.current -= 1;
    }
  }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
