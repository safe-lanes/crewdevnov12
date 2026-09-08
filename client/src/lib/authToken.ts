import { getDecryptedSessionStorageItem, deepParseJson } from "./encryptionService";
import { getDevPersonaToken } from "./devPersona";

const PARENT_LOGIN_URL = import.meta.env.VITE_PARENT_LOGIN_URL || "";
const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

let redirecting = false;

export function getAuthToken(): string | null {
  // Dev bypass: no real credentials. If the dev persona switcher has set an
  // unsigned override token, send it so the backend (AUTH_BYPASS decode path)
  // sees the simulated identity; otherwise send no Authorization header.
  if (AUTH_BYPASS) return getDevPersonaToken();
  const decrypted = getDecryptedSessionStorageItem("credentials", true);
  if (typeof decrypted === "string" && decrypted.length > 0) {
    // The parent app's handoff double-JSON-encodes the token before
    // encrypting it, so decryptData()'s single JSON.parse leaves a string
    // that still has its own wrapping quotes (confirmed in production:
    // Bearer "<jwt>" -> 401 invalid_token, Bearer <jwt> -> 200). Unwrap any
    // extra stringification layers; no-op if the token is already bare.
    const unwrapped = deepParseJson(decrypted);
    return typeof unwrapped === "string" && unwrapped.length > 0
      ? unwrapped
      : decrypted;
  }
  return null;
}

export function isAuthRequired(): boolean {
  if (AUTH_BYPASS) return false;
  return true;
}

export function isAuthConfigured(): boolean {
  return sessionStorage.getItem("credentials") !== null;
}

export function logout(): void {
  if (redirecting || !PARENT_LOGIN_URL) return;
  redirecting = true;
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = `${PARENT_LOGIN_URL}`;
}

export function redirectToLogin(): void {
  logout();
}

export function handleUnauthorized(): void {
  redirectToLogin();
}
