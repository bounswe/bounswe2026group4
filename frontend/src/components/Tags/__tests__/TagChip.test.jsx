import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import TagChip from "../TagChip";

const tag = { id: 1, name: "ottoman-era", story_count: 5 };

function renderChip(props) {
  return render(
    <MemoryRouter>
      <TagChip tag={tag} {...props} />
    </MemoryRouter>
  );
}

describe("TagChip", () => {
  it("renders the tag name", () => {
    renderChip();
    expect(screen.getByText("ottoman-era")).toBeInTheDocument();
  });

  it("renders as a link to /tags/:slug when no onRemove", () => {
    renderChip();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/tags/ottoman-era");
  });

  it("renders a remove button when onRemove is provided", () => {
    const onRemove = vi.fn();
    renderChip({ onRemove });
    expect(screen.getByRole("button", { name: /remove ottoman-era/i })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onRemove with the tag when X is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderChip({ onRemove });
    await user.click(screen.getByRole("button", { name: /remove ottoman-era/i }));
    expect(onRemove).toHaveBeenCalledWith(tag);
  });
});
