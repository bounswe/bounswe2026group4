import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ReportModal from "../ReportModal";

vi.mock("@/services/reportService", () => ({
  reportContent: vi.fn(),
}));

import { reportContent } from "@/services/reportService";

function renderModal(props = {}) {
  const defaults = {
    isOpen: true,
    onClose: vi.fn(),
    targetType: "story",
    targetId: 1,
  };
  return render(<ReportModal {...defaults} {...props} />);
}

describe("ReportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/report story/i)).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders all reason radio buttons", () => {
    renderModal();
    expect(screen.getByRole("radio", { name: /spam/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /false or misleading/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /harassment/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /privacy violation/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /explicit/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /other/i })).toBeInTheDocument();
  });

  it("submit button is disabled when no reason selected", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /submit report/i })).toBeDisabled();
  });

  it("submit button is enabled after selecting a reason", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    expect(screen.getByRole("button", { name: /submit report/i })).toBeEnabled();
  });

  it("shows description textarea only when Other is selected", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByLabelText(/additional details/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /other/i }));
    expect(screen.getByLabelText(/additional details/i)).toBeInTheDocument();
  });

  it("hides description textarea when switching from Other to another reason", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("radio", { name: /other/i }));
    expect(screen.getByLabelText(/additional details/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    expect(screen.queryByLabelText(/additional details/i)).not.toBeInTheDocument();
  });

  it("calls reportContent with correct args on submit", async () => {
    const user = userEvent.setup();
    reportContent.mockResolvedValue({ id: 1 });
    renderModal({ targetType: "story", targetId: 42 });

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(reportContent).toHaveBeenCalledWith({
        targetType: "story",
        targetId: 42,
        reason: "spam",
        description: "",
      });
    });
  });

  it("passes description when Other reason is selected", async () => {
    const user = userEvent.setup();
    reportContent.mockResolvedValue({ id: 1 });
    renderModal({ targetType: "comment", targetId: 7 });

    await user.click(screen.getByRole("radio", { name: /other/i }));
    await user.type(screen.getByLabelText(/additional details/i), "This is spam-like");
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(reportContent).toHaveBeenCalledWith({
        targetType: "comment",
        targetId: 7,
        reason: "other",
        description: "This is spam-like",
      });
    });
  });

  it("does not pass description when a non-Other reason is selected", async () => {
    const user = userEvent.setup();
    reportContent.mockResolvedValue({ id: 1 });
    renderModal();

    await user.click(screen.getByRole("radio", { name: /harassment/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(reportContent).toHaveBeenCalledWith(
        expect.objectContaining({ description: "" })
      );
    });
  });

  it("shows success message after successful submission", async () => {
    const user = userEvent.setup();
    reportContent.mockResolvedValue({ id: 1 });
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Report submitted. Our team will review it."
      );
    });
  });

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup();
    let resolve;
    reportContent.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();

    resolve({ id: 1 });
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  it("shows duplicate report error", async () => {
    const user = userEvent.setup();
    reportContent.mockRejectedValue({
      response: {
        data: {
          success: false,
          message: "You have already reported this content.",
          errors: { non_field_errors: ["You have already reported this content."] },
        },
      },
    });
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "You have already reported this content."
      );
    });
  });

  it("shows own content error", async () => {
    const user = userEvent.setup();
    reportContent.mockRejectedValue({
      response: {
        data: {
          success: false,
          message: "You cannot report your own content.",
          errors: { target_id: ["You cannot report your own content."] },
        },
      },
    });
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "You cannot report your own content."
      );
    });
  });

  it("shows generic error on unexpected failure", async () => {
    const user = userEvent.setup();
    reportContent.mockRejectedValue(new Error("Network error"));
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to submit report. Please try again."
      );
    });
  });

  it("clears error when selecting a different reason", async () => {
    const user = userEvent.setup();
    reportContent.mockRejectedValue(new Error("Network error"));
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /harassment/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows comment label when targetType is comment", () => {
    renderModal({ targetType: "comment" });
    expect(screen.getByText(/report comment/i)).toBeInTheDocument();
  });

  it("Cancel is disabled while submitting", async () => {
    const user = userEvent.setup();
    reportContent.mockReturnValue(new Promise(() => {}));
    renderModal();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });
});
