import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/userService", () => ({
  deleteAccount: vi.fn(),
}));
vi.mock("@/services/tokenStore", () => ({
  clear: vi.fn(),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import { deleteAccount } from "@/services/userService";
import { clear as clearTokens } from "@/services/tokenStore";
import { useToast } from "@/hooks/useToast";
import DeleteAccountDialog from "../DeleteAccountDialog";

const successToast = vi.fn();

function renderDialog(props = {}) {
  const onOpenChange = vi.fn();
  const result = render(
    <MemoryRouter>
      <DeleteAccountDialog open onOpenChange={onOpenChange} {...props} />
    </MemoryRouter>
  );
  return { ...result, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  useToast.mockReturnValue({
    toast: { success: successToast, error: vi.fn(), info: vi.fn(), default: vi.fn() },
  });
});

describe("DeleteAccountDialog", () => {
  it("renders the title, hard-delete notice, and password field when open", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/delete your account\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/stories, comments, and likes will also be permanently deleted/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm with your password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete my account/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(
      <MemoryRouter>
        <DeleteAccountDialog open={false} onOpenChange={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("disables the confirm button while password is empty", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeDisabled();
  });

  it("calls deleteAccount with hard_delete=true exactly once on confirm", async () => {
    deleteAccount.mockResolvedValue(undefined);
    renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("hunter2", true));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("on success: clears auth state, closes the dialog, shows a toast, and navigates home", async () => {
    deleteAccount.mockResolvedValue(undefined);
    const { onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(clearTokens).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(successToast).toHaveBeenCalledWith("Account deleted successfully.");
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("surfaces the backend password field message and does not navigate", async () => {
    deleteAccount.mockRejectedValue({
      response: { status: 400, data: { password: ["Incorrect password."] } },
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/incorrect password\./i)
    );
    expect(clearTokens).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows a detail message when the backend returns 400 with a detail field", async () => {
    deleteAccount.mockRejectedValue({
      response: { status: 400, data: { detail: "Account already scheduled for deletion." } },
      message: "Request failed with status code 400",
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/account already scheduled for deletion/i)
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows 'wrong password' for a 400 response with no password array (raw Axios message suppressed)", async () => {
    deleteAccount.mockRejectedValue({
      response: { status: 400, data: {} },
      message: "Request failed with status code 400",
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/wrong password, please try again/i)
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the backend returns no useful error body", async () => {
    deleteAccount.mockRejectedValue(new Error("Network down"));
    renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/network down/i)
    );
  });

  it("shows a loading label while the request is in flight", async () => {
    let resolve;
    deleteAccount.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderDialog();

    fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /deleting…/i })).toBeInTheDocument()
    );
    resolve();
  });

  it("links the password input to the inline error via aria-describedby", async () => {
    deleteAccount.mockRejectedValue({
      response: { status: 400, data: { password: ["Incorrect password."] } },
    });
    renderDialog();

    const passwordInput = screen.getByLabelText(/confirm with your password/i);
    expect(passwordInput).not.toHaveAttribute("aria-describedby");

    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      "delete-account-error"
    );
    expect(screen.getByRole("alert")).toHaveAttribute("id", "delete-account-error");
  });

  // Regression guard: Radix's AlertDialogAction wraps Dialog.Close, which
  // auto-fires onOpenChange(false) on click. If the destructive button is
  // an AlertDialogAction, the dialog unmounts before the API call resolves,
  // hiding the loading state and any inline error. These two tests use a
  // controlled `open` prop (production wiring) to lock in that the dialog
  // stays mounted across the entire request lifecycle.
  describe("with controlled `open` (production wiring)", () => {
    function ControlledHarness() {
      const [open, setOpen] = useState(true);
      return <DeleteAccountDialog open={open} onOpenChange={setOpen} />;
    }

    it("keeps the dialog mounted while the request is in flight", async () => {
      let resolve;
      deleteAccount.mockReturnValue(new Promise((r) => { resolve = r; }));

      render(
        <MemoryRouter>
          <ControlledHarness />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
        target: { value: "hunter2" },
      });
      fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /deleting…/i })).toBeInTheDocument()
      );
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      resolve();
    });

    it("keeps the dialog open and surfaces inline error on backend failure", async () => {
      deleteAccount.mockRejectedValue({
        response: { status: 400, data: { password: ["Incorrect password."] } },
      });

      render(
        <MemoryRouter>
          <ControlledHarness />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/confirm with your password/i), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(/incorrect password\./i)
      );
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm with your password/i)).toBeInTheDocument();
    });

    it("submits via Enter key in the password input", async () => {
      deleteAccount.mockResolvedValue(undefined);

      render(
        <MemoryRouter>
          <ControlledHarness />
        </MemoryRouter>
      );

      const passwordInput = screen.getByLabelText(/confirm with your password/i);
      fireEvent.change(passwordInput, { target: { value: "hunter2" } });
      fireEvent.submit(passwordInput.closest("form"));

      await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("hunter2", true));
      expect(deleteAccount).toHaveBeenCalledTimes(1);
    });
  });
});
