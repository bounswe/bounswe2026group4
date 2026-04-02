import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FilterPanel from "../FilterPanel";

function renderPanel(props = {}) {
  return render(
    <FilterPanel
      yearFrom=""
      yearTo=""
      location=""
      onApply={vi.fn()}
      activeCount={0}
      {...props}
    />
  );
}

describe("FilterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Filters toggle button", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^filters$/i })).toBeInTheDocument();
  });

  it("shows active filter count badge when activeCount > 0", () => {
    renderPanel({ activeCount: 2 });
    expect(screen.getByRole("button", { name: /filters \(2 active\)/i })).toBeInTheDocument();
  });

  it("panel is initially hidden", () => {
    renderPanel();
    expect(screen.queryByRole("region", { name: /filter options/i })).not.toBeInTheDocument();
  });

  it("opens the panel when toggle button is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));

    expect(screen.getByRole("region", { name: /filter options/i })).toBeInTheDocument();
  });

  it("closes the panel after clicking Apply", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(screen.getByRole("region", { name: /filter options/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(screen.queryByRole("region", { name: /filter options/i })).not.toBeInTheDocument();
  });

  it("calls onApply with entered values when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "1900");
    await user.type(screen.getByLabelText("To year"), "2000");
    await user.type(screen.getByLabelText("Location filter"), "Galata");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({ yearFrom: 1900, yearTo: 2000, location: "Galata" });
  });

  it("shows validation error when year is zero or negative", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "-500");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/year must be a positive number/i);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows validation error when yearFrom > yearTo", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "2000");
    await user.type(screen.getByLabelText("To year"), "1900");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/'From' year must not exceed/i);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("resets form and calls onApply with empty values when Reset filters is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ yearFrom: 1900, yearTo: 2000, location: "Galata", onApply });

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: /reset filters/i }));

    expect(onApply).toHaveBeenCalledWith({ yearFrom: "", yearTo: "", location: "" });
  });

  it("initialises form fields from props on mount", async () => {
    const user = userEvent.setup();
    renderPanel({ yearFrom: 1453, yearTo: 1923, location: "Galata" });

    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByLabelText("From year")).toHaveValue(1453);
    expect(screen.getByLabelText("To year")).toHaveValue(1923);
    expect(screen.getByLabelText("Location filter")).toHaveValue("Galata");
  });
});
