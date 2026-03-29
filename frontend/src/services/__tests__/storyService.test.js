import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "../api";
import { getStories } from "../storyService";

describe("storyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStories", () => {
    it("returns paginated response from API", async () => {
      const responseData = {
        count: 25,
        next: "http://localhost:8000/stories/feed/?page=2",
        previous: null,
        results: [
          { id: 1, title: "Story One", preview_text: "Once upon a time." },
          { id: 2, title: "Story Two", preview_text: "In a land far away." },
        ],
      };
      api.get.mockResolvedValue({ data: responseData });

      const result = await getStories();

      expect(result).toEqual(responseData);
    });

    it("calls GET /stories/feed/ with default params", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories();

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 1, page_size: 12, sort_by: "recent" },
      });
    });

    it("passes custom page param to API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ page: 3 });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 3, page_size: 12, sort_by: "recent" },
      });
    });

    it("passes custom pageSize to API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ pageSize: 6 });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 1, page_size: 6, sort_by: "recent" },
      });
    });

    it("throws on API error", async () => {
      api.get.mockRejectedValue(new Error("Network error"));

      await expect(getStories()).rejects.toThrow("Network error");
    });
  });
});
