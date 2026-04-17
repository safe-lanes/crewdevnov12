const EXEMPT_PATHS = [
  "/api/v2/tenant/init",
  "/api/health",
  "/api/v2/auth/login",
  "/api/v2/auth/refresh",
  "/api/v2/auth/forgot-password",
  "/api/v2/auth/reset-password",
  // Logout must succeed even when the access token is expired; the handler
  // resolves the tenant itself from the refresh-token claim (domain).
  "/api/v2/auth/logout",
];

export function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;
  return false;
}
