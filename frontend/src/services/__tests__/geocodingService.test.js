import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeLocation, searchLocationSuggestions, clearCache } from "../geocodingService";

vi.mock("../api", () => ({
  default: { get: vi.fn() },
}));

import api from "../api";

function mockGet(data, { ok = true, status = 200 } = {}) {
  if (ok) {
    api.get.mockResolvedValue({ data, status });
  } else {
    const err = Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status },
    });
    api.get.mockRejectedValue(err);
  }
}

describe("geocodeLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  it("returns null for empty query", async () => {
    expect(await geocodeLocation("")).toBeNull();
    expect(await geocodeLocation("   ")).toBeNull();
    expect(await geocodeLocation(null)).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("calls the backend proxy with correct params", async () => {
    mockGet(null);
    await geocodeLocation("Istanbul");
    expect(api.get).toHaveBeenCalledOnce();
    expect(api.get).toHaveBeenCalledWith("/geocode/", { params: { q: "Istanbul" } });
  });

  it("returns bounding box for a valid result", async () => {
    mockGet({ lat_min: 40.8027636, lat_max: 41.3420105, lng_min: 28.5025972, lng_max: 29.4580951 });

    const result = await geocodeLocation("Istanbul");

    expect(result).toEqual({
      latMin: 40.8027636,
      latMax: 41.3420105,
      lngMin: 28.5025972,
      lngMax: 29.4580951,
    });
  });

  it("returns null when backend returns null", async () => {
    mockGet(null);
    const result = await geocodeLocation("xyznonexistentplace12345");
    expect(result).toBeNull();
  });

  it("trims whitespace from query before sending", async () => {
    mockGet(null);
    await geocodeLocation("  Paris  ");
    expect(api.get).toHaveBeenCalledWith("/geocode/", { params: { q: "Paris" } });
  });

  it("caches results and does not call the backend twice for the same query", async () => {
    mockGet({ lat_min: 40.8, lat_max: 41.3, lng_min: 28.5, lng_max: 29.4 });
    await geocodeLocation("Istanbul");
    await geocodeLocation("Istanbul");
    expect(api.get).toHaveBeenCalledOnce();
  });

  it("throws when backend responds with an error", async () => {
    mockGet(null, { ok: false, status: 503 });
    await expect(geocodeLocation("Istanbul")).rejects.toThrow();
  });
});

describe("searchLocationSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  it("returns empty array for queries shorter than 3 characters", async () => {
    expect(await searchLocationSuggestions("")).toEqual([]);
    expect(await searchLocationSuggestions("Is")).toEqual([]);
    expect(await searchLocationSuggestions(null)).toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("calls the backend proxy with correct params", async () => {
    mockGet([]);
    await searchLocationSuggestions("Istanbul");
    expect(api.get).toHaveBeenCalledWith("/geocode/suggestions/", { params: { q: "Istanbul" } });
  });

  it("returns parsed suggestions with title, subtitle, and bbox", async () => {
    mockGet([
      {
        id: "12345",
        title: "Istanbul",
        subtitle: "Marmara Region, Turkey",
        bbox: { lat_min: 40.8027636, lat_max: 41.3420105, lng_min: 28.5025972, lng_max: 29.4580951 },
      },
    ]);

    const results = await searchLocationSuggestions("Istanbul");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "12345",
      title: "Istanbul",
      subtitle: "Marmara Region, Turkey",
      bbox: { latMin: 40.8027636, latMax: 41.3420105, lngMin: 28.5025972, lngMax: 29.4580951 },
    });
  });

  it("sets bbox to null when backend returns null bbox", async () => {
    mockGet([{ id: "1", title: "SomePlace", subtitle: null, bbox: null }]);

    const results = await searchLocationSuggestions("SomePlace");
    expect(results[0].bbox).toBeNull();
  });

  it("sets subtitle to undefined when backend returns null subtitle", async () => {
    mockGet([{ id: "1", title: "SomePlace", subtitle: null, bbox: null }]);

    const results = await searchLocationSuggestions("SomePlace");
    expect(results[0].subtitle).toBeUndefined();
  });

  it("returns empty array when backend returns no results", async () => {
    mockGet([]);
    expect(await searchLocationSuggestions("xyzunknown123")).toEqual([]);
  });

  it("caches results and does not call the backend twice for the same query", async () => {
    mockGet([]);
    await searchLocationSuggestions("Istanbul");
    await searchLocationSuggestions("Istanbul");
    expect(api.get).toHaveBeenCalledOnce();
  });

  it("throws on backend error", async () => {
    mockGet(null, { ok: false, status: 503 });
    await expect(searchLocationSuggestions("Istanbul")).rejects.toThrow();
  });
});
