import { describe, it, expect } from "vitest";
import { bboxCenter } from "../bbox";

describe("bboxCenter", () => {
  it("returns the midpoint of the bbox", () => {
    expect(bboxCenter({ latMin: 41.0, latMax: 41.1, lngMin: 28.9, lngMax: 29.0 })).toEqual({
      lat: 41.05,
      lng: 28.95,
    });
  });

  it("handles negative coordinates", () => {
    expect(bboxCenter({ latMin: -10, latMax: 10, lngMin: -20, lngMax: 20 })).toEqual({
      lat: 0,
      lng: 0,
    });
  });

  it("returns the same point when bbox has zero size", () => {
    expect(bboxCenter({ latMin: 41.0, latMax: 41.0, lngMin: 28.9, lngMax: 28.9 })).toEqual({
      lat: 41.0,
      lng: 28.9,
    });
  });
});
