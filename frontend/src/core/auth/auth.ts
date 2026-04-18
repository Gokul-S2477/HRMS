// frontend/src/core/auth/auth.ts

const ACCESS_KEY = "token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "auth_user";

export const saveToken = (token: string) => {
  localStorage.setItem(ACCESS_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(ACCESS_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_KEY);
};

export const saveAuthUser = (user: any) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export const saveAuthSession = ({ access, refresh, user }: { access?: string; refresh?: string; user?: any }) => {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (user) saveAuthUser(user);
};

export const clearAuthStorage = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};

export const removeToken = () => {
  clearAuthStorage();
};

/**
 * Decode JWT payload (no verification) and return object or null.
 * Works for standard JWT format header.payload.signature
 */
export const decodeJwt = (token: string | null) => {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const pad = payload.length % 4 === 0 ? payload : payload + "=".repeat(4 - (payload.length % 4));
    const decoded = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
};
