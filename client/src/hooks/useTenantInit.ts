import { useState, useEffect, useRef } from "react";
import {
  getTenantId as storedTenantId,
  getTenantDomain,
  setTenantId as storeTenantId,
  setTenantDomain,
  clearTenantData,
  hasCachedTenant,
} from "@/lib/tenantStorage";

function extractStringValue(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    return val.value || val.name || val.label || JSON.stringify(val);
  }
  return String(val);
}

async function resolveDomain(): Promise<string> {
  try {
    const mod = await import("@/lib/encryptionService");
    const decrypted = mod.getDecryptedLocalStorageItem("domain", true);
    if (decrypted) return extractStringValue(decrypted);
    return localStorage.getItem("domain") || "";
  } catch {
    return localStorage.getItem("domain") || "";
  }
}

interface TenantInitResult {
  tenantId: string | null;
  isLoading: boolean;
  error: string | null;
  isResolved: boolean;
}

function hasPossibleDomain(): boolean {
  if (localStorage.getItem("domain")) return true;
  if (hasCachedTenant()) return true;
  return false;
}

export function useTenantInit(): TenantInitResult {
  const possibleDomain = hasPossibleDomain();
  const [tenantId, setTenantId] = useState<string | null>(
    storedTenantId(),
  );
  const [isLoading, setIsLoading] = useState(possibleDomain);
  const [error, setError] = useState<string | null>(null);
  const [isResolved, setIsResolved] = useState(!possibleDomain);
  const initAttempted = useRef(false);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const run = async () => {
      const domain = await resolveDomain();

      if (!domain) {
        setIsLoading(false);
        setIsResolved(true);
        return;
      }

      const existingTenantId = storedTenantId();
      const cachedDomain = getTenantDomain();
      if (existingTenantId && cachedDomain === domain) {
        setTenantId(existingTenantId);
        setIsLoading(false);
        setIsResolved(true);
        return;
      }

      if (existingTenantId && cachedDomain !== domain) {
        clearTenantData();
      }

      const initTenant = async (retryCount = 0) => {
        try {
          const res = await fetch("/api/v2/tenant/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain }),
          });

          if (res.ok) {
            const data = await res.json();
            storeTenantId(data.tenantId);
            setTenantDomain(domain);
            setTenantId(data.tenantId);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          if (res.status === 503) {
            clearTenantData();
            setTenantId(null);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          const errorData = await res.json().catch(() => null);

          if (res.status === 404) {
            setError(errorData?.message || `No company registered for domain: ${domain}`);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          if (res.status === 403) {
            setError(errorData?.message || `Company account for domain '${domain}' is currently inactive. Please contact your administrator.`);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          throw new Error(errorData?.message || `Unexpected response: ${res.status}`);
        } catch (err: any) {
          if (retryCount < 1) {
            setTimeout(() => initTenant(retryCount + 1), 2000);
            return;
          }
          setError(err.message || "Failed to connect to tenant database");
          setIsResolved(true);
          setIsLoading(false);
        }
      };

      await initTenant();
    };

    run();
  }, []);

  return { tenantId, isLoading, error, isResolved };
}
