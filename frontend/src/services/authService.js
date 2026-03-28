import axios from "axios";
import { setAccessToken, setRefreshToken, getRefreshToken, clear } from "./tokenStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function login(email, password) {
  const response = await axios.post(`${API_URL}/auth/login/`, { email, password });
  const { access, refresh } = response.data;
  setAccessToken(access);
  setRefreshToken(refresh);
  return response.data;
}

export async function register(username, email, password, passwordConfirmation) {
  const response = await axios.post(`${API_URL}/auth/register/`, {
    username,
    email,
    password,
    password_confirmation: passwordConfirmation,
  });
  return response.data;
}

export async function logout() {
  try {
    const refresh = getRefreshToken();
    await axios.post(`${API_URL}/auth/logout/`, { refresh });
  } catch {
    // Silently ignore logout API errors
  } finally {
    clear();
  }
}
