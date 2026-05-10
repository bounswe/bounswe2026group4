import { test, expect } from "@playwright/test";
import { mockAuth, mockStories, loginViaStorage } from "./utils/mocks.js";

test.describe("Story submission", () => {
  test("logged-in user can submit a story with location and year", async ({ page }) => {
    await mockAuth(page);
    await mockStories(page);
    await loginViaStorage(page);

    await page.goto("/submit-story");

    await page.locator("#title").fill("Test Story");
    await page
      .locator("#narrative")
      .fill("A test story narrative for E2E coverage.");
    await page.locator("#timeType").selectOption("exact_year");
    await page.locator("#year").fill("1453");
    await page.locator("#placeName").fill("Hagia Sophia");

    // Click on the embedded Leaflet map to drop a pin. The MapPicker component
    // listens for click events on the map container and updates the location
    // state; we need the map to be visible and laid out before clicking.
    const mapContainer = page.locator(".leaflet-container").first();
    await expect(mapContainer).toBeVisible();
    await mapContainer.click({ position: { x: 200, y: 150 } });

    const createRequest = page.waitForRequest(
      (req) =>
        req.url().match(/\/stories\/?$/) !== null && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Submit Story" }).click();
    const req = await createRequest;

    // The body is multipart/form-data — assert the title/year/location_name
    // tokens appear in the raw payload. Looking inside multipart bodies as a
    // string is brittle for binary fields, but plain text fields show up
    // verbatim and that's all we need to validate here.
    const body = req.postData() || "";
    expect(body).toContain("Test Story");
    expect(body).toContain("Hagia Sophia");
    expect(body).toContain("1453");
    expect(body).toContain("exact_year");

    // Submit handler navigates to /stories/:id on success.
    await expect(page).toHaveURL(/\/stories\/123/);
  });
});
