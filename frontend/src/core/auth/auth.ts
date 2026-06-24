/**
 * auth.ts — Task 1.9: Backward-compatible re-export layer
 *
 * All existing code imports from this file — we keep those imports working
 * by re-exporting everything from the new tokenService (which uses
 * sessionStorage instead of localStorage for improved XSS safety).
 */

export {
  saveToken,
  getToken,
  getRefreshToken,
  saveRefreshToken,
  saveAuthUser,
  getStoredUser,
  saveAuthSession,
  clearAuthStorage,
  removeToken,
  decodeJwt,
  isTokenExpired,
} from "./tokenService";
