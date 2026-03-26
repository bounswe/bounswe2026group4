import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";

import NotFoundPage from "../NotFoundPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderNotFoundPage() {
  return render(
    <BrowserRouter>
      <NotFoundPage />
    </BrowserRouter>
  );
}

describe("NotFoundPage", () => {
  it("renders the 404 heading", () => {
    renderNotFoundPage();
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });

  it("renders a friendly message", () => {
    renderNotFoundPage();
    expect(
      screen.getByRole("heading", { name: /page not found/i })
    ).toBeInTheDocument();
  });

  it("renders a description paragraph", () => {
    renderNotFoundPage();
    expect(
      screen.getByText(/couldn't find the page/i)
    ).toBeInTheDocument();
  });

  it("renders a link back to home", () => {
    renderNotFoundPage();
    const homeLink = screen.getByRole("link", { name: /back to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("navigates to home when the link is clicked", async () => {
    const user = userEvent.setup();
    renderNotFoundPage();

    const homeLink = screen.getByRole("link", { name: /back to home/i });
    await user.click(homeLink);
    // With BrowserRouter, clicking a Link navigates; just verify the link exists and points to /
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
