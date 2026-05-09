import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/tagService", () => ({ searchTags: vi.fn() }));
vi.mock("@/services/adminService", () => ({ deleteTag: vi.fn() }));

import { searchTags } from "@/services/tagService";
import { deleteTag } from "@/services/adminService";
import AdminTagsPage from "../admin/AdminTagsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminTagsPage />
    </MemoryRouter>
  );
}

describe("AdminTagsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders tags with their story counts", async () => {
    searchTags.mockResolvedValue([
      { id: 1, name: "war", is_predefined: true, story_count: 5 },
      { id: 2, name: "peace", is_predefined: false, story_count: 0 },
    ]);
    renderPage();
    expect(await screen.findByText("war")).toBeInTheDocument();
    expect(screen.getByText("peace")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("filters via search input", async () => {
    searchTags.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(searchTags).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/search tags/i), "ottoman");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(searchTags).toHaveBeenLastCalledWith("ottoman"));
  });

  it("removes a tag after confirmation", async () => {
    searchTags.mockResolvedValue([{ id: 9, name: "obsolete", is_predefined: false, story_count: 0 }]);
    deleteTag.mockResolvedValue();
    renderPage();
    await screen.findByText("obsolete");

    await userEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^remove$/i }));

    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith(9));
  });
});
