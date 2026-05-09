import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/storyService", () => ({ getStories: vi.fn() }));
vi.mock("@/services/adminService", () => ({ removeStory: vi.fn() }));

import { getStories } from "@/services/storyService";
import { removeStory } from "@/services/adminService";
import AdminStoriesPage from "../admin/AdminStoriesPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminStoriesPage />
    </MemoryRouter>
  );
}

describe("AdminStoriesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads stories on mount and shows them", async () => {
    getStories.mockResolvedValue({
      count: 1,
      results: [{ id: 1, title: "First Story", location_name: "Istanbul", user: { username: "ada" } }],
    });
    renderPage();
    expect(await screen.findByText("First Story")).toBeInTheDocument();
    expect(screen.getByText("ada")).toBeInTheDocument();
  });

  it("submits the search query and refetches", async () => {
    getStories.mockResolvedValue({ count: 0, results: [] });
    renderPage();
    await waitFor(() => expect(getStories).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/search stories/i), "ottoman");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(getStories).toHaveBeenLastCalledWith({ q: "ottoman", page: 1, pageSize: 12 })
    );
  });

  it("requires a reason and removes the story after confirmation", async () => {
    getStories.mockResolvedValue({
      count: 1,
      results: [{ id: 5, title: "Bad Story", location_name: "X", user: { username: "u" } }],
    });
    removeStory.mockResolvedValue();
    renderPage();
    await screen.findByText("Bad Story");

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    const dialog = await screen.findByRole("alertdialog");

    const confirm = within(dialog).getByRole("button", { name: /^remove$/i });
    expect(confirm).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText(/reason/i), "violates policy");
    await userEvent.click(confirm);

    await waitFor(() => expect(removeStory).toHaveBeenCalledWith(5, "violates policy"));
  });
});
