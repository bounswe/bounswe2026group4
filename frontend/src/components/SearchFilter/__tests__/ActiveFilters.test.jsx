
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ActiveFilters from "../ActiveFilters";

function renderFilters(props = {}) {
  return render(
    <ActiveFilters
      q=""
      yearFrom=""
      yearTo=""
      location=""
      tags={[]}
      onRemove={vi.fn()}
      onRemoveTag={vi.fn()}
      onClearAll={vi.fn()}
      {...props}
    />
  );
}

describe("ActiveFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no filters are active", () => {
    const { container } = renderFilters();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a chip for the search query", () => {
    renderFilters({ q: "galata" });
    expect(screen.getByText(/"galata"/i)).toBeInTheDocument();
  });

  it("shows a combined year range chip when both yearFrom and yearTo are set", () => {
    renderFilters({ yearFrom: 1900, yearTo: 2000 });
    expect(screen.getByText("1900–2000")).toBeInTheDocument();
  });

  it("shows 'From N' chip when only yearFrom is set", () => {
    renderFilters({ yearFrom: 1900 });
    expect(screen.getByText("From 1900")).toBeInTheDocument();
  });

  it("shows 'To N' chip when only yearTo is set", () => {
    renderFilters({ yearTo: 2000 });
    expect(screen.getByText("To 2000")).toBeInTheDocument();
  });

  it("shows a location chip", () => {
    renderFilters({ location: "Kadıköy" });
    expect(screen.getByText("Location: Kadıköy")).toBeInTheDocument();
  });

  it("shows multiple chips simultaneously", () => {
    renderFilters({ q: "bridge", yearFrom: 1900, yearTo: 2000, location: "Galata" });
    expect(screen.getByText(/"bridge"/)).toBeInTheDocument();
    expect(screen.getByText("1900–2000")).toBeInTheDocument();
    expect(screen.getByText("Location: Galata")).toBeInTheDocument();
  });

  it("shows a Clear all button when any filter is active", () => {
    renderFilters({ q: "test" });
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("calls onRemove('q') when search chip X is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderFilters({ q: "galata", onRemove });

    await user.click(screen.getByRole("button", { name: /remove filter.*"galata"/i }));

    expect(onRemove).toHaveBeenCalledWith("q");
  });

  it("calls onRemove('year_range') when combined year chip X is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderFilters({ yearFrom: 1900, yearTo: 2000, onRemove });

    await user.click(screen.getByRole("button", { name: /remove filter.*1900/i }));

    expect(onRemove).toHaveBeenCalledWith("year_range");
  });

  it("calls onRemove('year_from') when From chip X is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderFilters({ yearFrom: 1900, onRemove });

    await user.click(screen.getByRole("button", { name: /remove filter.*from 1900/i }));

    expect(onRemove).toHaveBeenCalledWith("year_from");
  });

  it("calls onRemove('location') when location chip X is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderFilters({ location: "Galata", onRemove });

    await user.click(screen.getByRole("button", { name: /remove filter.*location: galata/i }));

    expect(onRemove).toHaveBeenCalledWith("location");
  });

  it("calls onClearAll when Clear all button is clicked", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    renderFilters({ q: "test", onClearAll });

    await user.click(screen.getByRole("button", { name: /clear all filters/i }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when tags is empty and no other filters", () => {
    const { container } = renderFilters({ tags: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a chip for each selected tag", () => {
    renderFilters({ tags: ["ottoman", "galata"] });
    expect(screen.getByText("ottoman")).toBeInTheDocument();
    expect(screen.getByText("galata")).toBeInTheDocument();
  });

  it("shows Clear all when only tags are active", () => {
    renderFilters({ tags: ["ottoman"] });
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("calls onRemoveTag with tag name when tag chip X is clicked", async () => {
    const user = userEvent.setup();
    const onRemoveTag = vi.fn();
    renderFilters({ tags: ["ottoman", "galata"], onRemoveTag });

    await user.click(screen.getByRole("button", { name: /remove tag filter: ottoman/i }));

    expect(onRemoveTag).toHaveBeenCalledWith("ottoman");
  });

  it("shows both tag chips and regular filter chips simultaneously", () => {
    renderFilters({ q: "bridge", tags: ["ottoman"], yearFrom: 1900 });
    expect(screen.getByText(/"bridge"/)).toBeInTheDocument();
    expect(screen.getByText("From 1900")).toBeInTheDocument();
    expect(screen.getByText("ottoman")).toBeInTheDocument();
  });

  it("renders a 'Within X km' chip when radiusKm is a whole-km value", () => {
    renderFilters({ radiusKm: 10, hasProximity: true });
    expect(screen.getByText("Within 10 km")).toBeInTheDocument();
  });

  it("formats sub-kilometre radii in metres (500 m option)", () => {
    renderFilters({ radiusKm: 0.5, hasProximity: true });
    expect(screen.getByText("Within 500 m")).toBeInTheDocument();
  });

  it("does not render a proximity chip when radiusKm is null", () => {
    renderFilters({ radiusKm: null });
    expect(screen.queryByText(/^within /i)).not.toBeInTheDocument();
  });

  it("does not render a proximity chip when radiusKm is set but hasProximity is false", () => {
    // e.g. hand-edited URL with radius_km but no latitude/longitude.
    renderFilters({ radiusKm: 10, hasProximity: false });
    expect(screen.queryByText(/^within /i)).not.toBeInTheDocument();
  });

  it("emits the 'proximity' remove key when the radius chip is dismissed", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderFilters({ radiusKm: 1, hasProximity: true, onRemove });

    await user.click(screen.getByRole("button", { name: /remove filter: within 1 km/i }));

    expect(onRemove).toHaveBeenCalledWith("proximity");
  });

  it("renders a 'Has image' chip when hasImage is true", () => {
    renderFilters({ hasImage: true });
    expect(screen.getByText(/has image/i)).toBeInTheDocument();
  });

  it("does not render the 'Has image' chip when hasImage is false / unset", () => {
    renderFilters({});
    expect(screen.queryByText(/has image/i)).not.toBeInTheDocument();
  });

  it("calls onRemove with 'has_image' when the Has-image chip X is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderFilters({ hasImage: true, onRemove });

    await user.click(screen.getByRole("button", { name: /remove filter: has image/i }));
    expect(onRemove).toHaveBeenCalledWith("has_image");
  });
});
