import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import SearchFilter from "../SearchFilter";

vi.mock("@/services/tagService", () => ({
  searchTags: vi.fn().mockResolvedValue([]),
}));

function renderSearchFilter(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchFilter />
    </MemoryRouter>
  );
}

describe("SearchFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search bar and filters button", () => {
    renderSearchFilter();
    expect(screen.getByRole("searchbox", { name: /search stories/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^filters$/i })).toBeInTheDocument();
  });

  it("does not show active filters section when no filters are set", () => {
    renderSearchFilter();
    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });

  it("pre-populates search input from URL param q", () => {
    renderSearchFilter(["/?q=galata"]);
    expect(screen.getByRole("searchbox")).toHaveValue("galata");
  });

  it("pre-shows active filter chips from URL params", () => {
    renderSearchFilter(["/?year_from=1900&year_to=2000&location=Galata"]);
    expect(screen.getByText("1900–2000")).toBeInTheDocument();
    expect(screen.getByText("Location: Galata")).toBeInTheDocument();
  });

  it("pre-shows search chip from URL param q", () => {
    renderSearchFilter(["/?q=galata"]);
    expect(screen.getByText('"galata"')).toBeInTheDocument();
  });

  it("removing a chip removes it from the active filters", async () => {
    const user = userEvent.setup();
    renderSearchFilter(["/?q=galata&location=Pera"]);

    expect(screen.getByText('"galata"')).toBeInTheDocument();
    expect(screen.getByText("Location: Pera")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove filter.*"galata"/i }));

    await waitFor(() => {
      expect(screen.queryByText('"galata"')).not.toBeInTheDocument();
    });
    // Other chip should remain
    expect(screen.getByText("Location: Pera")).toBeInTheDocument();
  });

  it("Clear all removes all active filters", async () => {
    const user = userEvent.setup();
    renderSearchFilter(["/?q=galata&year_from=1900&location=Pera"]);

    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear all filters/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
    });
  });

  it("shows year range chip after applying year filters via panel", async () => {
    const user = userEvent.setup();
    renderSearchFilter();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("From year"), "1900");
    await user.type(screen.getByLabelText("To year"), "2000");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByText("1900–2000")).toBeInTheDocument();
    });
  });

  it("shows location chip after applying location filter via panel", async () => {
    const user = userEvent.setup();
    renderSearchFilter();

    await user.click(screen.getByRole("button", { name: /^filters$/i }));
    await user.type(screen.getByLabelText("Location filter"), "Kadıköy");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByText("Location: Kadıköy")).toBeInTheDocument();
    });
  });

  it("shows filter count badge on the Filters button when filters are active", () => {
    renderSearchFilter(["/?year_from=1900&year_to=2000"]);
    // 2 active non-q filters
    expect(screen.getByRole("button", { name: /filters \(2 active\)/i })).toBeInTheDocument();
  });

  it("shows tag chip from URL tags param", () => {
    renderSearchFilter(["/?tags=ottoman"]);
    expect(screen.getByText("ottoman")).toBeInTheDocument();
  });

  it("shows multiple tag chips from URL tags param", () => {
    renderSearchFilter(["/?tags=ottoman,galata"]);
    expect(screen.getByText("ottoman")).toBeInTheDocument();
    expect(screen.getByText("galata")).toBeInTheDocument();
  });

  it("includes tag count in filter badge", () => {
    renderSearchFilter(["/?tags=ottoman,galata"]);
    expect(screen.getByRole("button", { name: /filters \(2 active\)/i })).toBeInTheDocument();
  });

  it("removing a tag chip removes it from active filters", async () => {
    const user = userEvent.setup();
    renderSearchFilter(["/?tags=ottoman,galata"]);

    expect(screen.getByText("ottoman")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove tag filter: ottoman/i }));

    await waitFor(() => {
      expect(screen.queryByText("ottoman")).not.toBeInTheDocument();
    });
    expect(screen.getByText("galata")).toBeInTheDocument();
  });

  it("Clear all also clears tag chips", async () => {
    const user = userEvent.setup();
    renderSearchFilter(["/?tags=ottoman&year_from=1900"]);

    expect(screen.getByText("ottoman")).toBeInTheDocument();
    expect(screen.getByText("From 1900")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear all filters/i }));

    await waitFor(() => {
      expect(screen.queryByText("ottoman")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("From 1900")).not.toBeInTheDocument();
  });

  it("removing the year range chip removes it and clears search input value updates", async () => {
    const user = userEvent.setup();
    renderSearchFilter(["/?year_from=1900&year_to=2000"]);

    expect(screen.getByText("1900–2000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove filter.*1900/i }));

    await waitFor(() => {
      expect(screen.queryByText("1900–2000")).not.toBeInTheDocument();
    });
  });
});
