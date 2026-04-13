import CryptoJS from "crypto-js";

const secretKey: string = import.meta.env.VITE_CLIENT_ENCRYPTION_KEY || "";

function encrypt(value: string): string {
  if (!secretKey) return value;
  try {
    return CryptoJS.AES.encrypt(value, secretKey).toString();
  } catch {
    return value;
  }
}

function decrypt(stored: string): string | null {
  if (!secretKey) return stored;
  try {
    const bytes = CryptoJS.AES.decrypt(stored, secretKey);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

const TENANT_ID_KEY = "tenantId";
const TENANT_DOMAIN_KEY = "tenantDomain";

export function getTenantId(): string | null {
  const raw = localStorage.getItem(TENANT_ID_KEY);
  if (!raw) return null;
  return decrypt(raw);
}

export function setTenantId(value: string): void {
  localStorage.setItem(TENANT_ID_KEY, encrypt(value));
}

export function getTenantDomain(): string | null {
  const raw = localStorage.getItem(TENANT_DOMAIN_KEY);
  if (!raw) return null;
  return decrypt(raw);
}

export function setTenantDomain(value: string): void {
  localStorage.setItem(TENANT_DOMAIN_KEY, encrypt(value));
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
