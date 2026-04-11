import { getDecryptedSessionStorageItem } from "./encryptionService";

const PARENT_LOGIN_URL = import.meta.env.VITE_PARENT_LOGIN_URL || "";
const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

let redirecting = false;

export function getAuthToken(): string | null {
  if (AUTH_BYPASS) return null;
  const decrypted = getDecryptedSessionStorageItem("credentials", true);
  if (typeof decrypted === "string" && decrypted.length > 0) {
    return decrypted;
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
