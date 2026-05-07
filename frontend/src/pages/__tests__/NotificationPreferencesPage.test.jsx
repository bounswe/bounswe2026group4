import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/notificationService", () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn(), default: vi.fn() };
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: mockToast, dismiss: vi.fn() }),
}));

import {
  getPreferences,
  updatePreferences,
} from "@/services/notificationService";
import NotificationPreferencesPage from "@/pages/NotificationPreferencesPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationPreferencesPage />
    </MemoryRouter>
  );
}

describe("NotificationPreferencesPage", () => {
  beforeEach(() => {
    getPreferences.mockReset();
    updatePreferences.mockReset();
    mockToast.error.mockReset();
  });

  it("loads preferences on mount and renders all 8 type toggles plus master mute", async () => {
    getPreferences.mockResolvedValue({
      notifications_muted: false,
      preferences: {
        new_like: true,
        new_comment: false,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Notification preferences/i)).toBeInTheDocument();
    });

    // Master mute + 8 per-type toggles
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(9);

    expect(screen.getByText(/Stop all notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/New comments on your stories/i)).toBeInTheDocument();
    expect(screen.getByText(/New likes on your stories/i)).toBeInTheDocument();

    // new_like is true → checked; new_comment is false → unchecked
    expect(screen.getByLabelText(/New likes on your stories/i)).toBeChecked();
    expect(screen.getByLabelText(/New comments on your stories/i)).not.toBeChecked();
  });

  it("calls updatePreferences when a per-type toggle is changed", async () => {
    const user = userEvent.setup();
    getPreferences.mockResolvedValue({
      notifications_muted: false,
      preferences: { new_like: true },
    });
    updatePreferences.mockResolvedValue({
      notifications_muted: false,
      preferences: { new_like: false },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/New likes on your stories/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/New likes on your stories/i));

    expect(updatePreferences).toHaveBeenCalledWith({ new_like: false });
  });

  it("toggling master mute disables per-type toggles and sends notifications_muted patch", async () => {
    const user = userEvent.setup();
    getPreferences.mockResolvedValue({
      notifications_muted: false,
      preferences: {},
    });
    updatePreferences.mockResolvedValue({
      notifications_muted: true,
      preferences: {},
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Stop all notifications/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/Stop all notifications/i));

    expect(updatePreferences).toHaveBeenCalledWith({
      notifications_muted: true,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/New likes on your stories/i)).toBeDisabled();
    });
  });

  it("rolls back optimistic state and shows a toast on save failure", async () => {
    const user = userEvent.setup();
    getPreferences.mockResolvedValue({
      notifications_muted: false,
      preferences: { new_like: true },
    });
    updatePreferences.mockRejectedValue({
      response: { data: { detail: "Server is angry" } },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/New likes on your stories/i)).toBeChecked();
    });

    await user.click(screen.getByLabelText(/New likes on your stories/i));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Server is angry");
    });
    expect(screen.getByLabelText(/New likes on your stories/i)).toBeChecked();
  });

  it("shows error state when initial load fails", async () => {
    getPreferences.mockRejectedValue({
      response: { data: { detail: "Could not fetch" } },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Could not fetch/i)).toBeInTheDocument();
    });
  });
});
