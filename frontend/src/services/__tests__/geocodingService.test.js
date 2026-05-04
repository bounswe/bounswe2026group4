import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeLocation, searchLocationSuggestions } from "../geocodingService";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

function mockFetch(data, { ok = true, status = 200 } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("geocodeLocation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for empty query", async () => {
    globalThis.fetch = vi.fn();
    expect(await geocodeLocation("")).toBeNull();
    expect(await geocodeLocation("   ")).toBeNull();
    expect(await geocodeLocation(null)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("calls Nominatim with correct params", async () => {
    mockFetch([]);
    await geocodeLocation("Istanbul");
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain(NOMINATIM_BASE);
    expect(url).toContain("q=Istanbul");
    expect(url).toContain("format=json");
    expect(url).toContain("limit=1");
  });

  it("returns bounding box for a valid result", async () => {
    mockFetch([
      {
        boundingbox: ["40.8027636", "41.3420105", "28.5025972", "29.4580951"],
      },
    ]);

    const result = await geocodeLocation("Istanbul");

    expect(result).toEqual({
      latMin: 40.8027636,
      latMax: 41.3420105,
      lngMin: 28.5025972,
      lngMax: 29.4580951,
    });
  });

  it("returns null when Nominatim returns an empty array", async () => {
    mockFetch([]);
    const result = await geocodeLocation("xyznonexistentplace12345");
    expect(result).toBeNull();
  });

  it("returns null when result has no boundingbox", async () => {
    mockFetch([{ display_name: "Some Place" }]);
    const result = await geocodeLocation("Some Place");
    expect(result).toBeNull();
  });

  it("throws when Nominatim responds with a non-ok status", async () => {
    mockFetch(null, { ok: false, status: 429 });
    await expect(geocodeLocation("Istanbul")).rejects.toThrow("Nominatim request failed: 429");
  });

  it("trims whitespace from query before sending", async () => {
    mockFetch([]);
    await geocodeLocation("  Paris  ");
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("q=Paris");
    expect(url).not.toContain("q=++Paris");
  });
});

describe("searchLocationSuggestions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array for queries shorter than 3 characters", async () => {
    globalThis.fetch = vi.fn();
    expect(await searchLocationSuggestions("")).toEqual([]);
    expect(await searchLocationSuggestions("Is")).toEqual([]);
    expect(await searchLocationSuggestions(null)).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("calls Nominatim with limit=5 and addressdetails=1", async () => {
    mockFetch([]);
    await searchLocationSuggestions("Istanbul");
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("limit=5");
    expect(url).toContain("addressdetails=1");
    expect(url).toContain("q=Istanbul");
  });

  it("returns parsed suggestions with title, subtitle, and bbox", async () => {
    mockFetch([
      {
        place_id: 12345,
        name: "Istanbul",
        display_name: "Istanbul, Marmara Region, Turkey",
        lat: "41.0082",
        lon: "28.9784",
        boundingbox: ["40.8027636", "41.3420105", "28.5025972", "29.4580951"],
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

  it("falls back to first display_name segment when name is absent", async () => {
    mockFetch([
      {
        place_id: 1,
        display_name: "Galata, Beyoğlu, Istanbul, Turkey",
        lat: "41.025",
        lon: "28.974",
        boundingbox: ["41.0", "41.05", "28.97", "28.98"],
      },
    ]);

    const results = await searchLocationSuggestions("Galata");
    expect(results[0].title).toBe("Galata");
    expect(results[0].subtitle).toBe("Beyoğlu, Istanbul, Turkey");
  });

  it("sets bbox to null when boundingbox is missing", async () => {
    mockFetch([
      { place_id: 1, name: "SomePlace", display_name: "SomePlace", lat: "41.0", lon: "28.9" },
    ]);

    const results = await searchLocationSuggestions("SomePlace");
    expect(results[0].bbox).toBeNull();
  });

  it("filters out results with invalid coordinates", async () => {
    mockFetch([
      { place_id: 1, name: "Bad", display_name: "Bad", lat: "invalid", lon: "28.9" },
      { place_id: 2, name: "Good", display_name: "Good", lat: "41.0", lon: "28.9" },
    ]);

    const results = await searchLocationSuggestions("test");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Good");
  });

  it("returns empty array when Nominatim returns no results", async () => {
    mockFetch([]);
    expect(await searchLocationSuggestions("xyzunknown123")).toEqual([]);
  });

  it("throws on non-ok response", async () => {
    mockFetch(null, { ok: false, status: 503 });
    await expect(searchLocationSuggestions("Istanbul")).rejects.toThrow("Nominatim request failed: 503");
  });
});
