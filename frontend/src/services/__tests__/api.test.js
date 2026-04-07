import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

import api from "@/services/api";
import * as tokenStore from "@/services/tokenStore";
import { navigationRef } from "@/services/navigationRef";

describe("api service", () => {
  let mock;
  let axiosMock;

  beforeEach(() => {
    mock = new MockAdapter(api);
    axiosMock = new MockAdapter(axios);
    tokenStore.clear();
    navigationRef.navigate = vi.fn();
    // Reset the event listener side-effect from clear()
    vi.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
    axiosMock.restore();
  });

  it("attaches Authorization header when access token exists", async () => {
    tokenStore.setAccessToken("token-123");
    mock.onGet("/test").reply((config) => {
      expect(config.headers.Authorization).toBe("Bearer token-123");
      return [200, { ok: true }];
    });

    await api.get("/test");
  });

  it("does not attach Authorization header when no token exists", async () => {
    mock.onGet("/test").reply((config) => {
      expect(config.headers.Authorization).toBeUndefined();
      return [200, { ok: true }];
    });

    await api.get("/test");
  });

  it("clears tokens and navigates to /login on 401 when no refresh token", async () => {
    tokenStore.setAccessToken("access");
    // No refresh token set

    mock.onGet("/test").reply(401);

    await expect(api.get("/test")).rejects.toThrow();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();
    expect(navigationRef.navigate).toHaveBeenCalledWith("/login");
  });

  it("does not crash when navigationRef.navigate is null on 401", async () => {
    navigationRef.navigate = null;
    mock.onGet("/test").reply(401);

    await expect(api.get("/test")).rejects.toThrow();

    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("refreshes token and retries original request on 401", async () => {
    tokenStore.setAccessToken("old-access");
    tokenStore.setRefreshToken("old-refresh");

    // First call to /test returns 401, second returns 200
    let callCount = 0;
    mock.onGet("/test").reply(() => {
      callCount++;
      if (callCount === 1) {
        return [401];
      }
      return [200, { data: "success" }];
    });

    // Mock refresh endpoint on plain axios
    axiosMock.onPost(/\/auth\/token\/refresh\//).reply(200, {
      access: "new-access",
      refresh: "new-refresh",
    });

    const response = await api.get("/test");

    expect(response.data).toEqual({ data: "success" });
    expect(tokenStore.getAccessToken()).toBe("new-access");
    expect(tokenStore.getRefreshToken()).toBe("new-refresh");
  });

  it("clears tokens and redirects when refresh fails", async () => {
    tokenStore.setAccessToken("old-access");
    tokenStore.setRefreshToken("old-refresh");

    mock.onGet("/test").reply(401);

    // Refresh fails
    axiosMock.onPost(/\/auth\/token\/refresh\//).reply(401);

    await expect(api.get("/test")).rejects.toThrow();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();
    expect(navigationRef.navigate).toHaveBeenCalledWith("/login");
  });

  it("does not attempt refresh for auth endpoints", async () => {
    tokenStore.setAccessToken("access");
    tokenStore.setRefreshToken("refresh");

    mock.onPost("/auth/login/").reply(401);

    const refreshHandler = vi.fn(() => [200, { access: "x", refresh: "y" }]);
    axiosMock.onPost(/\/auth\/token\/refresh\//).reply(refreshHandler);

    await expect(api.post("/auth/login/")).rejects.toThrow();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(navigationRef.navigate).toHaveBeenCalledWith("/login");
    expect(refreshHandler).not.toHaveBeenCalled();
  });

  it("does not retry infinitely if retried request also returns 401", async () => {
    tokenStore.setAccessToken("old-access");
    tokenStore.setRefreshToken("old-refresh");

    // /test always returns 401 (even after refresh)
    mock.onGet("/test").reply(401);

    axiosMock.onPost(/\/auth\/token\/refresh\//).reply(200, {
      access: "new-access",
      refresh: "new-refresh",
    });

    await expect(api.get("/test")).rejects.toThrow();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(navigationRef.navigate).toHaveBeenCalledWith("/login");
  });

  it("only makes one refresh request for concurrent 401s", async () => {
    tokenStore.setAccessToken("old-access");
    tokenStore.setRefreshToken("old-refresh");

    // Both endpoints return 401 first, then 200 on retry
    let callCountA = 0;
    let callCountB = 0;
    mock.onGet("/endpoint-a").reply(() => {
      callCountA++;
      if (callCountA === 1) return [401];
      return [200, { a: true }];
    });
    mock.onGet("/endpoint-b").reply(() => {
      callCountB++;
      if (callCountB === 1) return [401];
      return [200, { b: true }];
    });

    let refreshCallCount = 0;
    axiosMock.onPost(/\/auth\/token\/refresh\//).reply(() => {
      refreshCallCount++;
      return [200, { access: "new-access", refresh: "new-refresh" }];
    });

    const [resA, resB] = await Promise.all([
      api.get("/endpoint-a"),
      api.get("/endpoint-b"),
    ]);

    expect(resA.data).toEqual({ a: true });
    expect(resB.data).toEqual({ b: true });
    expect(refreshCallCount).toBe(1);
  });
});
