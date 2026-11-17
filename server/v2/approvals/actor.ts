/**
 * Who is acting on an approval: built ONLY from the login token (never from the request body).
 *
 *   userId   = master_users.user_uuid of the signed-in user (looked up by the JWT numeric id)
 *   role     = the Access Control role name resolved for this tenant (resolveRequestRole)
 *   userType = 'Office' | 'Ship' from the JWT
 *   isAdmin  = SAIL Admin / Super Admin (lets the engine allow an admin decision on a step
 *              that has no approver, the same rule Technical uses)
 *
 * Approver ids in every chain are user_uuids too (see roles.ts), so the engine compares like
 * with like.
 */
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { masterUsers } from "../../../shared/schema";
import { resolveRequestRole } from "../auth/roleResolutionService";
import type { EngineCtx } from "../approval-engine";

export type ApprovalActor = EngineCtx["actor"];

declare global {
  namespace Express {
    interface Request {
      approvalActor?: ApprovalActor;
    }
  }
}

const ADMIN_ROLE_NAMES: ReadonlySet<string> = new Set(["sail admin", "super admin"]);

function normalizeUserType(raw: unknown): "Office" | "Ship" | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "office") return "Office";
  if (v === "ship") return "Ship";
  return null;
}

/**
 * Resolves (and caches on req) the approval actor. Returns null when the request has no
 * signed-in master user with a user_uuid, or when the role cannot be resolved for this tenant.
 */
export async function resolveApprovalActor(req: Request): Promise<ApprovalActor | null> {
  if (req.approvalActor) return req.approvalActor;
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId)) return null;

  const resolution = await resolveRequestRole(req);
  if (!resolution.ok) return null;

  const rows = await getDb()
    .select({ userUuid: masterUsers.userUuid })
    .from(masterUsers)
    .where(eq(masterUsers.id, userId))
    .limit(1);
  const userUuid = rows[0]?.userUuid?.trim();
  if (!userUuid) return null;

  const roleName = resolution.role.roleName;
  const actor: ApprovalActor = {
    userId: userUuid,
    role: roleName,
    userType: normalizeUserType(req.user?.userType),
    isAdmin: ADMIN_ROLE_NAMES.has(roleName.trim().toLowerCase()),
  };
  req.approvalActor = actor;
  return actor;
}

/** Express guard for the engine routes: resolve the actor or refuse with 403. */
export async function requireApprovalActor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = await resolveApprovalActor(req);
    if (!actor) {
      res.status(403).json({ error: "forbidden", message: "Your user or role could not be resolved for approvals." });
      return;
    }
    next();
  } catch (err) {
    console.error("[approvals] actor resolution failed:", err);
    res.status(403).json({ error: "forbidden", message: "Your user or role could not be resolved for approvals." });
  }
}
