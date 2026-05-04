import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");

vi.mock("../tokenStore", () => ({
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(),
  clear: vi.fn(),
}));

import { login, register, logout, forgotPassword, resetPassword } from "../authService";
import { setAccessToken, setRefreshToken, getRefreshToken, clear } from "../tokenStore";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("calls API and stores tokens via tokenStore", async () => {
      const responseData = {
        access: "access-token",
        refresh: "refresh-token",
        user: { id: 1, email: "test@example.com" },
      };
      axios.post.mockResolvedValue({ data: responseData });

      const result = await login("test@example.com", "password123");

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/auth/login/"),
        { email: "test@example.com", password: "password123" }
      );
      expect(setAccessToken).toHaveBeenCalledWith("access-token");
      expect(setRefreshToken).toHaveBeenCalledWith("refresh-token");
      expect(result).toEqual(responseData);
    });

    it("does not store tokens on failure", async () => {
      axios.post.mockRejectedValue(new Error("Network error"));

      await expect(login("test@example.com", "bad")).rejects.toThrow("Network error");
      expect(setAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("calls register endpoint and returns data", async () => {
      const responseData = { message: "User created" };
      axios.post.mockResolvedValue({ data: responseData });

      const result = await register("user", "test@example.com", "pass", "pass");

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/auth/register/"),
        {
          username: "user",
          email: "test@example.com",
          password: "pass",
          password_confirmation: "pass",
        }
      );
      expect(result).toEqual(responseData);
    });
  });

  describe("logout", () => {
    it("calls API with refresh token and clears tokenStore", async () => {
      getRefreshToken.mockReturnValue("refresh-token");
      axios.post.mockResolvedValue({});

      await logout();

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/auth/logout/"),
        { refresh: "refresh-token" }
      );
      expect(clear).toHaveBeenCalled();
    });

    it("always resolves even if API call fails", async () => {
      getRefreshToken.mockReturnValue("refresh-token");
      axios.post.mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(logout()).resolves.toBeUndefined();
      expect(clear).toHaveBeenCalled();
    });

    it("clears tokenStore even when API fails", async () => {
      getRefreshToken.mockReturnValue("refresh-token");
      axios.post.mockRejectedValue(new Error("fail"));

      await logout();

      expect(clear).toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("posts email to /auth/password-reset/", async () => {
      axios.post.mockResolvedValue({ data: { message: "ok" } });

      const result = await forgotPassword("test@example.com");

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/auth/password-reset/"),
        { email: "test@example.com" }
      );
      expect(result).toEqual({ message: "ok" });
    });
  });

  describe("resetPassword", () => {
    it("posts token and new_password fields to /auth/password-reset/confirm/", async () => {
      axios.post.mockResolvedValue({ data: { message: "ok" } });

      const result = await resetPassword("token-uuid", "Password1", "Password1");

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/auth/password-reset/confirm/"),
        {
          token: "token-uuid",
          new_password: "Password1",
          new_password_confirmation: "Password1",
        }
      );
      expect(result).toEqual({ message: "ok" });
    });
  });
});
