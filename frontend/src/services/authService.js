import api from "@/services/api";

function decodeJwtPayload(token) {
  const payloadSegment = token.split(".")[1];
  const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export async function login(email, password) {
  const response = await api.post("/auth/login/", { email, password });
  const { access, refresh, user } = response.data;
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
  localStorage.setItem("user", JSON.stringify(user));

  return { access, refresh, user };
}

export async function register(username, email, password, passwordConfirmation) {
  const response = await api.post("/auth/register/", {
    username,
    email,
    password,
    password_confirmation: passwordConfirmation,
  });

  return response.data;
}

export async function logout() {
  const refresh = localStorage.getItem("refreshToken");

  try {
    if (refresh) {
      await api.post("/auth/logout/", { refresh });
    }
  } finally {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }
}

export function isTokenExpired(token) {
  if (!token) {
    return true;
  }

  try {
    const payload = decodeJwtPayload(token);
    if (!payload.exp) {
      return true;
    }

    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getStoredUser() {
  try {
    const user = localStorage.getItem("user");
    if (user) {
      return JSON.parse(user);
    }

    const token = localStorage.getItem("accessToken");
    if (!token || isTokenExpired(token)) {
      return null;
    }

    const payload = decodeJwtPayload(token);
    if (!payload.username || !payload.role) {
      return null;
    }

    return {
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
