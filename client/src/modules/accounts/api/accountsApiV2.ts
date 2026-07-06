import { apiRequest } from "@/lib/queryClient";

export const ACCOUNTS_BASE = "/api/v2/accounts";

/** Structured view of an apiRequest error string (`"<status>: <body>"`). */
export interface ApiErrorInfo {
  status: number | null;
  message: string;
  data: any;
}

/** Parse the `"<status>: <json|text>"` error thrown by apiRequest. */
export function parseApiError(err: unknown): ApiErrorInfo {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!match) return { status: null, message: raw, data: null };
  const status = parseInt(match[1], 10);
  let data: any = null;
  try {
    data = JSON.parse(match[2]);
  } catch {
    /* body was not JSON */
  }
  return { status, message: (data && data.error) || match[2] || raw, data };
}

async function req<T = any>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await apiRequest(method, url, body);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const accountsApiV2 = {
  config: {
    update: (data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/config`, data),
  },
  payElements: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/pay-elements`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/pay-elements/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/pay-elements/${uuid}`),
    seedStandard: () =>
      req("POST", `${ACCOUNTS_BASE}/pay-elements/seed-standard`),
  },
  wageScales: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/wage-scales`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/wage-scales/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/wage-scales/${uuid}`),
    replaceLines: (uuid: string, lines: unknown[]) =>
      req("PUT", `${ACCOUNTS_BASE}/wage-scales/${uuid}/lines`, { lines }),
    activate: (uuid: string, acknowledge?: boolean) =>
      req("POST", `${ACCOUNTS_BASE}/wage-scales/${uuid}/activate`, {
        acknowledge,
      }),
    supersede: (uuid: string, effectiveTo?: string) =>
      req("POST", `${ACCOUNTS_BASE}/wage-scales/${uuid}/supersede`, {
        effectiveTo,
      }),
  },
  cbaReference: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/cba-reference`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/cba-reference/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/cba-reference/${uuid}`),
  },
};
