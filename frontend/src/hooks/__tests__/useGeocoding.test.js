import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/services/geocodingService", () => ({
  geocodeLocation: vi.fn(),
}));

import { geocodeLocation } from "@/services/geocodingService";
import { useGeocoding } from "../useGeocoding";

const ISTANBUL_BBOX = { latMin: 40.8, latMax: 41.3, lngMin: 28.5, lngMax: 29.4 };

describe("useGeocoding", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with null bbox and isLoading false when query is empty", () => {
    const { result } = renderHook(() => useGeocoding(""));
    expect(result.current.bbox).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("sets isLoading true immediately when a non-empty query is provided", () => {
    geocodeLocation.mockResolvedValue(ISTANBUL_BBOX);
    const { result } = renderHook(() => useGeocoding("Istanbul"));
    expect(result.current.isLoading).toBe(true);
  });

  it("geocodes after 600ms debounce and sets bbox", async () => {
    geocodeLocation.mockResolvedValue(ISTANBUL_BBOX);
    const { result } = renderHook(() => useGeocoding("Istanbul"));

    expect(geocodeLocation).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(geocodeLocation).toHaveBeenCalledWith("Istanbul");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.bbox).toEqual(ISTANBUL_BBOX);
  });

  it("sets bbox to null and stops loading when Nominatim returns no result", async () => {
    geocodeLocation.mockResolvedValue(null);
    const { result } = renderHook(() => useGeocoding("xyzunknown"));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.bbox).toBeNull();
  });

  it("sets bbox to null and stops loading on geocoding error (text fallback)", async () => {
    geocodeLocation.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useGeocoding("Istanbul"));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.bbox).toBeNull();
  });

  it("does not fire geocoding before the debounce window", () => {
    geocodeLocation.mockResolvedValue(ISTANBUL_BBOX);
    renderHook(() => useGeocoding("Istanbul"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(geocodeLocation).not.toHaveBeenCalled();
  });

  it("resets bbox and isLoading when query is cleared", () => {
    geocodeLocation.mockResolvedValue(ISTANBUL_BBOX);
    const { result, rerender } = renderHook(({ q }) => useGeocoding(q), {
      initialProps: { q: "Istanbul" },
    });

    rerender({ q: "" });

    expect(result.current.bbox).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("cancels the previous debounce timer when query changes rapidly", () => {
    geocodeLocation.mockResolvedValue(ISTANBUL_BBOX);
    const { rerender } = renderHook(({ q }) => useGeocoding(q), {
      initialProps: { q: "Ist" },
    });

    act(() => { vi.advanceTimersByTime(300); });
    rerender({ q: "Istanbul" });
    act(() => { vi.advanceTimersByTime(300); });

    // Only 600ms have passed since last change — should not have fired yet
    expect(geocodeLocation).not.toHaveBeenCalled();
  });
});
