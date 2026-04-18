import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000/api";
const ACCESS_KEY = "token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "auth_user";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_KEY);

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;

    if (!original || status !== 401) {
      return Promise.reject(error);
    }

    if (original._retry) {
      return Promise.reject(error);
    }

    if (original.url && String(original.url).includes("/auth/token/refresh/")) {
      return Promise.reject(error);
    }

    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
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
        localStorage.setItem(ACCESS_KEY, newAccess);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return axiosInstance(original);
      }
    } catch (refreshErr) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
      return Promise.reject(refreshErr);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
