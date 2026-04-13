import CryptoJS from "crypto-js";
import { secretKeyAvailable } from "./encryptionService";

const secretKey: string = import.meta.env.VITE_CLIENT_ENCRYPTION_KEY || "";

const TENANT_ID_KEY = "tenantId";
const TENANT_DOMAIN_KEY = "tenantDomain";

function encryptValue(value: string): string {
  if (!secretKeyAvailable()) return value;
  try {
    return CryptoJS.AES.encrypt(value, secretKey).toString();
  } catch {
    return value;
  }
}

function decryptValue(stored: string): string | null {
  if (!secretKeyAvailable()) return stored;
  try {
    const bytes = CryptoJS.AES.decrypt(stored, secretKey);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

export function getTenantId(): string | null {
  const raw = localStorage.getItem(TENANT_ID_KEY);
  if (!raw) return null;
  return decryptValue(raw);
}

export function setTenantId(value: string): void {
  localStorage.setItem(TENANT_ID_KEY, encryptValue(value));
}

export function getTenantDomain(): string | null {
  const raw = localStorage.getItem(TENANT_DOMAIN_KEY);
  if (!raw) return null;
  return decryptValue(raw);
}

export function setTenantDomain(value: string): void {
  localStorage.setItem(TENANT_DOMAIN_KEY, encryptValue(value));
}

export function clearTenantData(): void {
  localStorage.removeItem(TENANT_ID_KEY);
  localStorage.removeItem(TENANT_DOMAIN_KEY);
}

export function hasCachedTenant(): boolean {
  return (
    localStorage.getItem(TENANT_ID_KEY) !== null &&
    localStorage.getItem(TENANT_DOMAIN_KEY) !== null
  );
}
