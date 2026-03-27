import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useAuth } from "@/hooks/useAuth";
import { AuthContext } from "@/context/AuthContext";

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider"
    );
  });

  it("returns context value when used inside provider", () => {
    const wrapper = ({ children }) => (
      <AuthContext.Provider
        value={{
          user: { username: "alice" },
          isAuthenticated: true,
          loading: false,
          login: async () => {},
          logout: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user.username).toBe("alice");
    expect(result.current.isAuthenticated).toBe(true);
  });
});
