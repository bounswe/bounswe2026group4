import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import api from "@/services/api";

describe("api service", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches Authorization header when access token exists", async () => {
    localStorage.setItem("accessToken", "token-123");
    const requestHandler = api.interceptors.request.handlers.at(-1).fulfilled;

    const config = await requestHandler({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-123");
  });

  it("does not attach Authorization header when no token exists", async () => {
    const requestHandler = api.interceptors.request.handlers.at(-1).fulfilled;

    const config = await requestHandler({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it("clears tokens and redirects to /login on 401 outside auth pages", async () => {
    localStorage.setItem("accessToken", "access");
    localStorage.setItem("refreshToken", "refresh");
    localStorage.setItem("user", JSON.stringify({ username: "alice" }));
    window.history.pushState({}, "", "/profile");

    const responseErrorHandler = api.interceptors.response.handlers.at(-1).rejected;

    await expect(responseErrorHandler({ response: { status: 401 } })).rejects.toEqual({
      response: { status: 401 },
    });

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(window.location.pathname).toBe("/login");
  });

  it("does not redirect on 401 when already on /login", async () => {
    window.history.pushState({}, "", "/login");
    const responseErrorHandler = api.interceptors.response.handlers.at(-1).rejected;

    await expect(responseErrorHandler({ response: { status: 401 } })).rejects.toEqual({
      response: { status: 401 },
    });

    expect(window.location.pathname).toBe("/login");
  });

  it("does not redirect on 401 when already on /register", async () => {
    window.history.pushState({}, "", "/register");
    const responseErrorHandler = api.interceptors.response.handlers.at(-1).rejected;

    await expect(responseErrorHandler({ response: { status: 401 } })).rejects.toEqual({
      response: { status: 401 },
    });

    expect(window.location.pathname).toBe("/register");
  });
});
