import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../api";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../followService";

describe("followService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("followUser", () => {
    it("POSTs to /users/<id>/follow/ and returns response data", async () => {
      api.post.mockResolvedValue({ data: { is_followed_by_me: true } });

      const result = await followUser(42);

      expect(api.post).toHaveBeenCalledWith("/users/42/follow/");
      expect(result).toEqual({ is_followed_by_me: true });
    });

    it("propagates API errors", async () => {
      api.post.mockRejectedValue(new Error("Forbidden"));
      await expect(followUser(42)).rejects.toThrow("Forbidden");
    });
  });

  describe("unfollowUser", () => {
    it("DELETEs /users/<id>/follow/", async () => {
      api.delete.mockResolvedValue({});
      await unfollowUser(42);
      expect(api.delete).toHaveBeenCalledWith("/users/42/follow/");
    });

    it("propagates API errors", async () => {
      api.delete.mockRejectedValue(new Error("Network error"));
      await expect(unfollowUser(42)).rejects.toThrow("Network error");
    });
  });

  describe("getFollowers", () => {
    it("GETs /users/<id>/followers/ with default pagination", async () => {
      const data = { count: 0, next: null, previous: null, results: [] };
      api.get.mockResolvedValue({ data });

      const result = await getFollowers(42);

      expect(api.get).toHaveBeenCalledWith("/users/42/followers/", {
        params: { page: 1, page_size: 20 },
      });
      expect(result).toEqual(data);
    });

    it("passes custom page and pageSize", async () => {
      api.get.mockResolvedValue({ data: { results: [] } });

      await getFollowers(42, { page: 3, pageSize: 5 });

      expect(api.get).toHaveBeenCalledWith("/users/42/followers/", {
        params: { page: 3, page_size: 5 },
      });
    });

    it("propagates API errors", async () => {
      api.get.mockRejectedValue(new Error("Not found"));
      await expect(getFollowers(42)).rejects.toThrow("Not found");
    });
  });

  describe("getFollowing", () => {
    it("GETs /users/<id>/following/ with default pagination", async () => {
      const data = { count: 0, next: null, previous: null, results: [] };
      api.get.mockResolvedValue({ data });

      const result = await getFollowing(42);

      expect(api.get).toHaveBeenCalledWith("/users/42/following/", {
        params: { page: 1, page_size: 20 },
      });
      expect(result).toEqual(data);
    });

    it("passes custom page and pageSize", async () => {
      api.get.mockResolvedValue({ data: { results: [] } });

      await getFollowing(42, { page: 2, pageSize: 50 });

      expect(api.get).toHaveBeenCalledWith("/users/42/following/", {
        params: { page: 2, page_size: 50 },
      });
    });

    it("propagates API errors", async () => {
      api.get.mockRejectedValue(new Error("Not found"));
      await expect(getFollowing(42)).rejects.toThrow("Not found");
    });
  });
});
