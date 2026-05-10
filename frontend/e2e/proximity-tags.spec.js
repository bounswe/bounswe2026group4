import { test, expect } from "@playwright/test";
import { mockStories } from "./utils/mocks.js";

test.describe("Proximity & tag filters", () => {
  test("tag filter is sent to /stories/map/ as `tags=` param", async ({
    page,
  }) => {
    await mockStories(page, { features: [] });

    await page.goto("/map");
    await expect(page.locator(".leaflet-container").first()).toBeVisible();

    await page.getByRole("button", { name: /filters/i }).click();

    // TagFilterInput exposes "Add tag" as the trigger; clicking it opens the
    // search popover where typing a query hits /tags/search/. Our mock returns
    // a single suggestion called "history" — pressing Enter selects it.
    await page.getByRole("button", { name: "Add tag filter" }).click();
    await page.getByLabel("Tag filter search").fill("hist");
    // Wait for the suggestion list to settle (300 ms debounce + fetch), then
    // click the suggestion directly. Using mousedown via a click is more
    // robust than `press("Enter")` here, because Enter synthesises both a
    // keydown and a click that can briefly close the popover before React
    // commits the updated tag list.
    const suggestion = page.getByRole("option").filter({ hasText: "history" });
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    // Confirm the tag chip is rendered before applying — the chip
    // appears in the "Selected tag filters" group above the input.
    await expect(
      page.locator('[aria-label="Selected tag filters"]').getByText("history"),
    ).toBeVisible();

    const mapRequests = [];
    page.on("request", (req) => {
      if (req.url().includes("/stories/")) mapRequests.push(req.url());
    });

    await page.getByRole("button", { name: "Apply", exact: true }).click();

    // Wait for the URL to reflect the applied tag filter, then check the
    // request was sent. Using expect.poll() avoids a brittle race vs.
    // waitForRequest (which requires the callback to be set up before the
    // request fires).
    await expect.poll(() => page.url(), { timeout: 5000 }).toMatch(/tags=history/);
    await expect.poll(() =>
      mapRequests.some((url) => url.includes("/stories/map/") && url.includes("tags=history")),
      { timeout: 10_000 },
    ).toBe(true);
  });

  test("proximity filter triggers a request with radius_km when geolocation is granted", async ({
    page,
    context,
  }) => {
    await mockStories(page, { features: [] });

    // Grant geolocation up front and pin the position so the panel resolves
    // device coords without a real prompt.
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 });

    await page.goto("/map");
    await expect(page.locator(".leaflet-container").first()).toBeVisible();

    await page.getByRole("button", { name: /filters/i }).click();

    // The "1 km" radio sits inside the Distance fieldset. The label wraps a
    // visually-hidden radio input — clicking the label triggers the change.
    await page.getByText("1 km", { exact: true }).click();

    // Wait for the panel to flip into "Using your current location." status
    // before applying, so the request includes resolved coords.
    await expect(
      page.getByText(/using your current location/i),
    ).toBeVisible();

    const proximityRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/stories/map/") &&
        req.url().includes("radius_km=1"),
    );

    await page.getByRole("button", { name: "Apply", exact: true }).click();

    await proximityRequest;
  });
});
