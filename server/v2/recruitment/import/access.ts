import type { Request } from "express";
import { eq } from "drizzle-orm";
import { masterUsers } from "../../../../shared/schema";
import { getDb } from "../../db";

export class ImportAccessError extends Error {}
export type ImportActor = { auditUuid: string | null };

export async function authorizeImport(req: Request): Promise<ImportActor> {
  const devBypass = process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS === "true" && !process.env.JWT_SECRET;
  if (!req.user) {
    if (devBypass) return { auditUuid: null };
    throw new ImportAccessError("Authentication is required.");
  }
  // Parent users sync preserves explicit IDs. Resolve in the authenticated tenant,
  // never from an editable browser profile, workbook, or UUID-only fallback.
  const claimId: unknown = req.user.id;
  const userId = typeof claimId === "string" && /^[1-9]\d*$/.test(claimId) ? Number(claimId) : claimId;
  if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    throw new ImportAccessError("A valid signed user ID is required for Recruitment imports.");
  }
  const db = getDb();
  const [user] = await db.select().from(masterUsers).where(eq(masterUsers.id, userId)).limit(1);
  if (!user) throw new ImportAccessError("Your authenticated account is not present in the user master. Contact your administrator.");
  // Import access deliberately requires user existence only. Audit attribution
  // is server-derived and nullable, never an extra access gate or browser override.
  return { auditUuid: typeof user.userUuid === "string" && user.userUuid.trim() ? user.userUuid : null };
}
