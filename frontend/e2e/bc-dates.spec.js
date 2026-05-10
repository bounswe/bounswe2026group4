import { test, expect } from "@playwright/test";
import { mockAuth, mockStories, loginViaStorage } from "./utils/mocks.js";

const BC_FEATURE = {
  type: "Feature",
  id: 5,
  geometry: { type: "Point", coordinates: [12.49, 41.89] },
  properties: {
    title: "Roman Founding",
    location_name: "Rome",
    time_type: "exact_year",
    year: -300,
  },
};

test.describe("BC dates", () => {
  test("submission accepts negative year and forwards it to /stories/", async ({
    page,
  }) => {
    await mockAuth(page);
    await mockStories(page);
    await loginViaStorage(page);

    await page.goto("/submit-story");

    await page.locator("#title").fill("Antiquity Story");
    await page.locator("#narrative").fill("A pre-AD narrative for testing.");
    await page.locator("#timeType").selectOption("exact_year");
    await page.locator("#year").fill("-300");
    await page.locator("#placeName").fill("Ancient Rome");

    const map = page.locator(".leaflet-container").first();
    await expect(map).toBeVisible();
    await map.click({ position: { x: 200, y: 150 } });

    const createRequest = page.waitForRequest(
      (req) =>
        req.url().match(/\/stories\/?$/) !== null && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Submit Story" }).click();
    const req = await createRequest;

    // SubmitStoryPage builds a multipart body where each form field is on its
    // own multipart part. The year value is serialised as a plain string, so
    // it shows up verbatim. -300 is unique enough not to collide with other
    // fields (lat/lng get truncated to fixed precision).
    const body = req.postData() || "";
    expect(body).toContain('name="year"');
    expect(body).toMatch(/name="year"[\s\S]*?-300/);
  });

  test("BC year is rendered as '300 BC' in the map popup", async ({ page }) => {
    await mockStories(page, { features: [BC_FEATURE] });

    await page.goto("/map");
    await expect(page.locator(".leaflet-container").first()).toBeVisible();

    // Marker → popup. Leaflet renders markers as clickable images inside the
    // pane; using getByRole("button") is unreliable across Leaflet versions,
    // so target the visible marker img and click it.
    const marker = page.locator(".leaflet-marker-icon").first();
    await expect(marker).toBeVisible();
    await marker.click();

    // The popup HTML is generated via renderToStaticMarkup and injected by
    // Leaflet — the text node "300 BC" comes from formatHistoricalYear(-300).
    await expect(page.locator(".leaflet-popup-content")).toContainText(
      /300\s*BC/i,
    );
  });
});
