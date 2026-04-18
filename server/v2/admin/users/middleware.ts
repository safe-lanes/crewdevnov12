import type { Request, Response, NextFunction } from "express";
import { adminUsersRepository } from "./repository";

const ADMIN_ROLE_NAMES = new Set(
  ["Admin", "Super Admin", "Sail Admin"].map((s) => s.toLowerCase()),
);

const IS_DEV = process.env.NODE_ENV !== "production";
const AUTH_BYPASS = process.env.AUTH_BYPASS === "true" && IS_DEV;
// Parent-mode trust: when Crewing is embedded under the SAIL Audits parent app,
// parent-signed JWTs cannot be verified against Crewing's JWT_SECRET, so per the
// #251 lenient header-path tenantMiddleware leaves `req.user` undefined. The
// parent app has already authenticated the user before handing off, and the
// tenant DB context is bound from the `x-tenant-id` header by tenantMiddleware,
// so we short-circuit identity/role checks on this router. Trade-off: audit
// attribution (callerActor) is empty for parent-mode writes — accepted for now.
const PARENT_AUTH_MODE = process.env.AUTH_MODE === "parent";

/**
 * Thin guard: by the time a request reaches this router, the global
 * tenantMiddleware (production) or authMiddleware (development) should have
 * already verified the JWT and populated `req.user`. We do not re-verify here
 * — having two independent verifies caused subtle 401s in production whenever
 * the two paths' decode/secret handling drifted.
 */
export function ensureAuthUser(req: Request, res: Response, next: NextFunction) {
  if (PARENT_AUTH_MODE) return next();
  if (req.user) return next();
  if (AUTH_BYPASS) return next();
  return res.status(401).json({
    error: "unauthorized",
    message: "Missing or invalid authorization token",
  });
}

export async function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (PARENT_AUTH_MODE) return next();
  if (AUTH_BYPASS && !req.user) return next();
  const u = req.user;
  if (!u) {
    return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
  }
  if (!u.roleId) {
    return res.status(403).json({ error: "forbidden", message: "Admin role required" });
  }
  try {
    const roleName = await adminUsersRepository.getRoleNameByRuid(u.roleId);
    if (roleName && ADMIN_ROLE_NAMES.has(roleName.trim().toLowerCase())) {
      return next();
    }
    return res.status(403).json({ error: "forbidden", message: "Admin role required" });
  } catch (err) {
    console.error("[admin-users] role check failed:", (err as Error).message);
    return res.status(500).json({ error: "server_error", message: "Failed to verify role" });
  }
}
