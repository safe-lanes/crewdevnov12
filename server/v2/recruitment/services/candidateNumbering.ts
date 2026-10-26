import { sql } from "drizzle-orm";
import { recruitmentCandidatesV2 } from "../../../../shared/v2/recruitment/schema";

// Shared by import and normal submission, scoped to the current tenant database.
// Hold this lock until the candidate write commits, not just until MAX is read.
export async function lockRecruitmentNumbering(tx: any): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(9642026)`);
}

// A read-only preview unless the caller holds the numbering lock in its write transaction.
export async function nextRecruitmentFileNumber(db: any, now = new Date()): Promise<string> {
  const prefix = `R-${now.getFullYear()}-`;
  const [result] = await db.select({
    maxNum: sql<string>`MAX(CAST(SUBSTRING(${recruitmentCandidatesV2.fileNo} FROM ${`^${prefix}([0-9]+)$`}) AS NUMERIC))`,
  }).from(recruitmentCandidatesV2).where(sql`${recruitmentCandidatesV2.fileNo} LIKE ${`${prefix}%`}`);
  const next = Number(result?.maxNum ?? 0) + 1;
  if (!Number.isSafeInteger(next) || next < 1) throw new Error("Recruitment File No sequence is outside the supported range.");
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function recruitmentSubmissionDate(now = new Date()): string {
  // Same server calendar as the annual File No sequence; date-only, no client clock.
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
