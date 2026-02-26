const originalFetch = window.fetch.bind(window);

window.fetch = function (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const tenantId = localStorage.getItem("tenantId");
  if (tenantId) {
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
      headers.set("x-tenant-id", tenantId);
      init = { ...init, headers };
    }
  }
  return originalFetch(input, init);
};
