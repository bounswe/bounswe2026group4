import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "../api";
import {
  getTimeline,
  getTimelineHistoricalYear,
  storyOverlapsYearWindow,
} from "../timelineService";

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

  it("passes tags array through as-is for paramsSerializer to handle", async () => {
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await getTimeline({ tags: ["nature", "folklore"] });

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", {
      params: { tags: ["nature", "folklore"] },
    });
  });

  it("omits tags when array is empty", async () => {
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await getTimeline({ tags: [] });

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", { params: {} });
  });

  it("passes proximity params through", async () => {
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await getTimeline({ latitude: 41.0, longitude: 28.9, radiusKm: 5 });

    expect(api.get).toHaveBeenCalledWith("/stories/timeline/", {
      params: { latitude: 41.0, longitude: 28.9, radius_km: 5 },
    });
  });

  it("throws on API error", async () => {
    api.get.mockRejectedValue(new Error("Network error"));

    await expect(getTimeline()).rejects.toThrow("Network error");
  });

  describe("has_image filter", () => {
    it("forwards has_image=true to /stories/timeline/ on the primary path", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
      await getTimeline({ hasImage: true });
      expect(api.get).toHaveBeenCalledWith(
        "/stories/timeline/",
        expect.objectContaining({ params: expect.objectContaining({ has_image: true }) }),
      );
    });

    it("omits has_image when the toggle is false (no filter)", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
      await getTimeline({ hasImage: false });
      const params = api.get.mock.calls[0][1].params;
      expect(params).not.toHaveProperty("has_image");
    });

    it("forwards has_image=true to /stories/timeline/ even on the fallback path", async () => {
      api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
      // q triggers the fallback path; has_image must still reach the timeline endpoint.
      await getTimeline({ q: "galata", hasImage: true });
      const params = api.get.mock.calls[0][1].params;
      expect(params).toHaveProperty("has_image", true);
    });
  });

  describe("fallback path (filters not supported by /stories/timeline/)", () => {
    it("routes to /stories/timeline/ when q is set and applies q as client-side filter", async () => {
      api.get.mockResolvedValue({
        data: {
          count: 3,
          next: null,
          previous: null,
          results: [
            story({ id: "match-title", year: 1900, title: "Galata Tower story" }),
            story({ id: "match-location", year: 1950, title: "Other", location_name: "Galata" }),
            story({ id: "no-match", year: 2000, title: "Unrelated" }),
          ],
        },
      });

      const result = await getTimeline({ q: "Galata", page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/timeline/",
        expect.objectContaining({ params: expect.not.objectContaining({ q: expect.anything() }) }),
      );
      expect(result.results.map((s) => s.id)).toEqual(["match-title", "match-location"]);
      expect(result.count).toBe(2);
    });

    it("routes to /stories/timeline/ when location text is set without a bbox and filters client-side", async () => {
      api.get.mockResolvedValue({
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            story({ id: "in-galata", year: 1900, location_name: "Galata District" }),
            story({ id: "elsewhere", year: 1950, location_name: "Kadikoy" }),
          ],
        },
      });

      const result = await getTimeline({ location: "Galata", page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith(
        "/stories/timeline/",
        expect.objectContaining({ params: expect.not.objectContaining({ location: expect.anything() }) }),
      );
      expect(result.results.map((s) => s.id)).toEqual(["in-galata"]);
      expect(result.count).toBe(1);
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
        all.push(story({ id: `s${i}`, year: 1900 + i, location_name: "Galata" }));
      }
      api.get.mockResolvedValue({
        data: { count: 25, next: null, previous: null, results: all },
      });

      const page2 = await getTimeline({ location: "Galata", page: 2, pageSize: 10 });

      expect(page2.count).toBe(25);
      expect(page2.results).toHaveLength(10);
      expect(page2.results[0].id).toBe("s10");
      expect(page2.next).toBe("client-next-page");
      expect(page2.previous).toBe("client-previous-page");

      const page3 = await getTimeline({ location: "Galata", page: 3, pageSize: 10 });
      expect(page3.results).toHaveLength(5);
      expect(page3.next).toBeNull();
    });

    it("requests at most page_size=100 from /stories/timeline/ in the fallback (documenting the cap)", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      await getTimeline({ q: "x", page: 1, pageSize: 10 });

      const params = api.get.mock.calls[0][1].params;
      // The fallback always asks for the cap regardless of the caller's
      // requested pageSize — the slice happens client-side. Stories beyond
      // the 100th in the timeline's historical order are not reachable.
      expect(params.page_size).toBe(100);
    });

    it("count reflects only stories within the fallback fetch window (cap is observable)", async () => {
      // Simulate a corpus where the timeline endpoint hands back 100 results.
      // The view's `count` will read 100, not the true backend total.
      const stories = Array.from({ length: 100 }, (_, i) =>
        story({ id: `s${i}`, year: 1900 + i, title: "Galata story" }),
      );
      api.get.mockResolvedValue({
        data: { count: 999, next: "url-to-page-2", previous: null, results: stories },
      });

      const result = await getTimeline({ q: "Galata", page: 1, pageSize: 10 });
      expect(result.count).toBe(100);
    });
  });

  describe("fallback path year semantics (matches /stories/timeline/ behaviour)", () => {
    it("forwards year_from/year_to to /stories/timeline/ in the fallback", async () => {
      api.get.mockResolvedValue({
        data: { count: 0, next: null, previous: null, results: [] },
      });

      await getTimeline({ q: "Galata", yearFrom: 1870, yearTo: 1880, page: 1, pageSize: 10 });

      // The timeline endpoint handles interval-overlap year semantics, so we
      // forward year params and let the server filter correctly.
      const calledWith = api.get.mock.calls[0][1];
      expect(calledWith.params).toHaveProperty("year_from", 1870);
      expect(calledWith.params).toHaveProperty("year_to", 1880);
    });

    it("server-side year filtering is trusted — results returned by the endpoint are not re-filtered", async () => {
      // The timeline endpoint already applies interval-overlap semantics for
      // decade and exact_date stories. The frontend trusts whatever it returns.
      api.get.mockResolvedValue({
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            story({ id: "d", time_type: "decade", year: 1870, title: "Galata story" }),
            story({ id: "ed", time_type: "exact_date", date_value: "1923-10-29", title: "Galata story" }),
          ],
        },
      });

      const result = await getTimeline({ q: "Galata", yearFrom: 1875, yearTo: 1885, page: 1, pageSize: 10 });
      expect(result.results.map((s) => s.id)).toEqual(["d", "ed"]);
    });
  });

  describe("storyOverlapsYearWindow", () => {
    it("returns true when both bounds are null (no filter)", () => {
      expect(storyOverlapsYearWindow(story({ time_type: "exact_year", year: 1875 }), null, null)).toBe(
        true,
      );
    });

    it("exact_year — point in [yearFrom, yearTo]", () => {
      const s = story({ time_type: "exact_year", year: 1875 });
      expect(storyOverlapsYearWindow(s, 1870, 1880)).toBe(true);
      expect(storyOverlapsYearWindow(s, 1880, 1890)).toBe(false);
      expect(storyOverlapsYearWindow(s, 1860, 1870)).toBe(false);
    });

    it("decade — interval [Y, Y+9] overlaps window (the bug we're fixing)", () => {
      const s = story({ time_type: "decade", year: 1870 });
      // Window 1875-1885 overlaps 1870-1879 → INCLUDED
      expect(storyOverlapsYearWindow(s, 1875, 1885)).toBe(true);
      // Window 1865-1872 overlaps 1870-1879 → INCLUDED
      expect(storyOverlapsYearWindow(s, 1865, 1872)).toBe(true);
      // Window entirely after the decade → EXCLUDED
      expect(storyOverlapsYearWindow(s, 1880, 1890)).toBe(false);
      // Window entirely before the decade → EXCLUDED
      expect(storyOverlapsYearWindow(s, 1850, 1869)).toBe(false);
    });

    it("year_range — interval [year_start, year_end] overlaps window", () => {
      const s = story({ time_type: "year_range", year_start: 1850, year_end: 1900 });
      expect(storyOverlapsYearWindow(s, 1875, 1885)).toBe(true);
      expect(storyOverlapsYearWindow(s, 1820, 1860)).toBe(true);
      expect(storyOverlapsYearWindow(s, 1910, 1920)).toBe(false);
      expect(storyOverlapsYearWindow(s, 1800, 1849)).toBe(false);
    });

    it("exact_date — year extracted from date_value", () => {
      const s = story({ time_type: "exact_date", date_value: "1923-10-29" });
      expect(storyOverlapsYearWindow(s, 1920, 1925)).toBe(true);
      expect(storyOverlapsYearWindow(s, 1924, 1930)).toBe(false);
    });

    it("one-sided window — only yearFrom or only yearTo", () => {
      const s = story({ time_type: "exact_year", year: 1875 });
      expect(storyOverlapsYearWindow(s, 1870, null)).toBe(true);
      expect(storyOverlapsYearWindow(s, 1880, null)).toBe(false);
      expect(storyOverlapsYearWindow(s, null, 1880)).toBe(true);
      expect(storyOverlapsYearWindow(s, null, 1870)).toBe(false);
    });

    it("excludes stories with no usable time info when a window is set", () => {
      expect(storyOverlapsYearWindow(story({ time_type: "exact_year", year: null }), 1870, 1880)).toBe(
        false,
      );
      expect(storyOverlapsYearWindow(null, 1870, 1880)).toBe(false);
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
