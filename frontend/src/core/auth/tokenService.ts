/**
 * tokenService.ts — Task 1.9: Secure Token Storage
 *
 * Moves token storage from localStorage to sessionStorage to reduce XSS exposure.
 *  - sessionStorage is cleared when the browser tab/window closes (shorter lifetime)
 *  - Access token: sessionStorage (in-memory per tab, not persisted)
 *  - Refresh token: sessionStorage (rotating, short-lived)
 *  - User profile: sessionStorage (re-fetched from API on page load if missing)
 *
 * TODO (Production): For maximum security, move to httpOnly cookies set by the
 * Django backend so tokens are never accessible from JavaScript at all.
 * That requires setting CSRF_COOKIE_HTTPONLY=True and using credentials: 'include'.
 */

const ACCESS_KEY = "hrms_token";
const REFRESH_KEY = "hrms_refresh";
const USER_KEY = "hrms_auth_user";

// ---------------------------------------------------------------------------
// Low-level storage helpers (swap sessionStorage ↔ localStorage here only)
// ---------------------------------------------------------------------------

const store = sessionStorage; // Change to localStorage to revert (not recommended)

function read(key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // Storage quota exceeded or private browsing blocked
    console.warn("[tokenService] Could not write to sessionStorage:", key);
  }
}

function remove(key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Save the JWT access token */
export const saveToken = (token: string): void => write(ACCESS_KEY, token);

/** Get the JWT access token */
export const getToken = (): string | null => read(ACCESS_KEY);

/** Save the JWT refresh token */
export const saveRefreshToken = (token: string): void => write(REFRESH_KEY, token);

/** Get the JWT refresh token */
export const getRefreshToken = (): string | null => read(REFRESH_KEY);

/** Save the authenticated user object */
export const saveAuthUser = (user: unknown): void => {
  write(USER_KEY, JSON.stringify(user ?? null));
};

/** Get the stored user object, or null if none / parse error */
export const getStoredUser = (): unknown => {
  try {
    const raw = read(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Save all auth session data at once (called after login) */
export const saveAuthSession = ({
  access,
  refresh,
  user,
}: {
  access?: string;
  refresh?: string;
  user?: unknown;
}): void => {
  if (access) saveToken(access);
  if (refresh) saveRefreshToken(refresh);
  if (user) saveAuthUser(user);
};

/** Clear all auth data (called on logout or 401) */
export const clearAuthStorage = (): void => {
  remove(ACCESS_KEY);
  remove(REFRESH_KEY);
  remove(USER_KEY);
};

/** Alias for clearAuthStorage — used in older code */
export const removeToken = (): void => clearAuthStorage();

/**
 * Decode a JWT payload (no signature verification — client-side only).
 * Returns the payload object, or null if decoding fails.
 */
export const decodeJwt = (token: string | null): Record<string, unknown> | null => {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const padded =
      payload.length % 4 === 0
        ? payload
        : payload + "=".repeat(4 - (payload.length % 4));
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * Check if the stored access token is expired (or about to expire in <60 seconds).
 * Returns true if expired / missing, false if still valid.
 */
export const isTokenExpired = (): boolean => {
  const token = getToken();
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== "number") return true;
  // Compare server exp (seconds) with current time + 60s buffer
  return payload.exp < Math.floor(Date.now() / 1000) + 60;
};
