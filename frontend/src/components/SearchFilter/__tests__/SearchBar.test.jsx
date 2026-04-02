import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SearchBar from "../SearchBar";

function renderBar(props = {}) {
  return render(
    <SearchBar
      defaultValue=""
      onSearch={vi.fn()}
      {...props}
    />
  );
}

// Tests that check debounce timing use vi.useFakeTimers + fireEvent (synchronous input change).
// Tests that check click interactions use userEvent with real timers.

describe("SearchBar", () => {
  it("renders a search input", () => {
    renderBar();
    expect(screen.getByRole("searchbox", { name: /search stories/i })).toBeInTheDocument();
  });

  it("shows the defaultValue in the input", () => {
    renderBar({ defaultValue: "istanbul" });
    expect(screen.getByRole("searchbox")).toHaveValue("istanbul");
  });

  it("shows a clear button only when input has a value", async () => {
    const user = userEvent.setup();
    renderBar();

    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "abc");
    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();
  });

  it("calls onSearch with empty string when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    renderBar({ defaultValue: "history", onSearch });

    await user.click(screen.getByRole("button", { name: /clear search/i }));

    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("syncs input value when defaultValue prop changes", () => {
    const { rerender } = render(
      <SearchBar defaultValue="old" onSearch={vi.fn()} />
    );
    expect(screen.getByRole("searchbox")).toHaveValue("old");

    rerender(<SearchBar defaultValue="" onSearch={vi.fn()} />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  describe("debounce behaviour (fake timers)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not call onSearch immediately after input changes", () => {
      const onSearch = vi.fn();
      renderBar({ onSearch });

      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "gal" } });

      expect(onSearch).not.toHaveBeenCalled();
    });

    it("calls onSearch after the 300 ms debounce window", () => {
      const onSearch = vi.fn();
      renderBar({ onSearch });

      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "gal" } });

      act(() => vi.advanceTimersByTime(300));

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith("gal");
    });

    it("does not call onSearch on initial mount", () => {
      const onSearch = vi.fn();
      renderBar({ defaultValue: "galata", onSearch });

      act(() => vi.advanceTimersByTime(500));

      expect(onSearch).not.toHaveBeenCalled();
    });

    it("calls onSearch with the latest value after the user pauses typing", () => {
      const onSearch = vi.fn();
      renderBar({ onSearch });

      const input = screen.getByRole("searchbox");

      fireEvent.change(input, { target: { value: "gal" } });
      act(() => vi.advanceTimersByTime(100)); // still within debounce window
      fireEvent.change(input, { target: { value: "galata" } });
      act(() => vi.advanceTimersByTime(300)); // debounce elapsed

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith("galata");
    });
  });
});
