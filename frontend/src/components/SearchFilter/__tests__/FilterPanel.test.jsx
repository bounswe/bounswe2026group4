import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/useLocationSuggestions", () => ({
  useLocationSuggestions: vi.fn(() => ({ suggestions: [], isLoading: false, clearSuggestions: vi.fn() })),
}));

import FilterPanel from "../FilterPanel";

vi.mock("@/services/tagService", () => ({
  searchTags: vi.fn().mockResolvedValue([
    { id: 1, name: "ottoman", story_count: 5 },
    { id: 2, name: "galata", story_count: 3 },
  ]),
}));

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
    await user.clear(screen.getByLabelText("From year"));
    await user.type(screen.getByLabelText("From year"), "1900");
    await user.clear(screen.getByLabelText("To year"));
    await user.type(screen.getByLabelText("To year"), "2000");
    await user.type(screen.getByLabelText("Location filter"), "Galata");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({ yearFrom: 1900, yearTo: 2000, location: "Galata", latMin: null, latMax: null, lngMin: null, lngMax: null, tags: [] });
  });


  it("shows validation error when yearFrom > yearTo", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.clear(screen.getByLabelText("From year"));
    await user.type(screen.getByLabelText("From year"), "2000");
    await user.clear(screen.getByLabelText("To year"));
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

    expect(onApply).toHaveBeenCalledWith({ yearFrom: "", yearTo: "", location: "",  latMin: null, latMax: null, lngMin: null, lngMax: null, tags: [] });
  });

  it("shows tag section when panel is open", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));

    expect(screen.getByRole("button", { name: /add tag filter/i })).toBeInTheDocument();
  });

  it("calls onApply with selected tags when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ tags: ["ottoman"], onApply });

    await user.click(screen.getByRole("button", { name: /^filters/i }));
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["ottoman"] })
    );
  });

  it("opens tag dropdown and shows suggestions", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.getByRole("listbox", { name: /tag suggestions/i })).toBeInTheDocument();
    });
  });

  it("selecting a tag suggestion adds it to the local tags", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ottoman/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /ottoman/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /remove tag ottoman/i })).toBeInTheDocument();
    });
  });

  it("initialises form fields from props on mount", async () => {
    const user = userEvent.setup();
    renderPanel({ yearFrom: 1453, yearTo: 1923, location: "Galata" });

    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByLabelText("From year")).toHaveValue(1453);
    expect(screen.getByLabelText("To year")).toHaveValue(1923);
    expect(screen.getByLabelText("Location filter")).toHaveValue("Galata");
  });

  it("preserves bbox props in onApply when user only changes year without re-typing location", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const bbox = { latMin: 40.8, latMax: 41.3, lngMin: 28.5, lngMax: 29.4 };
    renderPanel({ location: "Istanbul", ...bbox, onApply });

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.type(screen.getByLabelText("From year"), "1900");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ location: "Istanbul", latMin: 40.8, latMax: 41.3, lngMin: 28.5, lngMax: 29.4 })
    );
  });

  it("year fields are empty on first open (placeholder visible)", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));

    expect(screen.getByLabelText("From year")).toHaveValue(null);
    expect(screen.getByLabelText("To year")).toHaveValue(null);
  });

  it("both inputs have min=1000 and max=2030", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));

    expect(screen.getByLabelText("From year")).toHaveAttribute("min", "1000");
    expect(screen.getByLabelText("To year")).toHaveAttribute("min", "1000");
    expect(screen.getByLabelText("From year")).toHaveAttribute("max", "2030");
    expect(screen.getByLabelText("To year")).toHaveAttribute("max", "2030");
  });

  it("ArrowUp on empty From year sets it to 1980", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "{ArrowUp}");

    expect(screen.getByLabelText("From year")).toHaveValue(1980);
  });

  it("ArrowUp on empty To year sets it to 2026", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("To year"), "{ArrowUp}");

    expect(screen.getByLabelText("To year")).toHaveValue(2026);
  });

  it("shows validation error when year is below 1000", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "500");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/1000 or later/i);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("clamps typed year above 2030 to 2030 on From year field", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "2050");

    expect(screen.getByLabelText("From year")).toHaveValue(2030);
  });

  it("clamps typed year above 2030 to 2030 on To year field", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("To year"), "3000");

    expect(screen.getByLabelText("To year")).toHaveValue(2030);
  });

  it("does not clamp years within valid range", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "2020");

    expect(screen.getByLabelText("From year")).toHaveValue(2020);
  });
});
