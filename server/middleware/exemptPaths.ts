const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health"];

export function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;
  return false;
}
