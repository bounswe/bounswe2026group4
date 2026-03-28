import { createContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginService, logout as logoutService } from "@/services/authService";
import { navigationRef } from "@/services/navigationRef";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Set navigationRef for the axios interceptor to use
  useEffect(() => {
    navigationRef.navigate = navigate;
  }, [navigate]);

  // Listen for auth:logout events (fired by tokenStore.clear())
  useEffect(() => {
    function handleLogout() {
      setUser(null);
    }
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginService(email, password);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await logoutService();
    setUser(null);
    navigate("/login");
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

