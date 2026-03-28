import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import MockAdapter from "axios-mock-adapter";

import api from "@/services/api";
import * as tokenStore from "@/services/tokenStore";
import { navigationRef } from "@/services/navigationRef";

describe("api service", () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(api);
    tokenStore.clear();
    navigationRef.navigate = vi.fn();
    // Reset the event listener side-effect from clear()
    vi.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
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

  it("clears tokens and navigates to /login on 401", async () => {
    tokenStore.setAccessToken("access");
    tokenStore.setRefreshToken("refresh");

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
});
