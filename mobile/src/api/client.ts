import type { ZodType } from "zod";
import { API_BASE_URL } from "../config";
import { tokenStore } from "../auth/tokenStore";
import { queryClient } from "../queryClient";

export type ApiError = Error & { status?: number; details?: unknown };

/**
 * Shared response parser for every api/*.ts module — was five near-identical
 * hand-copies of this before. `message` takes priority over `error` since
 * crewInformationApi's controller returns richer messages that way; every
 * other crew-app controller only ever sets `error`, so this is a strict
 * superset of what each file checked before.
 *
 * `schema`, when given, validates the response body at runtime — without it,
 * `res.json()` is trusted blindly (cast with `as T`), so a backend field
 * rename or a malformed payload would otherwise flow straight into screen
 * state until something crashes on access far from the actual cause.
 */
export async function parseOrThrow<T>(res: Response, fallbackError: string, schema?: ZodType<T>): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || body.error || fallbackError) as ApiError;
    error.status = res.status;
    error.details = body.details;
    throw error;
  }
  if (!schema) return body as T;
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = new Error(`Unexpected response shape (${fallbackError})`) as ApiError;
    error.status = res.status;
    error.details = result.error.flatten();
    throw error;
  }
  return result.data;
}

export async function rawPost<T = any>(path: string, body: unknown, schema?: ZodType<T>): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<T>(res, "Request failed", schema);
}

let inFlightRefresh: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const { refreshToken, domain, deviceId } = tokenStore.get();
  if (!refreshToken) return false;
  try {
    const result = await rawPost<{ accessToken: string; refreshToken: string }>(
      "/api/crew-app/auth/refresh",
      { refreshToken, deviceId },
    );
    await tokenStore.set({ accessToken: result.accessToken, refreshToken: result.refreshToken, domain });
    return true;
  } catch {
    // Refresh token was invalid, expired, or reused — server has already killed
    // the session on its side. Clear locally too, cached crew-information included.
    await tokenStore.clear();
    queryClient.clear();
    return false;
  }
}

export function refreshCrewSession(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/**
 * Fetch wrapper for authenticated calls. Attaches the current access token and,
 * on a 401, refreshes and retries exactly once. The server's refresh tokens are
 * single-use, so concurrent 401s must share one in-flight refresh rather than
 * each independently calling /refresh — otherwise the second caller would look
 * like a replay of an already-rotated token and the whole session would be
 * force-logged-out for no reason.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const { accessToken } = tokenStore.get();
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  };

  let response = await doFetch();

  if (response.status === 401) {
    const refreshed = await refreshCrewSession();
    if (refreshed) {
      response = await doFetch();
    }
  }

  return response;
}
