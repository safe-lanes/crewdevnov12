import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewMembersV2,
  crewDocuments,
  crewVisas,
  crewEducation,
  crewLicenses,
  crewTrainingCourses,
  crewSeaService,
  crewPreJoiningMedicals,
  crewDoctorVisits,
  crewBriefings,
  crewDebriefings,
} from "../../../../shared/v2/crew-pool/schema";
import type { CrewTrainingCourse } from "../../../../shared/v2/crew-pool/types";

// The legacy importer resolves references across all these sections for a crew.
const referenceTables = [
  crewDocuments, crewVisas, crewEducation, crewLicenses, crewTrainingCourses,
  crewSeaService, crewPreJoiningMedicals, crewDoctorVisits, crewBriefings, crewDebriefings,
];

function warn(trainUuid: string, reason: string) {
  console.warn("[training-attachment-ref] Training saved; reference not assigned", { trainUuid, reason });
}

/**
 * Called only AFTER the ordinary training/attachment save has committed.
 * Reference allocation has its own transaction so failures never undo that save.
 * All database access uses the current tenant connection (or the caller's same DB).
 */
export async function ensureTrainingAttachmentReference(
  saved: CrewTrainingCourse,
  database?: ReturnType<typeof getDb>,
): Promise<CrewTrainingCourse> {
  // Deliberately null-only: even an existing empty string must be preserved.
  if (!saved || saved.attachmentRef !== null || saved.isDeleted) return saved;

  try {
    const db = database ?? getDb();
    return await db.transaction(async (tx: any) => {
      // Bound lock/query waits: reference allocation must not stall a normal save.
      await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
      // Serialize allocation per crew, including distinct training records with
      // the same abbreviation. The lock is released automatically on commit/error.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(29102026, hashtext(${saved.crewUuid}))`);

      // Re-read persisted values, including concurrent edits and partial updates.
      const [current] = await tx.select().from(crewTrainingCourses).where(and(
        eq(crewTrainingCourses.trainUuid, saved.trainUuid),
        eq(crewTrainingCourses.crewUuid, saved.crewUuid),
        eq(crewTrainingCourses.isDeleted, false),
      )).for("update");
      if (!current) return saved;
      if (current.attachmentRef !== null) {
        return { ...saved, attachmentRef: current.attachmentRef };
      }

      const [crew] = await tx.select({ empNo: crewMembersV2.empNo }).from(crewMembersV2).where(and(
        eq(crewMembersV2.crewUuid, current.crewUuid),
        eq(crewMembersV2.isDeleted, false),
      ));
      const employeeNumber = crew?.empNo?.trim();
      const suffix = current.abbr?.trim() || current.trainingCourse?.trim();
      if (!employeeNumber || !suffix) {
        warn(saved.trainUuid, "Missing employee number or training abbreviation/name");
        return saved;
      }

      const candidate = `${employeeNumber}-T_${suffix}`;
      // Preserve the agreed format. Do not silently sanitize or truncate names,
      // since that can introduce collisions or change the meaning of the reference.
      if (employeeNumber === "." || employeeNumber === ".."
        || /[\\/<>:"|?*\x00-\x1f\x7f]/.test(candidate) || /[. ]$/.test(candidate)
        || Buffer.byteLength(candidate, "utf8") > 255) {
        warn(saved.trainUuid, "Reference is not a safe folder name");
        return saved;
      }

      // Same trim/case-insensitive reference identity used by the importer.
      const matches = await tx.execute(sql`
        SELECT ref FROM (
          ${sql.join(referenceTables.map(table => sql`
            SELECT ${table.attachmentRef} AS ref FROM ${table}
            WHERE ${table.crewUuid} = ${current.crewUuid}
              AND ${table.isDeleted} = false
          `), sql` UNION ALL `)}
        ) AS existing_refs
      `);
      if (matches.rows.some((row: { ref: string | null }) =>
        row.ref?.trim().toUpperCase() === candidate.trim().toUpperCase())) {
        warn(saved.trainUuid, "Reference already belongs to another active record for this crew");
        return saved;
      }

      const [assigned] = await tx.update(crewTrainingCourses).set({ attachmentRef: candidate }).where(and(
        eq(crewTrainingCourses.trainUuid, saved.trainUuid),
        eq(crewTrainingCourses.crewUuid, saved.crewUuid),
        eq(crewTrainingCourses.isDeleted, false),
        isNull(crewTrainingCourses.attachmentRef),
      )).returning();
      return assigned ? { ...saved, attachmentRef: assigned.attachmentRef, updatedAt: assigned.updatedAt } : saved;
    });
  } catch (error) {
    // The training save already succeeded. Log a bounded, non-sensitive reason;
    // retry allocation on the next save rather than reporting a false save failure.
    const code = (error as { code?: string })?.code;
    warn(saved.trainUuid, code ? `Reference allocation failed (${code})` : "Reference allocation failed");
    return saved;
  }
}
