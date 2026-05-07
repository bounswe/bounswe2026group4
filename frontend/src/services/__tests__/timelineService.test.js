import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "../api";
import { getTimeline } from "../timelineService";

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
});
