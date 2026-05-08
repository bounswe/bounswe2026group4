import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/services/geocodingService", () => ({
  searchLocationSuggestions: vi.fn(),
}));

import { searchLocationSuggestions } from "@/services/geocodingService";
import { useLocationSuggestions } from "../useLocationSuggestions";

const ISTANBUL = { id: "1", title: "Istanbul", subtitle: "Turkey", bbox: { latMin: 40.8, latMax: 41.3, lngMin: 28.5, lngMax: 29.4 } };
const GALATA   = { id: "2", title: "Galata",   subtitle: "Istanbul, Turkey", bbox: { latMin: 41.02, latMax: 41.03, lngMin: 28.97, lngMax: 28.98 } };

describe("useLocationSuggestions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty suggestions, isLoading false, hasSearched false", () => {
    const { result } = renderHook(() => useLocationSuggestions(""));
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasSearched).toBe(false);
  });

  it("does not fire for queries shorter than 3 characters", () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    renderHook(() => useLocationSuggestions("Is"));

    act(() => { vi.advanceTimersByTime(300); });

    expect(searchLocationSuggestions).not.toHaveBeenCalled();
  });

  it("sets isLoading true immediately once query reaches 3 chars", () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { result } = renderHook(() => useLocationSuggestions("Ist"));
    expect(result.current.isLoading).toBe(true);
  });

  it("fetches and returns suggestions after 300ms debounce, flips hasSearched true", async () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL, GALATA]);
    const { result } = renderHook(() => useLocationSuggestions("Istanbul"));

    await act(async () => { vi.advanceTimersByTime(300); });

    expect(searchLocationSuggestions).toHaveBeenCalledWith("Istanbul");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasSearched).toBe(true);
    expect(result.current.suggestions).toEqual([ISTANBUL, GALATA]);
  });

  it("returns empty array and stops loading when service returns nothing", async () => {
    searchLocationSuggestions.mockResolvedValue([]);
    const { result } = renderHook(() => useLocationSuggestions("xyzunknown"));

    await act(async () => { vi.advanceTimersByTime(300); });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns empty array and stops loading on fetch error", async () => {
    searchLocationSuggestions.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useLocationSuggestions("Istanbul"));

    await act(async () => { vi.advanceTimersByTime(300); });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("cancels pending timer when query changes rapidly", () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { rerender } = renderHook(({ q }) => useLocationSuggestions(q), {
      initialProps: { q: "Ist" },
    });

    act(() => { vi.advanceTimersByTime(200); });
    rerender({ q: "Istanbul" });
    act(() => { vi.advanceTimersByTime(200); });

    expect(searchLocationSuggestions).not.toHaveBeenCalled();
  });

  it("clears suggestions and isLoading when query is cleared", () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { result, rerender } = renderHook(({ q }) => useLocationSuggestions(q), {
      initialProps: { q: "Istanbul" },
    });

    rerender({ q: "" });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("cancel() empties the list and clears isLoading/hasSearched", async () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { result } = renderHook(() => useLocationSuggestions("Istanbul"));

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.hasSearched).toBe(true);

    act(() => { result.current.cancel(); });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasSearched).toBe(false);
  });

  it("cancel() aborts an in-flight debounce so the search never fires", async () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { result } = renderHook(() => useLocationSuggestions("Istanbul"));

    // 200 ms in: still inside the 300 ms debounce window.
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.isLoading).toBe(true);

    act(() => { result.current.cancel(); });

    // Drain the rest of the original debounce + buffer.
    await act(async () => { vi.advanceTimersByTime(500); });

    expect(searchLocationSuggestions).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toEqual([]);
  });

  it("cancel(query) suppresses the next search for that exact query (re-fetch guard for suggestion-select)", async () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { result, rerender } = renderHook(({ q }) => useLocationSuggestions(q), {
      initialProps: { q: "Ist" },
    });

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(searchLocationSuggestions).toHaveBeenCalledTimes(1);

    // Simulate suggestion select: cancel + write the chosen title back into the query.
    act(() => { result.current.cancel("Istanbul"); });
    rerender({ q: "Istanbul" });

    await act(async () => { vi.advanceTimersByTime(500); });

    expect(searchLocationSuggestions).toHaveBeenCalledTimes(1);
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("cancel(query) only suppresses the matching query — typing something else still searches", async () => {
    searchLocationSuggestions.mockResolvedValue([ISTANBUL]);
    const { result, rerender } = renderHook(({ q }) => useLocationSuggestions(q), {
      initialProps: { q: "Ist" },
    });

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(searchLocationSuggestions).toHaveBeenCalledTimes(1);

    act(() => { result.current.cancel("Istanbul"); });
    // User keeps typing instead — query becomes something different.
    rerender({ q: "Galata" });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(searchLocationSuggestions).toHaveBeenCalledTimes(2);
    expect(searchLocationSuggestions).toHaveBeenLastCalledWith("Galata");
  });
});
