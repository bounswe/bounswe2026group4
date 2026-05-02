import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/tagService", () => ({
  searchTags: vi.fn(),
  createOrGetTag: vi.fn(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
}));

import { searchTags, createOrGetTag } from "@/services/tagService";
import TagInput from "../TagInput";
import { toSlug, getTagColorClass } from "@/utils/tagUtils";

function renderInput(props = {}) {
  const onChange = props.onChange ?? vi.fn();
  const value = props.value ?? [];
  render(
    <MemoryRouter>
      <TagInput value={value} onChange={onChange} {...props} />
    </MemoryRouter>
  );
  return { onChange };
}

describe("toSlug", () => {
  it("lowercases text", () => {
    expect(toSlug("Ottoman")).toBe("ottoman");
  });

  it("replaces spaces with hyphens", () => {
    expect(toSlug("ottoman era")).toBe("ottoman-era");
  });

  it("removes non-alphanumeric characters", () => {
    expect(toSlug("ottoman! era@")).toBe("ottoman-era");
  });

  it("collapses multiple hyphens", () => {
    expect(toSlug("a--b")).toBe("a-b");
  });

  it("strips leading/trailing hyphens", () => {
    expect(toSlug("-hello-")).toBe("hello");
  });
});

describe("getTagColorClass", () => {
  it("returns a non-empty class string", () => {
    expect(getTagColorClass("ottoman-era")).toMatch(/bg-\w+/);
  });

  it("returns the same color for the same tag name", () => {
    expect(getTagColorClass("culture")).toBe(getTagColorClass("culture"));
  });
});

describe("TagInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchTags.mockResolvedValue([]);
    createOrGetTag.mockResolvedValue({ id: 99, name: "new-tag", story_count: 0 });
  });

  it("renders the Add tag button when fewer than 3 tags are selected", () => {
    renderInput();
    expect(screen.getByRole("button", { name: /add tag/i })).toBeInTheDocument();
  });

  it("hides the Add tag button when 3 tags are selected", () => {
    renderInput({
      value: [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
        { id: 3, name: "c" },
      ],
    });
    expect(screen.queryByRole("button", { name: /add tag/i })).not.toBeInTheDocument();
  });

  it("opens the panel and focuses the search input when Add tag is clicked", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag/i }));

    expect(screen.getByRole("textbox", { name: /tag search/i })).toBeInTheDocument();
  });

  it("fetches all tags immediately when the panel opens", async () => {
    const user = userEvent.setup();
    searchTags.mockResolvedValue([
      { id: 1, name: "ottoman-era", story_count: 5 },
    ]);
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag/i }));

    await waitFor(() => {
      expect(searchTags).toHaveBeenCalledWith("");
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ottoman-era/i })).toBeInTheDocument();
    });
  });

  it("filters the list as the user types", async () => {
    const user = userEvent.setup();
    searchTags
      .mockResolvedValueOnce([
        { id: 1, name: "ottoman-era", story_count: 5 },
        { id: 2, name: "culture", story_count: 3 },
      ])
      .mockResolvedValue([{ id: 1, name: "ottoman-era", story_count: 5 }]);

    renderInput();
    await user.click(screen.getByRole("button", { name: /add tag/i }));
    await waitFor(() => screen.getByRole("option", { name: /ottoman-era/i }));

    await user.type(screen.getByRole("textbox", { name: /tag search/i }), "ottoman");

    await waitFor(() => {
      expect(searchTags).toHaveBeenCalledWith("ottoman");
    });
  });

  it("calls onChange with the selected tag when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    searchTags.mockResolvedValue([{ id: 1, name: "ottoman-era", story_count: 3 }]);
    renderInput({ onChange });

    await user.click(screen.getByRole("button", { name: /add tag/i }));
    await waitFor(() => screen.getByRole("option", { name: /ottoman-era/i }));

    await user.click(screen.getByRole("option", { name: /ottoman-era/i }));

    expect(onChange).toHaveBeenCalledWith([{ id: 1, name: "ottoman-era", story_count: 3 }]);
  });

  it("shows a Create option for text with no exact match", async () => {
    const user = userEvent.setup();
    searchTags.mockResolvedValue([]);
    renderInput();

    await user.click(screen.getByRole("button", { name: /add tag/i }));
    await user.type(screen.getByRole("textbox", { name: /tag search/i }), "my new tag");

    await waitFor(() => {
      expect(screen.getByTestId("create-option")).toHaveTextContent("my-new-tag");
    });
  });

  it("auto-formats to slug and calls createOrGetTag when Create is clicked", async () => {
    const user = userEvent.setup();
    searchTags.mockResolvedValue([]);
    createOrGetTag.mockResolvedValue({ id: 5, name: "my-new-tag", story_count: 0 });
    const onChange = vi.fn();
    renderInput({ onChange });

    await user.click(screen.getByRole("button", { name: /add tag/i }));
    await user.type(screen.getByRole("textbox", { name: /tag search/i }), "My New Tag");
    await waitFor(() => screen.getByTestId("create-option"));

    await user.click(screen.getByTestId("create-option"));

    await waitFor(() => expect(createOrGetTag).toHaveBeenCalledWith("my-new-tag"));
    expect(onChange).toHaveBeenCalledWith([{ id: 5, name: "my-new-tag", story_count: 0 }]);
  });

  it("closes the panel after the 3rd tag is added", async () => {
    const user = userEvent.setup();
    searchTags.mockResolvedValue([{ id: 3, name: "war", story_count: 1 }]);
    const onChange = vi.fn();
    renderInput({
      value: [{ id: 1, name: "a" }, { id: 2, name: "b" }],
      onChange,
    });

    await user.click(screen.getByRole("button", { name: /add tag/i }));
    await waitFor(() => screen.getByRole("option", { name: /war/i }));

    await user.click(screen.getByRole("option", { name: /war/i }));

    expect(onChange).toHaveBeenCalledWith([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "war", story_count: 1 },
    ]);
    // Panel closes — search input disappears
    expect(screen.queryByRole("textbox", { name: /tag search/i })).not.toBeInTheDocument();
  });

  it("renders selected tags as chips with a remove button", () => {
    renderInput({ value: [{ id: 1, name: "ottoman-era", story_count: 3 }] });
    expect(screen.getByText("ottoman-era")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove ottoman-era/i })).toBeInTheDocument();
  });

  it("calls onChange without the removed tag when X is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInput({
      value: [
        { id: 1, name: "ottoman-era" },
        { id: 2, name: "culture" },
      ],
      onChange,
    });

    await user.click(screen.getByRole("button", { name: /remove ottoman-era/i }));

    expect(onChange).toHaveBeenCalledWith([{ id: 2, name: "culture" }]);
  });

  it("excludes already-selected tags from the suggestion list", async () => {
    const user = userEvent.setup();
    const alreadySelected = { id: 1, name: "ottoman-era", story_count: 3 };
    searchTags.mockResolvedValue([alreadySelected, { id: 2, name: "culture", story_count: 1 }]);
    renderInput({ value: [alreadySelected] });

    await user.click(screen.getByRole("button", { name: /add tag/i }));
    await waitFor(() => screen.getByRole("option", { name: /culture/i }));

    expect(screen.queryByRole("option", { name: /ottoman-era/i })).not.toBeInTheDocument();
  });
});
