import { useState, useEffect, useRef } from "react";

async function resolveDomain(): Promise<string> {
  try {
    const mod = await import("@/lib/encryptionService");
    const decrypted = mod.getDecryptedLocalStorageItem("domain", true);
    if (decrypted) return mod.extractStringValue(decrypted);
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
      if (existingTenantId) {
        setTenantId(existingTenantId);
        setIsResolved(true);
        return;
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
            setTenantId(data.tenantId);
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          if (res.status === 503) {
            setIsResolved(true);
            setIsLoading(false);
            return;
          }

          if (res.status === 404) {
            setError(`Company not found for domain: ${domain}`);
            setIsLoading(false);
            return;
          }

          throw new Error(`Unexpected response: ${res.status}`);
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
