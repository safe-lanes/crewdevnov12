import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../auth/tokens";
import { adminUsersRepository } from "./repository";

const ADMIN_ROLE_NAMES = new Set(
  ["Admin", "Super Admin", "Sail Admin"].map((s) => s.toLowerCase()),
);

const IS_DEV = process.env.NODE_ENV !== "production";
const AUTH_BYPASS = process.env.AUTH_BYPASS === "true" && IS_DEV;

export function ensureAuthUser(req: Request, res: Response, next: NextFunction) {
  if (req.user) return next();
  const auth = req.headers["authorization"];
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    try {
      const claims = verifyAccessToken(auth.slice(7).trim());
      req.user = claims as any;
      return next();
    } catch {
      // fall through
    }
  }
  if (AUTH_BYPASS) return next();
  return res.status(401).json({ error: "unauthorized", message: "Missing or invalid authorization token" });
}

export async function requireAdminRole(req: Request, res: Response, next: NextFunction) {
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
