
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
      onRemove={vi.fn()}
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
});
