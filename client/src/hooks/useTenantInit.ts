import { useState, useEffect, useRef } from "react";

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

export function useTenantInit(): TenantInitResult {
  const [tenantId, setTenantId] = useState<string | null>(
    localStorage.getItem("tenantId"),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const initAttempted = useRef(false);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const run = async () => {
      const domain = await resolveDomain();

      if (!domain) {
        setIsResolved(true);
        return;
      }

      const existingTenantId = localStorage.getItem("tenantId");
      const cachedDomain = localStorage.getItem("tenantDomain");
      if (existingTenantId && cachedDomain === domain) {
        setTenantId(existingTenantId);
        setIsResolved(true);
        return;
      }

      if (existingTenantId && cachedDomain !== domain) {
        localStorage.removeItem("tenantId");
        localStorage.removeItem("tenantDomain");
      }

      setIsLoading(true);

      const initTenant = async (retryCount = 0) => {
        try {
          const res = await fetch("/api/v2/tenant/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain }),
          });

          if (res.ok) {
            const data = await res.json();
            localStorage.setItem("tenantId", data.tenantId);
            localStorage.setItem("tenantDomain", domain);
            setTenantId(data.tenantId);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          if (res.status === 503) {
            localStorage.removeItem("tenantId");
            localStorage.removeItem("tenantDomain");
            setTenantId(null);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          const errorData = await res.json().catch(() => null);

          if (res.status === 404) {
            setError(errorData?.message || `No company registered for domain: ${domain}`);
            setIsLoading(false);
            return;
          }

          if (res.status === 403) {
            setError(errorData?.message || `Company account for domain '${domain}' is currently inactive. Please contact your administrator.`);
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
          setIsLoading(false);
        }
      };

      await initTenant();
    };

    run();
  }, []);

  return { tenantId, isLoading, error, isResolved };
}
