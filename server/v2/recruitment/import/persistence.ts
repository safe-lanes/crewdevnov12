import { and, eq, sql } from "drizzle-orm";
import { v4, v5 } from "uuid";
import * as tables from "../../../../shared/v2/recruitment/schema";
import { BLOCKS, type Parsed } from "./contract";
import { getDb } from "../../db";
import { lockRecruitmentNumbering, nextRecruitmentFileNumber, recruitmentSubmissionDate } from "../services/candidateNumbering";

const bindings = {
  candidate: tables.recruitmentCandidatesV2, personal: tables.candPersonalDetails,
  address: tables.candAddresses, family: tables.candFamilyInfo, nok: tables.candNextOfKin,
  children: tables.candChildren, vesselTypes: tables.candVesselTypesApplied,
  documents: tables.candDocuments, visas: tables.candVisas, education: tables.candEducation,
  licenses: tables.candLicenses, training: tables.candTrainingCourses,
  sea: tables.candSeaService, additional: tables.candAdditionalInfo,
};
const NAMESPACE = "bf5b954d-4b5a-4c9f-91d6-dc413ed620c1";
export function cleanRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => key !== "__row" && value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "")));
}
export function candidateFingerprint(parsed: Parsed): string {
  // Empty workbook rows and audit actor do not alter retry identity.
  return v5(JSON.stringify(BLOCKS.map(b => (parsed.data[b.entity] || []).map(cleanRecord))), NAMESPACE);
}
export class DuplicateImportError extends Error {}

// All database reads/writes here use the supplied tenant transaction, never another repository connection.
export async function writeCandidate(tx: any, parsed: Parsed, auditUuid: string | null): Promise<string> {
  const recCanUuid = candidateFingerprint(parsed);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(9522026)`);
  const core = cleanRecord(parsed.data.candidate[0]);
  const existing = await tx.select().from(tables.recruitmentCandidatesV2).where(eq(tables.recruitmentCandidatesV2.recCanUuid, recCanUuid)).limit(1);
  if (existing.length) throw new DuplicateImportError("This candidate workbook was already imported. Open the existing candidate; it has not been changed.");
  if (core.dob && core.familyName) {
    const matches = await tx.select({ id: tables.recruitmentCandidatesV2.id }).from(tables.recruitmentCandidatesV2).where(and(
      eq(tables.recruitmentCandidatesV2.isDeleted, false),
      sql`lower(trim(${tables.recruitmentCandidatesV2.firstName})) = ${core.firstName.toLowerCase()}`,
      sql`lower(trim(${tables.recruitmentCandidatesV2.familyName})) = ${core.familyName.toLowerCase()}`,
      eq(tables.recruitmentCandidatesV2.dob, core.dob),
    )).limit(1);
    if (matches.length) throw new DuplicateImportError("An application with the same name and birth date already exists. Review it before importing; no data was overwritten.");
  }
  const email = parsed.data.address[0]?.email;
  if (email) {
    const matches = await tx.select({ id: tables.candAddresses.id }).from(tables.candAddresses)
      .innerJoin(tables.recruitmentCandidatesV2, eq(tables.candAddresses.recCanUuid, tables.recruitmentCandidatesV2.recCanUuid))
      .where(and(eq(tables.candAddresses.isDeleted, false), eq(tables.recruitmentCandidatesV2.isDeleted, false), sql`lower(trim(${tables.candAddresses.email})) = ${email.toLowerCase()}`)).limit(1);
    if (matches.length) throw new DuplicateImportError("An application with this email already exists. Review it before importing.");
  }
  for (const doc of parsed.data.documents || []) {
    if (!doc.number || !/passport/i.test(doc.documentName || "")) continue;
    const matches = await tx.select({ id: tables.candDocuments.id }).from(tables.candDocuments)
      .innerJoin(tables.recruitmentCandidatesV2, eq(tables.candDocuments.recCanUuid, tables.recruitmentCandidatesV2.recCanUuid))
      .where(and(eq(tables.candDocuments.isDeleted, false), eq(tables.recruitmentCandidatesV2.isDeleted, false), sql`lower(trim(${tables.candDocuments.number})) = ${doc.number.toLowerCase()}`, sql`${tables.candDocuments.documentName} ilike '%passport%'`)).limit(1);
    if (matches.length) throw new DuplicateImportError("An application with this passport number already exists. Review it before importing.");
  }
  await lockRecruitmentNumbering(tx);
  const now = new Date();
  const fileNo = await nextRecruitmentFileNumber(tx, now);
  const audits = { createdByUuid: auditUuid, updatedByUuid: auditUuid, createdAt: now, updatedAt: now };
  for (const block of BLOCKS) {
    for (const record of parsed.data[block.entity] || []) {
      const values: Record<string, unknown> = { ...cleanRecord(record), recCanUuid, ...audits, [block.uuid]: block.entity === "candidate" ? recCanUuid : v4() };
      if (block.rows) values.sortOrder = Number(record.__row);
      if (block.entity === "candidate") {
        values.status = "Applied";
        values.fileNo = fileNo;
        values.screeningDate = recruitmentSubmissionDate(now);
      }
      if (block.entity === "personal" && core.dob) {
        const dob = new Date(core.dob), now = new Date();
        values.ageInYears = String(now.getUTCFullYear() - dob.getUTCFullYear() - (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate()) ? 1 : 0));
      }
      if (block.entity === "sea") {
        const from = new Date(record.fromDate), to = new Date(record.toDate);
        values.periodMonths = `${((to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + (to.getUTCDate() - from.getUTCDate()) / 30).toFixed(1)}M`;
      }
      await tx.insert(bindings[block.entity as keyof typeof bindings]).values(values);
    }
  }
  return recCanUuid;
}
export async function persistCandidate(parsed: Parsed, auditUuid: string | null): Promise<string> {
  if (!parsed.isValid) throw new Error("Cannot import an invalid workbook.");
  const db = getDb();
  return db.transaction((tx: any) => writeCandidate(tx, parsed, auditUuid));
}
