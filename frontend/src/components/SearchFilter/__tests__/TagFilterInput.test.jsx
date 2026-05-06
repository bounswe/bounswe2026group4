import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TagFilterInput from "../TagFilterInput";

vi.mock("@/services/tagService", () => ({
  searchTags: vi.fn(),
}));

import { searchTags } from "@/services/tagService";

function renderInput(props = {}) {
  return render(<TagFilterInput value={[]} onChange={vi.fn()} {...props} />);
}

describe("TagFilterInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchTags.mockResolvedValue([
      { id: 1, name: "ottoman", story_count: 5 },
      { id: 2, name: "galata", story_count: 3 },
    ]);
  });

  it("renders the Tags label and add button", () => {
    renderInput();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add tag filter/i })).toBeInTheDocument();
  });

  it("shows selected tag chips", () => {
    renderInput({ value: ["ottoman", "galata"] });
    expect(screen.getByText("ottoman")).toBeInTheDocument();
    expect(screen.getByText("galata")).toBeInTheDocument();
  });

  it("shows remove button for each selected chip", () => {
    renderInput({ value: ["ottoman"] });
    expect(screen.getByRole("button", { name: /remove tag ottoman/i })).toBeInTheDocument();
  });

  it("calls onChange when a chip's remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInput({ value: ["ottoman", "galata"], onChange });

    await user.click(screen.getByRole("button", { name: /remove tag ottoman/i }));

    expect(onChange).toHaveBeenCalledWith(["galata"]);
  });

  it("opens dropdown when Add tag button is clicked", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    expect(screen.getByLabelText("Tag filter search")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: /tag suggestions/i })).toBeInTheDocument();
  });

  it("shows suggestions from searchTags", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ottoman/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /galata/i })).toBeInTheDocument();
    });
  });

  it("excludes already-selected tags from suggestions", async () => {
    const user = userEvent.setup();
    renderInput({ value: ["ottoman"] });

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /ottoman/i })).not.toBeInTheDocument();
      expect(screen.getByRole("option", { name: /galata/i })).toBeInTheDocument();
    });
  });

  it("calls onChange with added tag when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInput({ onChange });

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ottoman/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /ottoman/i }));

    expect(onChange).toHaveBeenCalledWith(["ottoman"]);
  });

  it("shows 'No tags found' when searchTags returns empty", async () => {
    searchTags.mockResolvedValue([]);
    const user = userEvent.setup();
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.getByText("No tags found")).toBeInTheDocument();
    });
  });

  it("Enter key selects the first suggestion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInput({ onChange });

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ottoman/i })).toBeInTheDocument();
    });

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(["ottoman"]);
  });

  it("Escape key closes the dropdown", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag filter/i }));
    expect(screen.getByLabelText("Tag filter search")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("Tag filter search")).not.toBeInTheDocument();
  });
});
