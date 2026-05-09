import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/userService", () => ({ getPublicProfile: vi.fn() }));
vi.mock("@/services/adminService", () => ({ banUser: vi.fn() }));

import { getPublicProfile } from "@/services/userService";
import { banUser } from "@/services/adminService";
import AdminUsersPage from "../admin/AdminUsersPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>
  );
}

describe("AdminUsersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up a user by ID and renders their info", async () => {
    getPublicProfile.mockResolvedValue({ id: 12, username: "carol", is_active: true });
    renderPage();
    await userEvent.type(screen.getByLabelText(/user id/i), "12");
    await userEvent.click(screen.getByRole("button", { name: /look up/i }));
    expect(await screen.findByText(/carol/)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("shows an error when the user is not found", async () => {
    getPublicProfile.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    await userEvent.type(screen.getByLabelText(/user id/i), "999");
    await userEvent.click(screen.getByRole("button", { name: /look up/i }));
    expect(await screen.findByText(/user not found/i)).toBeInTheDocument();
  });

  it("bans a user after confirmation", async () => {
    getPublicProfile.mockResolvedValue({ id: 7, username: "dave", is_active: true });
    banUser.mockResolvedValue({ id: 7, is_active: false });
    renderPage();

    await userEvent.type(screen.getByLabelText(/user id/i), "7");
    await userEvent.click(screen.getByRole("button", { name: /look up/i }));
    await screen.findByText(/dave/);

    await userEvent.click(screen.getByRole("button", { name: /ban user/i }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^ban$/i }));

    await waitFor(() => expect(banUser).toHaveBeenCalledWith(7));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /already banned/i })).toBeDisabled()
    );
  });
});
