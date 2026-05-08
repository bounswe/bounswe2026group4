import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "../api";
import { getTimeline, getTimelineHistoricalYear } from "../timelineService";

function story(overrides = {}) {
  return {
    id: overrides.id ?? "s",
    title: overrides.title ?? "Story",
    time_type: "exact_year",
    year: null,
    year_start: null,
    year_end: null,
    date_value: null,
    ...overrides,
  };
}

describe("timelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls GET /stories/timeline/ and returns response data", async () => {
    const responseData = {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
    api.get.mockResolvedValue({ data: responseData });

    const result = await getTimeline();

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", { params: {} });
    expect(result).toEqual(responseData);
  });

  it("converts camelCase args to snake_case query params", async () => {
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await getTimeline({
      yearFrom: 1900,
      yearTo: 2000,
      latMin: 40.0,
      latMax: 41.5,
      lngMin: 28.0,
      lngMax: 29.5,
      page: 2,
      pageSize: 25,
    });

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", {
      params: {
        year_from: 1900,
        year_to: 2000,
        lat_min: 40.0,
        lat_max: 41.5,
        lng_min: 28.0,
        lng_max: 29.5,
        page: 2,
        page_size: 25,
      },
    });
  });

  it("omits undefined params", async () => {
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await getTimeline({ yearFrom: 1875, yearTo: 1875 });

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", {
      params: { year_from: 1875, year_to: 1875 },
    });
  });

  it("passes bbox params through", async () => {
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await getTimeline({ latMin: 40, latMax: 41, lngMin: 28, lngMax: 29 });

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", {
      params: { lat_min: 40, lat_max: 41, lng_min: 28, lng_max: 29 },
    });
  });

  it("throws on API error", async () => {
    api.get.mockRejectedValue(new Error("Network error"));

    await expect(getTimeline()).rejects.toThrow("Network error");
  });

  describe("fallback path (filters not supported by /stories/timeline/)", () => {
    it("routes to /stories/search/ when q is set, sorted by historical year", async () => {
      api.get.mockResolvedValue({
        data: {
          count: 3,
          next: null,
          previous: null,
          results: [
            story({ id: "later", year: 2000 }),
            story({ id: "earlier", year: 1900 }),
            story({ id: "middle", year: 1950 }),
          ],
        },
      });

      const result = await getTimeline({ q: "Galata", page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/search/",
        expect.objectContaining({ params: expect.objectContaining({ q: "Galata" }) }),
      );
      expect(result.results.map((s) => s.id)).toEqual(["earlier", "middle", "later"]);
      expect(result.count).toBe(3);
    });

    it("routes to /stories/feed/ when only tags are set, and forwards them", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      await getTimeline({ tags: ["mosque", "ottoman"], page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/feed/",
        expect.objectContaining({
          params: expect.objectContaining({
            sort_by: "recent",
            tags: ["mosque", "ottoman"],
          }),
        }),
      );
    });

    it("routes to /stories/feed/ when proximity is set, and forwards lat/lng/radius", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      await getTimeline({ latitude: 41, longitude: 29, radiusKm: 1, page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/feed/",
        expect.objectContaining({
          params: expect.objectContaining({ latitude: 41, longitude: 29, radius_km: 1 }),
        }),
      );
    });

    it("falls back when location text is set without a bbox", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      await getTimeline({ location: "Galata", page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/feed/",
        expect.objectContaining({ params: expect.objectContaining({ location: "Galata" }) }),
      );
    });

    it("does NOT fall back when location string has a matching bbox", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      await getTimeline({
        location: "Galata",
        latMin: 41.02,
        latMax: 41.03,
        lngMin: 28.97,
        lngMax: 28.98,
      });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/timeline/",
        expect.objectContaining({
          params: expect.objectContaining({ lat_min: 41.02 }),
        }),
      );
    });

    it("client-paginates the fallback results", async () => {
      const all = [];
      for (let i = 0; i < 25; i++) {
        all.push(story({ id: `s${i}`, year: 1900 + i }));
      }
      api.get.mockResolvedValue({
        data: { count: 25, next: null, previous: null, results: all },
      });

      const page2 = await getTimeline({ q: "x", page: 2, pageSize: 10 });

      expect(page2.count).toBe(25);
      expect(page2.results).toHaveLength(10);
      expect(page2.results[0].id).toBe("s10");
      expect(page2.next).toBe("client-next-page");
      expect(page2.previous).toBe("client-previous-page");

      const page3 = await getTimeline({ q: "x", page: 3, pageSize: 10 });
      expect(page3.results).toHaveLength(5);
      expect(page3.next).toBeNull();
    });
  });

  describe("getTimelineHistoricalYear", () => {
    it("returns year for exact_year stories", () => {
      expect(getTimelineHistoricalYear(story({ time_type: "exact_year", year: 1875 }))).toBe(1875);
    });

    it("returns midpoint for year_range stories", () => {
      expect(
        getTimelineHistoricalYear(story({ time_type: "year_range", year_start: 1850, year_end: 1900 })),
      ).toBe(1875);
    });

    it("returns year + 5 for decade stories", () => {
      expect(getTimelineHistoricalYear(story({ time_type: "decade", year: 1870 }))).toBe(1875);
    });

    it("extracts the year from exact_date stories", () => {
      expect(
        getTimelineHistoricalYear(story({ time_type: "exact_date", date_value: "1923-10-29" })),
      ).toBe(1923);
    });

    it("returns MAX_SAFE_INTEGER for stories with no usable time info (so they sink)", () => {
      expect(getTimelineHistoricalYear(story({ time_type: "exact_year", year: null }))).toBe(
        Number.MAX_SAFE_INTEGER,
      );
      expect(getTimelineHistoricalYear(null)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
