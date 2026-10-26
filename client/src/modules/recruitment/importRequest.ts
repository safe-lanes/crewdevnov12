import { getAuthToken } from "@/lib/authToken";
import { getTenantId } from "@/lib/tenantStorage";

// Explicit headers make import authentication independent of the global
// tenantFetch interceptor installed by main.tsx. Keep Response for cell errors.
export function importRequest(action: "template" | "validate" | "execute", data?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  const tenantId = getTenantId();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers["x-tenant-id"] = tenantId;
  if (data !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`/api/v2/recruitment/import/${action}`, {
    method: data === undefined ? "GET" : "POST",
    credentials: "include",
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
