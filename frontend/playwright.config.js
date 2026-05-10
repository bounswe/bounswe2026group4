import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the StoryMap frontend E2E suite.
 *
 * - Specs live in `frontend/e2e/` so Vitest (which scans `src/`) does not pick
 *   them up. The two test runners stay completely separate.
 * - Backend traffic is mocked via `page.route` inside each spec, so a live
 *   Django backend is NOT required to run the suite.
 * - The Vite dev server is launched on port 5173 by `webServer` below.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
