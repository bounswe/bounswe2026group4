import * as React from "react";

import {
  login as loginService,
  logout as logoutService,
  getStoredUser,
  isTokenExpired,
} from "@/services/authService";

const AuthContext = React.createContext(null);

function clearStoredAuth() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const isAuthenticated = Boolean(user);

  React.useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (!token || isTokenExpired(token)) {
      clearStoredAuth();
      setLoading(false);
      return;
    }

    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    } else {
      clearStoredAuth();
    }

    setLoading(false);
  }, []);

  const login = React.useCallback(async (email, password) => {
    const { user: userData } = await loginService(email, password);
    setUser(userData);
    return userData;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await logoutService();
    } finally {
      setUser(null);
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isAuthenticated,
      loading,
      login,
      logout,
    }),
    [user, isAuthenticated, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext, AuthProvider };
