import CryptoJS from "crypto-js";
import { getDecryptedSessionStorageItem } from "./encryptionService";
import { setTenantId, setTenantDomain, clearTenantData } from "./tenantStorage";

const PARENT_LOGIN_URL = import.meta.env.VITE_PARENT_LOGIN_URL || "";
const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";
const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || "standalone") as "standalone" | "parent";
const secretKey: string = import.meta.env.VITE_CLIENT_ENCRYPTION_KEY || "";

let redirecting = false;

function aesEncrypt(value: string): string {
  if (!secretKey) return value;
  return CryptoJS.AES.encrypt(value, secretKey).toString();
}

function aesDecryptRaw(stored: string | null): string | null {
  if (!stored) return null;
  if (!secretKey) return stored;
  try {
    const bytes = CryptoJS.AES.decrypt(stored, secretKey);
    const out = bytes.toString(CryptoJS.enc.Utf8);
    return out || null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (AUTH_BYPASS) return null;
  // Try plain raw-AES first (standalone format), fall back to parent-app JSON-encoded format.
  const raw = sessionStorage.getItem("credentials");
  const direct = aesDecryptRaw(raw);
  if (direct && direct.length > 0 && !direct.startsWith('"')) return direct;
  const decrypted = getDecryptedSessionStorageItem("credentials", true);
  if (typeof decrypted === "string" && decrypted.length > 0) return decrypted;
  return null;
}

export function getRefreshToken(): string | null {
  if (AUTH_BYPASS) return null;
  const raw = sessionStorage.getItem("refreshCredentials");
  return aesDecryptRaw(raw);
}

export function isAuthRequired(): boolean {
  if (AUTH_BYPASS) return false;
  return true;
}

export function isAuthConfigured(): boolean {
  return sessionStorage.getItem("credentials") !== null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tenantId: string | null;
  domain: string;
  user: {
    id: number;
    uuid?: string | null;
    username: string;
    crewId?: string | null;
    fullName?: string | null;
    designation?: string | null;
    userType?: string | null;
    roleId?: string | null;
    email?: string | null;
  };
}

export function setAuthSession(session: AuthSession): void {
  sessionStorage.setItem("credentials", aesEncrypt(session.accessToken));
  sessionStorage.setItem("refreshCredentials", aesEncrypt(session.refreshToken));
  if (session.user.fullName) {
    sessionStorage.setItem("crewUserName", aesEncrypt(JSON.stringify(session.user.fullName)));
  }
  if (session.user.designation) {
    sessionStorage.setItem("crewDesignation", aesEncrypt(JSON.stringify(session.user.designation)));
  }
  localStorage.setItem("domain", aesEncrypt(JSON.stringify(session.domain)));
  localStorage.setItem("crewUserId", aesEncrypt(JSON.stringify(session.user.id)));
  if (session.tenantId) {
    setTenantId(session.tenantId);
    setTenantDomain(session.domain);
  }
  // userProfile is consumed by PermissionsContext (roleId, userId, userType)
  const profile = {
    userId: String(session.user.id),
    role: undefined as string | undefined,
    roleId: session.user.roleId || undefined,
    userType: session.user.userType || undefined,
  };
  localStorage.setItem("userProfile", aesEncrypt(JSON.stringify(profile)));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem("credentials");
  sessionStorage.removeItem("refreshCredentials");
  sessionStorage.removeItem("crewUserName");
  sessionStorage.removeItem("crewDesignation");
  localStorage.removeItem("crewUserId");
  localStorage.removeItem("userProfile");
  localStorage.removeItem("domain");
  clearTenantData();
}

export function getAuthMode(): "standalone" | "parent" {
  return AUTH_MODE;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch("/api/v2/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.accessToken || !data?.refreshToken) return null;
    sessionStorage.setItem("credentials", aesEncrypt(data.accessToken));
    sessionStorage.setItem("refreshCredentials", aesEncrypt(data.refreshToken));
    if (data.tenantId) setTenantId(data.tenantId);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

export function logout(): void {
  if (redirecting) return;
  redirecting = true;
  // Best-effort server-side revocation (fire-and-forget)
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    const token = getAuthToken();
    fetch("/api/v2/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => {});
  }
  clearAuthSession();
  if (AUTH_MODE === "parent" && PARENT_LOGIN_URL) {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = PARENT_LOGIN_URL;
    return;
  }
  window.location.href = "/login";
}

export function redirectToLogin(): void {
  if (redirecting) return;
  if (AUTH_MODE === "parent" && PARENT_LOGIN_URL) {
    redirecting = true;
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = PARENT_LOGIN_URL;
    return;
  }
  redirecting = true;
  clearAuthSession();
  if (window.location.pathname !== "/login") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
}

export function handleUnauthorized(): void {
  redirectToLogin();
}
