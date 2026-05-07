import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../api";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
} from "../notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNotifications", () => {
    it("GETs /notifications/ and returns response data", async () => {
      const body = { notifications: [{ id: 1 }, { id: 2 }] };
      api.get.mockResolvedValue({ data: body });

      const result = await getNotifications();

      expect(api.get).toHaveBeenCalledWith("/notifications/");
      expect(result).toEqual(body);
    });

    it("propagates API errors", async () => {
      api.get.mockRejectedValue(new Error("Network error"));
      await expect(getNotifications()).rejects.toThrow("Network error");
    });
  });

  describe("markAsRead", () => {
    it("PATCHes /notifications/<id>/read/ with is_read true by default", async () => {
      api.patch.mockResolvedValue({ data: { id: 5, is_read: true } });

      const result = await markAsRead(5);

      expect(api.patch).toHaveBeenCalledWith("/notifications/5/read/", {
        is_read: true,
      });
      expect(result).toEqual({ id: 5, is_read: true });
    });

    it("supports passing is_read explicitly", async () => {
      api.patch.mockResolvedValue({ data: {} });
      await markAsRead(7, false);
      expect(api.patch).toHaveBeenCalledWith("/notifications/7/read/", {
        is_read: false,
      });
    });
  });

  describe("markAllAsRead", () => {
    it("fans out PATCH calls for each id", async () => {
      api.patch.mockResolvedValue({ data: {} });
      await markAllAsRead([1, 2, 3]);

      expect(api.patch).toHaveBeenCalledTimes(3);
      expect(api.patch).toHaveBeenNthCalledWith(1, "/notifications/1/read/", {
        is_read: true,
      });
      expect(api.patch).toHaveBeenNthCalledWith(2, "/notifications/2/read/", {
        is_read: true,
      });
      expect(api.patch).toHaveBeenNthCalledWith(3, "/notifications/3/read/", {
        is_read: true,
      });
    });

    it("does nothing when given an empty array", async () => {
      await markAllAsRead([]);
      expect(api.patch).not.toHaveBeenCalled();
    });
  });

  describe("getPreferences", () => {
    it("GETs /notifications/preferences/", async () => {
      const body = { notifications_muted: false, preferences: {} };
      api.get.mockResolvedValue({ data: body });

      const result = await getPreferences();

      expect(api.get).toHaveBeenCalledWith("/notifications/preferences/");
      expect(result).toEqual(body);
    });
  });

  describe("updatePreferences", () => {
    it("PATCHes /notifications/preferences/ with the payload", async () => {
      const payload = { new_like: false, notifications_muted: true };
      const body = { notifications_muted: true, preferences: { new_like: false } };
      api.patch.mockResolvedValue({ data: body });

      const result = await updatePreferences(payload);

      expect(api.patch).toHaveBeenCalledWith(
        "/notifications/preferences/",
        payload
      );
      expect(result).toEqual(body);
    });
  });
});
