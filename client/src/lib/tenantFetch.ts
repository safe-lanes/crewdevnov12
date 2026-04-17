import { getAuthToken, refreshAccessToken, redirectToLogin } from "./authToken";
import { getTenantId } from "./tenantStorage";

const originalFetch = window.fetch.bind(window);

let refreshPromise: Promise<string | null> | null = null;

function singleFlightRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      // Allow next refresh after a tick
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    });
  }
  return refreshPromise;
}

function buildHeaders(init: RequestInit, token: string | null): Headers {
  const headers = new Headers(init.headers);
  const tenantId = getTenantId();
  if (tenantId) headers.set("x-tenant-id", tenantId);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

window.fetch = async function (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const url = urlOf(input);
  const isApi = url.startsWith("/api");
  if (!isApi) return originalFetch(input, init);

  // Skip interception for all public auth endpoints AND for /logout.
  // - login/refresh/forgot-password/reset-password are unauthenticated flows whose
  //   own 401s must surface to the caller (e.g., "invalid reset token") instead of
  //   triggering a session refresh / redirect.
  // - /logout must be sent with the user's *current* refresh token; if the access
  //   token is expired we'd otherwise refresh (rotating R1 -> R2) and then retry
  //   /logout with the stale R1, leaving R2 active. The logout handler tolerates
  //   401-on-access-token by best-effort revoking the refresh token in the body.
  const AUTH_BYPASS_PATHS = [
    "/api/v2/auth/login",
    "/api/v2/auth/refresh",
    "/api/v2/auth/logout",
    "/api/v2/auth/forgot-password",
    "/api/v2/auth/reset-password",
  ];
  if (AUTH_BYPASS_PATHS.some((p) => url.includes(p))) {
    return originalFetch(input, init);
  }

  const token = getAuthToken();
  let headers = buildHeaders(init, token);
  let response = await originalFetch(input, { ...init, headers });

  if (response.status !== 401) return response;

  // Try a single-flight silent refresh
  const newToken = await singleFlightRefresh();
  if (!newToken) {
    redirectToLogin();
    return response;
  }
  headers = buildHeaders(init, newToken);
  response = await originalFetch(input, { ...init, headers });
  if (response.status === 401) {
    redirectToLogin();
  }
  return response;
};
