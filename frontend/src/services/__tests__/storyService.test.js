import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../api";
import { getStories, getMapStories, deleteStory } from "../storyService";

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

    it("calls GET /stories/feed/ with default params when no q is provided", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories();

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 1, page_size: 12, sort_by: "recent" },
      });
    });

    it("passes custom page param to feed API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ page: 3 });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 3, page_size: 12, sort_by: "recent" },
      });
    });

    it("passes custom pageSize to feed API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ pageSize: 6 });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 1, page_size: 6, sort_by: "recent" },
      });
    });

    it("passes yearFrom and yearTo filter params to feed API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ yearFrom: 1900, yearTo: 2000 });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 1, page_size: 12, sort_by: "recent", year_from: 1900, year_to: 2000 },
      });
    });

    it("passes location filter param to feed API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ location: "Galata" });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", {
        params: { page: 1, page_size: 12, sort_by: "recent", location: "Galata" },
      });
    });

    it("calls GET /stories/search/ with q param when q is provided", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ q: "galata tower" });

      expect(api.get).toHaveBeenCalledWith("/stories/search/", {
        params: { q: "galata tower", page: 1, page_size: 12 },
      });
    });

    it("trims whitespace from q before calling search API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ q: "  galata  " });

      expect(api.get).toHaveBeenCalledWith("/stories/search/", {
        params: { q: "galata", page: 1, page_size: 12 },
      });
    });

    it("passes year and location filters to search API when q and filters are combined", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ q: "galata", yearFrom: 1900, yearTo: 2000, location: "Pera" });

      expect(api.get).toHaveBeenCalledWith("/stories/search/", {
        params: { q: "galata", page: 1, page_size: 12, year_from: 1900, year_to: 2000, location: "Pera" },
      });
    });

    it("uses feed API when q is empty string", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getStories({ q: "" });

      expect(api.get).toHaveBeenCalledWith("/stories/feed/", expect.anything());
    });

    it("throws on API error", async () => {
      api.get.mockRejectedValue(new Error("Network error"));

      await expect(getStories()).rejects.toThrow("Network error");
    });
  });

  describe("getMapStories", () => {
    it("calls GET /stories/map/ with empty params by default", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getMapStories();

      expect(api.get).toHaveBeenCalledWith("/stories/map/", { params: { page_size: 100 } });
    });

    it("returns the .results array from paginated response", async () => {
      const stories = [{ id: 1, title: "Story 1" }, { id: 2, title: "Story 2" }];
      api.get.mockResolvedValue({ data: { count: 2, next: null, previous: null, results: stories } });

      const result = await getMapStories();

      expect(result).toEqual(stories);
    });

    it("passes yearFrom, yearTo and location filter params to map API", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getMapStories({ yearFrom: 1900, yearTo: 2000, location: "Galata" });

      expect(api.get).toHaveBeenCalledWith("/stories/map/", {
        params: { page_size: 100, year_from: 1900, year_to: 2000, location: "Galata" },
      });
    });

    it("calls search API when q is provided and returns stories with coordinates", async () => {
      const stories = [
        { id: 1, title: "Bridge", location_lat: 41.0, location_lng: 28.9 },
        { id: 2, title: "No location", location_lat: null, location_lng: null },
      ];
      api.get.mockResolvedValue({ data: { count: 2, next: null, previous: null, results: stories } });

      const result = await getMapStories({ q: "bridge" });

      expect(api.get).toHaveBeenCalledWith("/stories/search/", {
        params: { q: "bridge", page_size: 100 },
      });
      // Filters out stories without coordinates
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("passes year and location filters to search API when q and filters are combined", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

      await getMapStories({ q: "bridge", yearFrom: 1900, yearTo: 2000, location: "Galata" });

      expect(api.get).toHaveBeenCalledWith("/stories/search/", {
        params: { q: "bridge", page_size: 100, year_from: 1900, year_to: 2000, location: "Galata" },
      });
    });

    it("throws on API error", async () => {
      api.get.mockRejectedValue(new Error("Network error"));

      await expect(getMapStories()).rejects.toThrow("Network error");
    });
  });

  describe("deleteStory", () => {
    it("calls api.delete with correct URL", async () => {
      api.delete.mockResolvedValue({});

      await deleteStory(42);

      expect(api.delete).toHaveBeenCalledWith("/stories/42/");
    });

    it("throws on API error", async () => {
      api.delete.mockRejectedValue(new Error("Forbidden"));

      await expect(deleteStory(42)).rejects.toThrow("Forbidden");
    });
  });
});
