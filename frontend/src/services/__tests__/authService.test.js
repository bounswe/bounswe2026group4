import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from "@/services/api";
import {
  login,
  register,
  logout,
  getStoredUser,
  isTokenExpired,
} from "@/services/authService";

function createJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return `${encode(header)}.${encode(payload)}.signature`;
}

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("login stores access, refresh and user in localStorage", async () => {
    api.post.mockResolvedValue({
      data: {
        access: "access-token",
        refresh: "refresh-token",
        user: { id: 1, email: "a@b.com", username: "alice", role: "registered_user" },
      },
    });

    await login("a@b.com", "Password1");

    expect(localStorage.getItem("accessToken")).toBe("access-token");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-token");
    expect(localStorage.getItem("user")).toBe(
      JSON.stringify({ id: 1, email: "a@b.com", username: "alice", role: "registered_user" })
    );
  });

  it("login returns access, refresh and user", async () => {
    api.post.mockResolvedValue({
      data: {
        access: "access-token",
        refresh: "refresh-token",
        user: { id: 2, email: "b@c.com", username: "bob", role: "registered_user" },
      },
    });

    const result = await login("b@c.com", "Password1");

    expect(result).toEqual({
      access: "access-token",
      refresh: "refresh-token",
      user: { id: 2, email: "b@c.com", username: "bob", role: "registered_user" },
    });
  });

  it("register posts to /auth/register/ and returns response data", async () => {
    api.post.mockResolvedValue({
      data: {
        message: "Registration successful",
      },
    });

    const data = await register("alice", "a@b.com", "Password1", "Password1");

    expect(api.post).toHaveBeenCalledWith("/auth/register/", {
      username: "alice",
      email: "a@b.com",
      password: "Password1",
      password_confirmation: "Password1",
    });
    expect(data).toEqual({ message: "Registration successful" });
  });

  it("logout posts refresh token and clears localStorage", async () => {
    localStorage.setItem("accessToken", "access-token");
    localStorage.setItem("refreshToken", "refresh-token");
    localStorage.setItem("user", JSON.stringify({ username: "alice" }));
    api.post.mockResolvedValue({ status: 204 });

    await logout();

    expect(api.post).toHaveBeenCalledWith("/auth/logout/", { refresh: "refresh-token" });
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("logout clears localStorage even when API call fails", async () => {
    localStorage.setItem("accessToken", "access-token");
    localStorage.setItem("refreshToken", "refresh-token");
    localStorage.setItem("user", JSON.stringify({ username: "alice" }));
    api.post.mockRejectedValue(new Error("network"));

    await expect(logout()).rejects.toThrow("network");

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("getStoredUser returns parsed user when localStorage has user", () => {
    localStorage.setItem("user", JSON.stringify({ username: "alice", role: "registered_user" }));

    expect(getStoredUser()).toEqual({ username: "alice", role: "registered_user" });
  });

  it("getStoredUser falls back to token claims when user key is absent", () => {
    const token = createJwt({
      username: "token-user",
      role: "registered_user",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    localStorage.setItem("accessToken", token);

    expect(getStoredUser()).toEqual({ username: "token-user", role: "registered_user" });
  });

  it("isTokenExpired returns false for a valid token", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });

    expect(isTokenExpired(token)).toBe(false);
  });

  it("isTokenExpired returns true for an expired token", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) - 3600 });

    expect(isTokenExpired(token)).toBe(true);
  });

  it("isTokenExpired returns true for malformed token", () => {
    expect(isTokenExpired("not-a-token")).toBe(true);
  });
});
