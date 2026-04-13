import { getAuthToken, handleUnauthorized } from "./authToken";
import { getTenantId } from "./tenantStorage";

const originalFetch = window.fetch.bind(window);

window.fetch = function (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  let url: string;
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = (input as Request).url;
  }

  if (url.startsWith("/api")) {
    const headers = new Headers(init.headers);

    const tenantId = getTenantId();
    if (tenantId) {
      headers.set("x-tenant-id", tenantId);
    }

    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    init = { ...init, headers };
  }

  return originalFetch(input, init).then((response) => {
    if (response.status === 401 && url.startsWith("/api")) {
      handleUnauthorized();
      return Promise.reject(new Error("401: Unauthorized - redirecting to login"));
    }
    return response;
  });
};
