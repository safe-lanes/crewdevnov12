import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "./authToken";
import { getTenantId } from "./tenantStorage";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const tenantId = getTenantId();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (tenantId) headers["x-tenant-id"] = tenantId;

  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn: <T>() => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    const tenantId = getTenantId();
    const headers: Record<string, string> = {};
    if (tenantId) headers["x-tenant-id"] = tenantId;

    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers,
    });

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      // Retry once on 429 (rate-limited) responses so transient bursts recover
      // gracefully instead of surfacing as red error states in the UI.
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        const msg = error instanceof Error ? error.message : String(error);
        return /^429:/.test(msg);
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
