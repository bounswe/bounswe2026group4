import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../tokenStore", () => ({
  getRefreshToken: vi.fn(),
}));

import api from "../api";
import { getRefreshToken } from "../tokenStore";
import {
  getPublicProfile,
  getProfile,
  getOwnProfile,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  getUserBadges,
  deleteAccount,
} from "../userService";

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPublicProfile", () => {
    it("calls GET /users/<id>/ and returns data", async () => {
      const profileData = { id: 5, username: "alice" };
      api.get.mockResolvedValue({ data: profileData });

      const result = await getPublicProfile(5);

      expect(api.get).toHaveBeenCalledWith("/users/5/");
      expect(result).toEqual(profileData);
    });

    it("propagates API errors", async () => {
      api.get.mockRejectedValue(new Error("Network error"));
      await expect(getPublicProfile(5)).rejects.toThrow("Network error");
    });
  });

  describe("getProfile (alias)", () => {
    it("is the same function as getPublicProfile", () => {
      expect(getProfile).toBe(getPublicProfile);
    });
  });

  describe("getOwnProfile", () => {
    it("calls GET /users/me/ and returns the unwrapped user object", async () => {
      const meData = { id: 1, email: "me@example.com", profile: { bio: "hello" } };
      api.get.mockResolvedValue({ data: { success: true, data: meData } });

      const result = await getOwnProfile();

      expect(api.get).toHaveBeenCalledWith("/users/me/");
      expect(result).toEqual(meData);
    });
  });

  describe("updateProfile", () => {
    it("sends PATCH /users/me/ with only user fields when no profile fields given", async () => {
      api.patch.mockResolvedValue({ data: { success: true } });

      await updateProfile({ username: "bob" });

      expect(api.patch).toHaveBeenCalledWith("/users/me/", { username: "bob" });
    });

    it("nests profile fields under 'profile' key", async () => {
      api.patch.mockResolvedValue({ data: { success: true } });

      await updateProfile(
        { is_username_public: true },
        { bio: "hi", location: "Istanbul", is_location_public: false }
      );

      expect(api.patch).toHaveBeenCalledWith("/users/me/", {
        is_username_public: true,
        profile: { bio: "hi", location: "Istanbul", is_location_public: false },
      });
    });

    it("omits 'profile' key when profileFields is empty", async () => {
      api.patch.mockResolvedValue({ data: {} });

      await updateProfile({ username: "carol" }, {});

      const [, body] = api.patch.mock.calls[0];
      expect(body).not.toHaveProperty("profile");
    });

    it("returns response data", async () => {
      const data = { success: true, data: { id: 1 } };
      api.patch.mockResolvedValue({ data });

      const result = await updateProfile({}, { bio: "test" });
      expect(result).toEqual(data);
    });

    it("propagates API errors", async () => {
      api.patch.mockRejectedValue(new Error("Validation error"));
      await expect(updateProfile({}, { bio: "x" })).rejects.toThrow("Validation error");
    });
  });

  describe("uploadProfilePhoto", () => {
    it("sends POST /users/me/photo/ as multipart with correct field name", async () => {
      api.post.mockResolvedValue({ data: { photo_url: "http://example.com/photo.jpg" } });
      const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });

      const result = await uploadProfilePhoto(file);

      expect(api.post).toHaveBeenCalledTimes(1);
      const [url, formData, config] = api.post.mock.calls[0];
      expect(url).toBe("/users/me/photo/");
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get("photo")).toBe(file);
      expect(config.headers["Content-Type"]).toBe("multipart/form-data");
      expect(result).toEqual({ photo_url: "http://example.com/photo.jpg" });
    });

    it("propagates API errors", async () => {
      api.post.mockRejectedValue(new Error("Upload failed"));
      const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
      await expect(uploadProfilePhoto(file)).rejects.toThrow("Upload failed");
    });
  });

  describe("removeProfilePhoto", () => {
    it("sends DELETE /users/me/photo/", async () => {
      api.delete.mockResolvedValue({});

      await removeProfilePhoto();

      expect(api.delete).toHaveBeenCalledWith("/users/me/photo/");
    });

    it("propagates API errors", async () => {
      api.delete.mockRejectedValue(new Error("Delete failed"));
      await expect(removeProfilePhoto()).rejects.toThrow("Delete failed");
    });
  });

  describe("getUserBadges", () => {
    it("calls GET /users/<id>/badges/ with page_size=100 on the first page", async () => {
      const results = [
        {
          id: 12,
          badge: {
            id: 1,
            name: "First Story",
            description: "Awarded for publishing your first story",
            criteria_type: "stories_published",
            criteria_threshold: 1,
          },
          awarded_at: "2026-04-01T12:00:00Z",
        },
      ];
      api.get.mockResolvedValue({
        data: { count: 1, next: null, previous: null, results },
      });

      const result = await getUserBadges(7);

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledWith("/users/7/badges/", {
        params: { page_size: 100 },
      });
      expect(result).toEqual(results);
    });

    it("walks the `next` link until exhausted and concatenates results", async () => {
      const page1 = [{ id: 1, badge: { id: 1, name: "A" } }];
      const page2 = [{ id: 2, badge: { id: 2, name: "B" } }];
      const page3 = [{ id: 3, badge: { id: 3, name: "C" } }];
      api.get
        .mockResolvedValueOnce({
          data: {
            count: 3,
            next: "/users/7/badges/?page=2",
            previous: null,
            results: page1,
          },
        })
        .mockResolvedValueOnce({
          data: {
            count: 3,
            next: "/users/7/badges/?page=3",
            previous: null,
            results: page2,
          },
        })
        .mockResolvedValueOnce({
          data: { count: 3, next: null, previous: null, results: page3 },
        });

      const result = await getUserBadges(7);

      expect(api.get).toHaveBeenCalledTimes(3);
      expect(api.get.mock.calls[0]).toEqual([
        "/users/7/badges/",
        { params: { page_size: 100 } },
      ]);
      expect(api.get.mock.calls[1]).toEqual(["/users/7/badges/?page=2"]);
      expect(api.get.mock.calls[2]).toEqual(["/users/7/badges/?page=3"]);
      expect(result).toEqual([...page1, ...page2, ...page3]);
    });

    it("returns an empty array when no badges are awarded", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      const result = await getUserBadges(7);

      expect(result).toEqual([]);
    });

    it("propagates API errors", async () => {
      api.get.mockRejectedValue(new Error("Network error"));
      await expect(getUserBadges(7)).rejects.toThrow("Network error");
    });
  });

  describe("deleteAccount", () => {
    it("sends DELETE /users/me/ with password, hard_delete=true, and the refresh token", async () => {
      api.delete.mockResolvedValue({ status: 204, data: null });
      getRefreshToken.mockReturnValue("refresh-abc");

      await deleteAccount("hunter2", true);

      expect(api.delete).toHaveBeenCalledWith("/users/me/", {
        data: {
          password: "hunter2",
          hard_delete: true,
          refresh: "refresh-abc",
        },
      });
    });

    it("sends hard_delete=false when stories should be anonymised (hardDelete=false)", async () => {
      api.delete.mockResolvedValue({ status: 204, data: null });
      getRefreshToken.mockReturnValue("refresh-xyz");

      await deleteAccount("hunter2", false);

      expect(api.delete.mock.calls[0][1].data).toMatchObject({
        hard_delete: false,
        refresh: "refresh-xyz",
      });
    });

    it("forwards an empty refresh token when none is stored", async () => {
      api.delete.mockResolvedValue({ status: 204, data: null });
      getRefreshToken.mockReturnValue(null);

      await deleteAccount("hunter2", true);

      expect(api.delete.mock.calls[0][1].data.refresh).toBe("");
    });

    it("propagates API errors (e.g., wrong password 400)", async () => {
      const err = Object.assign(new Error("Bad Request"), {
        response: { status: 400, data: { password: ["Incorrect password."] } },
      });
      api.delete.mockRejectedValue(err);
      getRefreshToken.mockReturnValue("");

      await expect(deleteAccount("wrong", true)).rejects.toBe(err);
    });
  });
});
