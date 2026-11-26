// The sync protocol authenticates machines (instance id + API key headers), not
// people, so it takes no JWT. These paths are outside /api/v2 and exempt by the
// rule below already; they are listed so the exemption survives a change to it.
export const SYNC_PROTOCOL_PATHS = [
  "/api/sync/initiate",
  "/api/sync/push",
  "/api/sync/pull",
  "/api/sync/complete",
];

const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health", ...SYNC_PROTOCOL_PATHS];

export function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;
  return false;
}
