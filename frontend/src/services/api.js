import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clear,
} from "./tokenStore";
import { navigationRef } from "./navigationRef";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
});

/** Endpoints that should never trigger a token refresh. */
const AUTH_ENDPOINTS = ["/auth/login/", "/auth/refresh/", "/auth/logout/"];

/** Shared promise so concurrent 401s only trigger one refresh. */
let refreshPromise = null;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the response is not a 401, reject immediately
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // No config (e.g. network error before request) — bail out
    if (!originalRequest) {
      clear();
      navigationRef.navigate?.("/login");
      return Promise.reject(error);
    }

    // Prevent infinite retry loop — only attempt refresh once per request
    if (originalRequest._retry) {
      clear();
      navigationRef.navigate?.("/login");
      return Promise.reject(error);
    }

    // Skip refresh for auth endpoints — just clear and redirect
    const requestUrl = originalRequest.url || "";
    if (AUTH_ENDPOINTS.some((ep) => requestUrl.endsWith(ep))) {
      clear();
      navigationRef.navigate?.("/login");
      return Promise.reject(error);
    }

    // No refresh token available — clear and redirect
    if (!getRefreshToken()) {
      clear();
      navigationRef.navigate?.("/login");
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Attempt to refresh the token (dedup concurrent calls)
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_URL}/auth/refresh/`, { refresh: getRefreshToken() })
          .then((res) => {
            setAccessToken(res.data.access);
            setRefreshToken(res.data.refresh);
            return res;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const { data } = await refreshPromise;

      // Retry the original request with the new token
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch {
      clear();
      navigationRef.navigate?.("/login");
      return Promise.reject(error);
    }
  }
);

export default api;
