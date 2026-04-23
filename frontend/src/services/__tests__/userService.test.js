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
  getPublicProfile,
  getProfile,
  getOwnProfile,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
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
    it("calls GET /users/me/ and returns data", async () => {
      const meData = { id: 1, email: "me@example.com", profile: { bio: "hello" } };
      api.get.mockResolvedValue({ data: meData });

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
});
