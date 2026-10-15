import type { Request } from "express";
import { eq, and } from "drizzle-orm";
import { masterUsers, masterManningAgents } from "../../../../shared/schema";
import { getDb } from "../../db";
import { accessControlService } from "../../admin/services/accessControlService";

export class ImportAccessError extends Error {}
export type ImportActor = { auditUuid: string | null; manningAgent: string | null };
const isVesselUser = (value: unknown) => typeof value === "string" && /^(ship|vessel)$/i.test(value.trim());

export async function authorizeImport(req: Request): Promise<ImportActor> {
  const devBypass = process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS === "true" && !process.env.JWT_SECRET;
  if (!req.user) {
    if (devBypass) return { auditUuid: typeof req.body?.auditUserUuid === "string" ? req.body.auditUserUuid : null, manningAgent: null };
    throw new ImportAccessError("Authentication is required.");
  }
  if (isVesselUser(req.user.userType)) throw new ImportAccessError("Vessel users cannot import recruitment candidates.");
  // Parent users sync preserves explicit IDs. Resolve in the authenticated tenant,
  // never from an editable browser profile, workbook, or UUID-only fallback.
  const claimId: unknown = req.user.id;
  const userId = typeof claimId === "string" && /^[1-9]\d*$/.test(claimId) ? Number(claimId) : claimId;
  if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    throw new ImportAccessError("A valid signed user ID is required for Recruitment imports.");
  }
  const db = getDb();
  const [user] = await db.select().from(masterUsers).where(eq(masterUsers.id, userId)).limit(1);
  if (typeof user?.userUuid !== "string" || !user.userUuid.trim() || typeof user.role !== "string" || !user.role.trim()) {
    throw new ImportAccessError("Your server-side user/role mapping is unavailable. Contact your administrator.");
  }
  if (isVesselUser(user.userType)) throw new ImportAccessError("Vessel users cannot import recruitment candidates.");
  const signedUserUuid = (req.user as typeof req.user & { userUuid?: string }).userUuid;
  if (signedUserUuid !== undefined && signedUserUuid !== user.userUuid) {
    throw new ImportAccessError("The signed user UUID does not match the authenticated account.");
  }
  if (req.body?.auditUserUuid && req.body.auditUserUuid !== user.userUuid) throw new ImportAccessError("The audit user does not match the authenticated account.");
  const result = await accessControlService.getMyPermissions(undefined, user.role);
  const permission = result.permissions.find(p => p.menuName.toLowerCase() === "in progress");
  if (!permission?.canview || !permission.cancreate) throw new ImportAccessError("Recruitment In Progress create access is required.");
  let manningAgent: string | null = null;
  if (/manning\s*agent/i.test(user.role) || /manning\s*agent/i.test(req.user.userType)) {
    // Only an authenticated, signed parent claim can grant agency ownership.
    // The editable workbook and browser-local userProfile are NOT authorization sources.
    const claim = (req.user as typeof req.user & { manningAgent?: string }).manningAgent;
    if (!claim) throw new ImportAccessError("Manning Agent imports require an authenticated agency assignment from the parent application.");
    const matches = await db.select().from(masterManningAgents).where(and(eq(masterManningAgents.isDeleted, false), eq(masterManningAgents.isActive, true)));
    const own = matches.filter((a: { id: string; name: string }) => a.id === claim || a.name === claim);
    if (own.length !== 1) throw new ImportAccessError("The authenticated agency assignment is invalid or ambiguous.");
    manningAgent = own[0].name;
  }
  return { auditUuid: user.userUuid, manningAgent };
}
