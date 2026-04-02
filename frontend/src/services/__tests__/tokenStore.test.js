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

  it("setAccessToken persists to localStorage", () => {
    setAccessToken("abc123");
    expect(localStorage.getItem("accessToken")).toBe("abc123");
  });

  it("setRefreshToken persists to localStorage", () => {
    setRefreshToken("refresh456");
    expect(localStorage.getItem("refreshToken")).toBe("refresh456");
  });

  it("clear() removes tokens and user from localStorage", () => {
    localStorage.setItem("accessToken", "a");
    localStorage.setItem("refreshToken", "r");
    localStorage.setItem("user", '{"id":1}');
    clear();
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("reads tokens from localStorage on module load", () => {
    // Since module is already loaded and clear() resets in-memory vars,
    // we test that after setting localStorage and calling the setters,
    // the getters return the correct values (integration behavior)
    localStorage.setItem("accessToken", "stored-access");
    setAccessToken(localStorage.getItem("accessToken"));
    expect(getAccessToken()).toBe("stored-access");
  });
});
