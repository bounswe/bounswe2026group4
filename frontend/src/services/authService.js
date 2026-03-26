import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function login(email, password) {
  const response = await axios.post(`${API_URL}/auth/login/`, { email, password });
  const { access, refresh } = response.data;
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
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
