import { test, expect } from "@playwright/test";
import {
  mockAuth,
  mockStories,
  mockNotifications,
  loginViaStorage,
} from "./utils/mocks.js";

test.describe("Auth flows", () => {
  test("user can register with valid credentials", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/register");

    await page.locator("#username").fill("e2euser");
    await page.locator("#email").fill("e2e@example.com");
    await page.locator("#password").fill("Passw0rd1");
    await page.locator("#confirmPassword").fill("Passw0rd1");

    const registerRequest = page.waitForRequest(
      (req) => req.url().includes("/auth/register/") && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Create account" }).click();
    const req = await registerRequest;

    // Server-side error banner uses role="alert" — assert one is NOT shown.
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Confirm the request body shape matches what the backend expects.
    const body = JSON.parse(req.postData() || "{}");
    expect(body).toMatchObject({
      username: "e2euser",
      email: "e2e@example.com",
      password: "Passw0rd1",
      password_confirmation: "Passw0rd1",
    });
  });

  test("user can log in and gets redirected to feed", async ({ page }) => {
    await mockAuth(page);
    // Feed page hits /stories/feed/ and tag/notification endpoints — stub them.
    await mockStories(page);
    await mockNotifications(page);

    await page.goto("/login");
    await page.locator("#email").fill("e2e@example.com");
    await page.locator("#password").fill("Passw0rd1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("accessToken"),
    );
    expect(accessToken).toBe("fake-access-token");
  });

  test("login with wrong password shows an error and keeps the user on /login", async ({
    page,
  }) => {
    // Override the success mock from mockAuth with a 401 that mimics DRF's
    // detail-style error payload, which LoginPage surfaces via role="alert".
    await page.route("**/auth/login/", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid credentials" }),
      }),
    );

    await page.goto("/login");
    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toHaveText(/invalid credentials/i);
    await expect(page).toHaveURL(/\/login$/);
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("accessToken"),
    );
    expect(accessToken).toBeNull();
  });

  test("logout clears tokens", async ({ page }) => {
    await mockAuth(page);
    await mockStories(page);
    await mockNotifications(page);
    await loginViaStorage(page);

    await page.goto("/");

    // Desktop nav exposes a "Logout" button (with a LogOut icon). Take the first
    // visible one — there's a duplicate in the mobile sheet that is hidden on
    // desktop viewports.
    await page.getByRole("button", { name: /logout/i }).first().click();

    await expect.poll(() =>
      page.evaluate(() => window.localStorage.getItem("accessToken")),
    ).toBeNull();
    await expect.poll(() =>
      page.evaluate(() => window.localStorage.getItem("refreshToken")),
    ).toBeNull();
  });
});
