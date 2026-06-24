/**
 * axios.js — Configured Axios instance for the HRMS API
 *
 * Changes (Task 1.9):
 *  - Reads tokens via tokenService (sessionStorage) instead of raw localStorage
 *  - Calls /api/auth/logout/ on refresh failure to blacklist the used refresh token
 *  - Uses isTokenExpired() for proactive pre-emptive refresh before request
 */

import axios from "axios";
import {
  clearAuthStorage,
  getRefreshToken,
  getToken,
  isTokenExpired,
  saveToken,
} from "../core/auth/tokenService";

export const API_BASE_URL = "http://127.0.0.1:8000/api";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token to every authenticated request
// ---------------------------------------------------------------------------
axiosInstance.interceptors.request.use(
  async (config) => {
    let token = getToken();

    // Proactively refresh if token is about to expire (within 60 seconds)
    if (token && isTokenExpired()) {
      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const refreshRes = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh,
          });
          const newAccess = refreshRes?.data?.access;
          if (newAccess) {
            saveToken(newAccess);
            token = newAccess;
          }
        } catch {
          // Refresh failed — clear and redirect below via response interceptor
          clearAuthStorage();
        }
      }
    }

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 Unauthorized with token refresh retry
// ---------------------------------------------------------------------------
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;

    if (!original || status !== 401) {
      return Promise.reject(error);
    }

    // Don't retry refresh endpoint itself
    if (original._retry) {
      return Promise.reject(error);
    }

    if (original.url && String(original.url).includes("/auth/token/refresh/")) {
      return Promise.reject(error);
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      clearAuthStorage();
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
      return Promise.reject(error);
    }

    try {
      original._retry = true;
      const refreshRes = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
        refresh,
      });

      const newAccess = refreshRes?.data?.access;
      if (newAccess) {
        saveToken(newAccess);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return axiosInstance(original);
      }
    } catch (refreshErr) {
      // Refresh token is invalid — blacklist it server-side and redirect to login
      clearAuthStorage();
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
      return Promise.reject(refreshErr);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
