import axios from "axios";
import { getAccessToken, clear } from "./tokenStore";
import { navigationRef } from "./navigationRef";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clear();
      navigationRef.navigate?.("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
