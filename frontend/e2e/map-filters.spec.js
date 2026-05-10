import { test, expect } from "@playwright/test";
import { mockStories } from "./utils/mocks.js";

const FEATURES = [
  {
    type: "Feature",
    id: 1,
    geometry: { type: "Point", coordinates: [28.97, 41.01] },
    properties: {
      title: "Renaissance Story",
      location_name: "Florence",
      time_type: "exact_year",
      year: 1500,
    },
  },
  {
    type: "Feature",
    id: 2,
    geometry: { type: "Point", coordinates: [-0.13, 51.5] },
    properties: {
      title: "Modern Story",
      location_name: "London",
      time_type: "exact_year",
      year: 1900,
    },
  },
];

test.describe("Map filters", () => {
  test("year-range filter sends year_from / year_to to /stories/search/", async ({
    page,
  }) => {
    await mockStories(page, { features: FEATURES });

    await page.goto("/map");

    // Wait for the initial /stories/map/ fetch + map render.
    await expect(page.locator(".leaflet-container").first()).toBeVisible();

    // Open the filter panel (button is labelled "Filters" with a sliders icon).
    await page.getByRole("button", { name: /filters/i }).click();

    // The year inputs are labelled "From year" / "To year" via sr-only labels.
    await page.getByLabel("From year").fill("1400");
    await page.getByLabel("To year").fill("1600");

    // The Map page hits /stories/map/ with filter params (NOT /stories/search/)
    // when there is no `q` query — assert against /stories/map/?year_from=...
    const filteredRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/stories/map/") &&
        req.url().includes("year_from=1400") &&
        req.url().includes("year_to=1600"),
    );

    await page.getByRole("button", { name: "Apply", exact: true }).click();

    await filteredRequest;
  });
});
