import { API_BASE_URL } from "../config";
import { tokenStore } from "../auth/tokenStore";

export async function rawPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }
  return data as T;
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
    // the session on its side. Clear locally too.
    await tokenStore.clear();
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
