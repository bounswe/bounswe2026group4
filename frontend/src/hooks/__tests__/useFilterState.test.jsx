import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { useFilterState } from "../useFilterState";

function makeWrapper(initialEntries = ["/"]) {
  return function Wrapper({ children }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useFilterState", () => {
  it("returns default values when URL has no params", () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: makeWrapper() });

    expect(result.current.q).toBe("");
    expect(result.current.yearFrom).toBe("");
    expect(result.current.yearTo).toBe("");
    expect(result.current.location).toBe("");
    expect(result.current.page).toBe(1);
    expect(result.current.tags).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("parses URL params correctly", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?q=galata&year_from=1900&year_to=2000&location=Pera&page=3"]),
    });

    expect(result.current.q).toBe("galata");
    expect(result.current.yearFrom).toBe(1900);
    expect(result.current.yearTo).toBe(2000);
    expect(result.current.location).toBe("Pera");
    expect(result.current.page).toBe(3);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("parses tags from URL as an array", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?tags=galata,ottoman"]),
    });

    expect(result.current.tags).toEqual(["galata", "ottoman"]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("hasActiveFilters is true when only tags are set", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?tags=history"]),
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("setFilters with tags array joins them as comma-separated in URL", () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: makeWrapper() });

    act(() => {
      result.current.setFilters({ tags: ["galata", "ottoman"] });
    });

    expect(result.current.tags).toEqual(["galata", "ottoman"]);
  });

  it("setFilters with empty tags array removes the param", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?tags=galata"]),
    });

    act(() => {
      result.current.setFilters({ tags: [] });
    });

    expect(result.current.tags).toEqual([]);
  });

  it("removeTag removes a single tag and keeps others", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?tags=galata,ottoman&page=2"]),
    });

    act(() => {
      result.current.removeTag("galata");
    });

    expect(result.current.tags).toEqual(["ottoman"]);
    expect(result.current.page).toBe(1);
  });

  it("removeTag deletes the tags param when the last tag is removed", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?tags=galata"]),
    });

    act(() => {
      result.current.removeTag("galata");
    });

    expect(result.current.tags).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("setFilters updates URL params", () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: makeWrapper() });

    act(() => {
      result.current.setFilters({ q: "istanbul" });
    });

    expect(result.current.q).toBe("istanbul");
  });

  it("setFilters resets page to 1 when non-page params change", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?page=5"]),
    });

    expect(result.current.page).toBe(5);

    act(() => {
      result.current.setFilters({ q: "galata" });
    });

    expect(result.current.page).toBe(1);
  });

  it("setFilters does NOT reset page when only page changes", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?q=galata&page=1"]),
    });

    act(() => {
      result.current.setFilters({ page: 3 });
    });

    expect(result.current.page).toBe(3);
    expect(result.current.q).toBe("galata");
  });

  it("removeFilter removes a single param and resets page", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?q=galata&location=Pera&page=2"]),
    });

    act(() => {
      result.current.removeFilter("q");
    });

    expect(result.current.q).toBe("");
    expect(result.current.location).toBe("Pera");
    expect(result.current.page).toBe(1);
  });

  it("clearAll removes all params including tags", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?q=galata&year_from=1900&location=Pera&tags=ottoman&page=3"]),
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.q).toBe("");
    expect(result.current.yearFrom).toBe("");
    expect(result.current.location).toBe("");
    expect(result.current.tags).toEqual([]);
    expect(result.current.page).toBe(1);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("setFilters removes param when value is empty string", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?q=galata"]),
    });

    act(() => {
      result.current.setFilters({ q: "" });
    });

    expect(result.current.q).toBe("");
  });

  it("hasActiveFilters is true when any filter param is set", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?year_from=1900"]),
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("parses bbox query params as numbers", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?lat_min=40.9&lat_max=41.1&lng_min=28.9&lng_max=29.1"]),
    });

    expect(result.current.latMin).toBe(40.9);
    expect(result.current.latMax).toBe(41.1);
    expect(result.current.lngMin).toBe(28.9);
    expect(result.current.lngMax).toBe(29.1);
  });

  it("returns null for bbox params when absent from URL", () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: makeWrapper() });

    expect(result.current.latMin).toBeNull();
    expect(result.current.latMax).toBeNull();
    expect(result.current.lngMin).toBeNull();
    expect(result.current.lngMax).toBeNull();
  });

  it("parses proximity query params as numbers", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?latitude=41.0082&longitude=28.9784&radius_km=10"]),
    });

    expect(result.current.latitude).toBe(41.0082);
    expect(result.current.longitude).toBe(28.9784);
    expect(result.current.radiusKm).toBe(10);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("returns null for proximity params when absent from URL", () => {
    const { result } = renderHook(() => useFilterState(), { wrapper: makeWrapper() });

    expect(result.current.latitude).toBeNull();
    expect(result.current.longitude).toBeNull();
    expect(result.current.radiusKm).toBeNull();
  });

  it("does not flag proximity as active when only some of latitude/longitude/radiusKm are present", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: makeWrapper(["/?latitude=41.0&longitude=28.9"]),
    });

    expect(result.current.latitude).toBe(41.0);
    expect(result.current.longitude).toBe(28.9);
    expect(result.current.radiusKm).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);
  });
});
