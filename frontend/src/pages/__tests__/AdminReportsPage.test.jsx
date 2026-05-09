import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/adminService", () => ({
  listReports: vi.fn(),
  resolveReportWithAction: vi.fn(),
}));
vi.mock("@/services/storyService", () => ({
  getStoryById: vi.fn(),
}));

import { listReports, resolveReportWithAction } from "@/services/adminService";
import { getStoryById } from "@/services/storyService";
import AdminReportsPage from "../admin/AdminReportsPage";

function makeReport(overrides = {}) {
  return {
    id: 1,
    reporter: { id: 2, username: "alice" },
    target_type: "story",
    target_id: 10,
    reason: "spam",
    description: "",
    status: "pending",
    created_at: "2026-05-01T00:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminReportsPage />
    </MemoryRouter>
  );
}

describe("AdminReportsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the loading spinner then the report rows", async () => {
    listReports.mockResolvedValue({ count: 1, results: [makeReport()] });
    renderPage();
    expect(screen.getByTestId("reports-loading")).toBeInTheDocument();
    expect(await screen.findByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/story #10/)).toBeInTheDocument();
  });

  it("filters by status when the dropdown changes", async () => {
    listReports.mockResolvedValue({ count: 0, results: [] });
    renderPage();
    await waitFor(() => expect(listReports).toHaveBeenCalledTimes(1));
    await userEvent.selectOptions(screen.getByLabelText(/status/i), "resolved");
    await waitFor(() =>
      expect(listReports).toHaveBeenLastCalledWith({
        status: "resolved",
        page: 1,
        pageSize: 20,
      })
    );
  });

  it("opens the resolve modal and submits with the selected outcome", async () => {
    listReports.mockResolvedValue({ count: 1, results: [makeReport()] });
    resolveReportWithAction.mockResolvedValue({});
    renderPage();
    await screen.findByText(/alice/);

    await userEvent.click(screen.getByRole("button", { name: /resolve/i }));
    const dialog = await screen.findByRole("alertdialog");

    await userEvent.type(within(dialog).getByLabelText(/note/i), "looked legitimate");
    await userEvent.click(within(dialog).getByRole("button", { name: /^resolve$/i }));

    await waitFor(() =>
      expect(resolveReportWithAction).toHaveBeenCalledWith({
        report: expect.objectContaining({ id: 1 }),
        action: "no_action",
        note: "looked legitimate",
        targetUserId: null,
      })
    );
  });

  it("looks up the story author when banning via a story report", async () => {
    listReports.mockResolvedValue({ count: 1, results: [makeReport()] });
    getStoryById.mockResolvedValue({ id: 10, user: { id: 77, username: "bob" } });
    resolveReportWithAction.mockResolvedValue({});
    renderPage();
    await screen.findByText(/alice/);

    await userEvent.click(screen.getByRole("button", { name: /resolve/i }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByLabelText(/ban user/i));
    await userEvent.click(within(dialog).getByRole("button", { name: /^resolve$/i }));

    await waitFor(() => expect(getStoryById).toHaveBeenCalledWith(10));
    await waitFor(() =>
      expect(resolveReportWithAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "ban_user", targetUserId: 77 })
      )
    );
  });
});
