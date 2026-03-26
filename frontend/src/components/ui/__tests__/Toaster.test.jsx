import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/context/ToastContext";
import { Toaster } from "../toaster";
import { useToast } from "@/hooks/useToast";

// Helper component that exposes toast controls in the rendered DOM
function ToastTrigger() {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Story saved!")}>Success</button>
      <button onClick={() => toast.error("Failed to save.")}>Error</button>
      <button onClick={() => toast.info("Session expiring soon.")}>Info</button>
    </div>
  );
}

function renderWithToast() {
  return render(
    <ToastProvider>
      <ToastTrigger />
      <Toaster />
    </ToastProvider>
  );
}

describe("Toaster", () => {
  it("renders nothing when there are no toasts", () => {
    renderWithToast();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a success toast", async () => {
    const user = userEvent.setup();
    renderWithToast();

    await user.click(screen.getByRole("button", { name: "Success" }));
    expect(screen.getByText("Story saved!")).toBeInTheDocument();
  });

  it("shows an error toast", async () => {
    const user = userEvent.setup();
    renderWithToast();

    await user.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByText("Failed to save.")).toBeInTheDocument();
  });

  it("shows an info toast", async () => {
    const user = userEvent.setup();
    renderWithToast();

    await user.click(screen.getByRole("button", { name: "Info" }));
    expect(screen.getByText("Session expiring soon.")).toBeInTheDocument();
  });

  it("dismisses a toast when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    renderWithToast();

    await user.click(screen.getByRole("button", { name: "Success" }));
    expect(screen.getByText("Story saved!")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /dismiss notification/i })
    );
    expect(screen.queryByText("Story saved!")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the specified duration", () => {
    vi.useFakeTimers();

    const { getByText, queryByText } = render(
      <ToastProvider>
        <ToastTrigger />
        <Toaster />
      </ToastProvider>
    );

    // Fire click synchronously so we don't need userEvent's async internals
    act(() => {
      getByText("Success").click();
    });

    expect(getByText("Story saved!")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));

    expect(queryByText("Story saved!")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe("useToast", () => {
  it("throws when used outside ToastProvider", () => {
    // Suppress console.error from React's error boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <Toaster />
      )
    ).toThrow();

    spy.mockRestore();
  });
});
