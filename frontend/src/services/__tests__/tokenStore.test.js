import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clear,
} from "../tokenStore";

describe("tokenStore", () => {
  beforeEach(() => {
    clear();
    vi.restoreAllMocks();
  });

  it("stores and retrieves access token", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("abc123");
    expect(getAccessToken()).toBe("abc123");
  });

  it("stores and retrieves refresh token", () => {
    expect(getRefreshToken()).toBeNull();
    setRefreshToken("refresh456");
    expect(getRefreshToken()).toBe("refresh456");
  });

  it("clear() resets both tokens to null", () => {
    setAccessToken("a");
    setRefreshToken("r");
    clear();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("clear() dispatches auth:logout event on window", () => {
    const handler = vi.fn();
    window.addEventListener("auth:logout", handler);
    clear();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:logout", handler);
  });
});
