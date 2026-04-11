import { getDecryptedSessionStorageItem } from "./encryptionService";

const PARENT_LOGIN_URL = import.meta.env.VITE_PARENT_LOGIN_URL || "";

let redirecting = false;

export function getAuthToken(): string | null {
  const decrypted = getDecryptedSessionStorageItem("credentials", true);
  if (typeof decrypted === "string" && decrypted.length > 0) {
    return decrypted;
  }
  return null;
}

export function isAuthRequired(): boolean {
  return !!PARENT_LOGIN_URL;
}

export function isAuthConfigured(): boolean {
  return sessionStorage.getItem("credentials") !== null;
}

export function redirectToLogin(): void {
  if (redirecting || !PARENT_LOGIN_URL) return;
  redirecting = true;
  const currentUrl = encodeURIComponent(window.location.href);
  window.location.href = `${PARENT_LOGIN_URL}?redirect=${currentUrl}`;
}

export function handleUnauthorized(): void {
  redirectToLogin();
}
