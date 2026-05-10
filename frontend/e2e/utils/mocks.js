// Shared Playwright route handlers and helpers for the E2E suite.
//
// Every backend call the SPA makes during a test is intercepted via
// `page.route` BEFORE navigation. That keeps the suite hermetic: no live
// Django, no flaky network, and no shared test data.

const FAKE_USER = {
  id: 1,
  username: "e2euser",
  email: "e2e@example.com",
  is_username_public: true,
};

const FAKE_TOKENS = {
  access: "fake-access-token",
  refresh: "fake-refresh-token",
};

/**
 * Wire up the auth endpoints used by login, register, logout, and the
 * AuthContext profile bootstrap.
 */
export async function mockAuth(page, { user = FAKE_USER } = {}) {
  await page.route("**/auth/register/", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ user }),
    }),
  );

  await page.route("**/auth/login/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...FAKE_TOKENS, user }),
    }),
  );

  await page.route("**/auth/logout/", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );

  // AuthContext.login() fetches /users/me/ right after login — mock it so
  // the post-login navigation does not blow up on a network error.
  await page.route("**/users/me/", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: user }),
      });
    }
    return route.continue();
  });
}

/**
 * Wire up the story endpoints. `options.features` overrides the default
 * empty FeatureCollection returned by GET /stories/map/.
 *
 * The search route is filter-aware: it parses `year_from` / `year_to`
 * query params and filters the same feature list, so map-filter specs can
 * assert that the request was made AND that the UI renders the response.
 */
export async function mockStories(page, { features = [] } = {}) {
  await page.route("**/stories/map/**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ type: "FeatureCollection", features }),
    });
  });

  await page.route("**/stories/search/**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const yearFrom = url.searchParams.get("year_from");
    const yearTo = url.searchParams.get("year_to");
    const filtered = features.filter((f) => {
      const y = f.properties?.year;
      if (y == null) return true;
      if (yearFrom != null && y < Number(yearFrom)) return false;
      if (yearTo != null && y > Number(yearTo)) return false;
      return true;
    });
    // /stories/search/ returns paginated story list, not GeoJSON.
    const results = filtered.map((f) => ({
      id: f.id,
      title: f.properties?.title ?? "",
      location_name: f.properties?.location_name ?? "",
      location_lat: f.geometry?.coordinates?.[1] ?? null,
      location_lng: f.geometry?.coordinates?.[0] ?? null,
      time_type: f.properties?.time_type ?? "exact_year",
      year: f.properties?.year ?? null,
      year_start: f.properties?.year_start ?? null,
      year_end: f.properties?.year_end ?? null,
    }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        count: results.length,
        next: null,
        previous: null,
        results,
      }),
    });
  });

  // Story creation — return the created story so SubmitStoryPage can navigate.
  await page.route("**/stories/", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 123, title: "Created", location_lat: 41, location_lng: 29 }),
    });
  });

  // Media upload endpoints — accept anything, return minimal payload.
  await page.route("**/stories/*/images/", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ image: { id: 1, file: "fake.jpg" } }),
    }),
  );
  await page.route("**/stories/*/media/", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 1 }),
    }),
  );

  // Detail endpoint hit after submission redirects to /stories/:id.
  await page.route("**/stories/123/", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 123,
        title: "Created",
        narrative: "Narrative",
        location_lat: 41,
        location_lng: 29,
        location_name: "Hagia Sophia",
        time_type: "exact_year",
        year: 1453,
        tags: [],
      }),
    });
  });

  // Tag autocomplete (TagFilterInput / TagInput) — service hits GET /tags/.
  await page.route("**/tags/**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          { id: 1, name: "history", story_count: 5 },
          { id: 2, name: "architecture", story_count: 3 },
        ],
      }),
    });
  });

  // Catch-all stories list endpoint (feed view).
  await page.route("**/stories/feed/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    }),
  );
}

/**
 * Bypass the login UI for tests that target a protected route by writing
 * tokens + a stub user into localStorage before the app boots. The init
 * script runs on every page in the context so subsequent navigations stay
 * authenticated.
 */
export async function loginViaStorage(page, { user = FAKE_USER } = {}) {
  await page.addInitScript(
    ({ access, refresh, userJson }) => {
      window.localStorage.setItem("accessToken", access);
      window.localStorage.setItem("refreshToken", refresh);
      window.localStorage.setItem("user", userJson);
    },
    {
      access: FAKE_TOKENS.access,
      refresh: FAKE_TOKENS.refresh,
      userJson: JSON.stringify(user),
    },
  );
}

export { FAKE_USER, FAKE_TOKENS };
