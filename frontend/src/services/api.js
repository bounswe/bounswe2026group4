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
  paramsSerializer: {
    serialize: (params) => {
      const sp = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (Array.isArray(val)) {
          val.forEach((v) => sp.append(key, String(v)));
        } else if (val !== undefined && val !== null) {
          sp.append(key, String(val));
        }
      }
      return sp.toString();
    },
  },
});

/** Endpoints that should never trigger a token refresh. */
const AUTH_ENDPOINTS = ["/auth/login/", "/auth/token/refresh/", "/auth/logout/"];

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
    if (AUTH_ENDPOINTS.some((ep) => requestUrl.includes(ep))) {
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
    let refreshedData;
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_URL}/auth/token/refresh/`, { refresh: getRefreshToken() })
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
      refreshedData = data;
    } catch {
      clear();
      navigationRef.navigate?.("/login");
      return Promise.reject(error);
    }

    // Retry the original request with the new token — let non-auth errors
    // propagate to the caller instead of incorrectly logging out.
    originalRequest.headers.Authorization = `Bearer ${refreshedData.access}`;
    return api(originalRequest);
  }
);

export default api;
