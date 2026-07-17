/**
 * Crew Attachment Import Service
 *
 * Second step of the bulk crew import flow. After the Excel workbook has been
 * imported (which persists an `attachment_ref` on each attachment-bearing
 * record), the user uploads a ZIP of the actual files. Inside the ZIP each file
 * lives under a folder path:
 *
 *     <Employee ID>/<Attachment Ref>/<your-file.pdf>
 *
 * The service resolves the crew member by Employee ID and the owning record by
 * (crewUuid, attachmentRef), validates the file bytes (PDF/PNG/JPEG, <= 5 MB),
 * writes it to the tenant's private storage, and inserts a row in the matching
 * *_attachments table.
 *
 * This is intentionally NOT transactional: a bad or unmatched file is skipped
 * and reported so one problem file never blocks the rest of the upload.
 */
import JSZip from "jszip";
import { and, eq, isNotNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../shared/fileStorageService.js";
import {
  crewMembersV2,
  crewDocuments,
  crewDocumentsAttachments,
  crewVisas,
  crewVisasAttachments,
  crewLicenses,
  crewLicensesAttachments,
  crewTrainingCourses,
  crewTrainingAttachments,
  crewSeaService,
  crewSeaServiceAttachments,
  crewEducation,
  crewEducationAttachments,
  crewPreJoiningMedicals,
  crewMedicalAttachments,
  crewDoctorVisits,
  crewDoctorVisitsAttachments,
  crewBriefings,
  crewBriefingAttachments,
  crewDebriefings,
  crewDebriefingAttachments,
} from "../../../../shared/v2/crew-pool/schema";

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Configuration for every attachment-bearing record type. `recordTable` holds
 * the `attachment_ref`; `attachTable` receives the new file row, keyed by
 * `attachParentKey`. `folder` mirrors the on-disk grouping used by the
 * single-file upload endpoints so ZIP-imported files land alongside them.
 */
type EntityConfig = {
  recordTable: any;
  recordUuidColumn: any;
  attachTable: any;
  attachParentKey: string;
  attachParentColumn: any; // Drizzle column reference on attachTable — used for pre-load dedup query
  folder: string;
};

const ENTITY_CONFIGS: EntityConfig[] = [
  { recordTable: crewDocuments, recordUuidColumn: crewDocuments.docUuid, attachTable: crewDocumentsAttachments, attachParentKey: "docUuid", attachParentColumn: crewDocumentsAttachments.docUuid, folder: "documents" },
  { recordTable: crewVisas, recordUuidColumn: crewVisas.visaUuid, attachTable: crewVisasAttachments, attachParentKey: "visaUuid", attachParentColumn: crewVisasAttachments.visaUuid, folder: "visas" },
  { recordTable: crewLicenses, recordUuidColumn: crewLicenses.licUuid, attachTable: crewLicensesAttachments, attachParentKey: "licUuid", attachParentColumn: crewLicensesAttachments.licUuid, folder: "licenses" },
  { recordTable: crewTrainingCourses, recordUuidColumn: crewTrainingCourses.trainUuid, attachTable: crewTrainingAttachments, attachParentKey: "trainUuid", attachParentColumn: crewTrainingAttachments.trainUuid, folder: "training" },
  { recordTable: crewSeaService, recordUuidColumn: crewSeaService.seaUuid, attachTable: crewSeaServiceAttachments, attachParentKey: "seaUuid", attachParentColumn: crewSeaServiceAttachments.seaUuid, folder: "sea-service" },
  { recordTable: crewEducation, recordUuidColumn: crewEducation.eduUuid, attachTable: crewEducationAttachments, attachParentKey: "eduUuid", attachParentColumn: crewEducationAttachments.eduUuid, folder: "education" },
  { recordTable: crewPreJoiningMedicals, recordUuidColumn: crewPreJoiningMedicals.medUuid, attachTable: crewMedicalAttachments, attachParentKey: "medUuid", attachParentColumn: crewMedicalAttachments.medUuid, folder: "medical" },
  { recordTable: crewDoctorVisits, recordUuidColumn: crewDoctorVisits.visitUuid, attachTable: crewDoctorVisitsAttachments, attachParentKey: "visitUuid", attachParentColumn: crewDoctorVisitsAttachments.visitUuid, folder: "medical" },
  { recordTable: crewBriefings, recordUuidColumn: crewBriefings.briefingUuid, attachTable: crewBriefingAttachments, attachParentKey: "briefingUuid", attachParentColumn: crewBriefingAttachments.briefingUuid, folder: "briefing" },
  { recordTable: crewDebriefings, recordUuidColumn: crewDebriefings.debriefingUuid, attachTable: crewDebriefingAttachments, attachParentKey: "debriefingUuid", attachParentColumn: crewDebriefingAttachments.debriefingUuid, folder: "debriefing" },
];

type ResolvedRecord = {
  parentUuid: string;
  config: EntityConfig;
};

export type SkipCategory =
  | "Invalid Path"
  | "No Match"
  | "Ambiguous Ref"
  | "Duplicate"
  | "Read Error"
  | "Oversized"
  | "Invalid Extension"
  | "Store Error";

export interface AttachmentImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  recordsCovered: number;
  crewCovered: number;
  skippedCount: number;
  skipped: { path: string; reason: string; category: SkipCategory }[];
}

/**
 * Import all files inside a ZIP buffer, attaching each to the record identified
 * by its `<Employee ID>/<Attachment Ref>/` folder path. Unmatched, empty,
 * oversized, or unsupported files are skipped and reported.
 */
export async function importAttachmentsZip(
  zipBuffer: Buffer,
): Promise<AttachmentImportResult> {
  const db = getDb();

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new Error("The uploaded file is not a valid ZIP archive.");
  }

  // ---- Build lookup: normalized Employee ID -> { crewUuid, empNo } ----
  const crewRows = await db
    .select({ crewUuid: crewMembersV2.crewUuid, empNo: crewMembersV2.empNo })
    .from(crewMembersV2)
    .where(eq(crewMembersV2.isDeleted, false));

  const crewByEmpNo = new Map<string, { crewUuid: string; empNo: string }>();
  for (const row of crewRows) {
    if (row.empNo) {
      crewByEmpNo.set(normalizeKey(row.empNo), { crewUuid: row.crewUuid, empNo: row.empNo });
    }
  }

  // ---- Build lookup: `${crewUuid}::${refNorm}` -> resolved record ----
  // Refs are validated unique per crew across sheets at Excel-import time, but
  // legacy or manually-edited data could contain duplicates. A duplicate is
  // ambiguous (we cannot know which record the file belongs to), so we track it
  // and refuse to attach rather than silently picking one.
  const recordByCrewAndRef = new Map<string, ResolvedRecord>();
  const ambiguousRefs = new Set<string>();
  for (const config of ENTITY_CONFIGS) {
    const rows = await db
      .select({
        parentUuid: config.recordUuidColumn,
        crewUuid: config.recordTable.crewUuid,
        attachmentRef: config.recordTable.attachmentRef,
      })
      .from(config.recordTable)
      .where(
        and(
          isNotNull(config.recordTable.attachmentRef),
          eq(config.recordTable.isDeleted, false),
        ),
      );
    for (const row of rows) {
      const refNorm = normalizeKey(row.attachmentRef);
      if (!refNorm) continue;
      const key = `${row.crewUuid}::${refNorm}`;
      if (recordByCrewAndRef.has(key)) {
        ambiguousRefs.add(key);
      } else {
        recordByCrewAndRef.set(key, { parentUuid: row.parentUuid, config });
      }
    }
  }

  // ---- Pre-load existing (parentUuid, fileName) pairs to prevent duplicates ----
  const existingAttachments = new Set<string>();
  for (const config of ENTITY_CONFIGS) {
    const rows = await db
      .select({
        parentUuid: config.attachParentColumn,
        fileName: config.attachTable.fileName,
      })
      .from(config.attachTable);
    for (const row of rows) {
      if (row.parentUuid && row.fileName) {
        existingAttachments.add(`${row.parentUuid}::${normalizeKey(row.fileName)}`);
      }
    }
  }

  const skipped: { path: string; reason: string; category: SkipCategory }[] = [];
  let imported = 0;
  let duplicates = 0;
  // Distinct parent records and crew that received at least one attachment.
  const recordsCovered = new Set<string>();
  const crewCovered = new Set<string>();

  // JSZip keeps entries keyed by their full path; iterate deterministically.
  const entries = Object.values(zip.files).sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.dir) continue;
    const rawPath = entry.name;

    // Split, dropping empty / traversal segments (zip-slip guard). An absolute
    // path or one containing ".." is rejected outright.
    const segments = rawPath.split("/").map((s) => s.trim());
    if (segments.some((s) => s === "..")) {
      skipped.push({ path: rawPath, reason: "Unsafe path (contains '..').", category: "Invalid Path" });
      continue;
    }
    const clean = segments.filter((s) => s.length > 0 && s !== ".");
    if (clean.length < 3) {
      skipped.push({ path: rawPath, reason: "Expected <Employee ID>/<Attachment Ref>/<file> folder layout.", category: "Invalid Path" });
      continue;
    }

    // Use the last three segments so an optional wrapper folder in the ZIP is
    // tolerated (e.g. attachments/EMP-001/EMP-001-D1/passport.pdf).
    const empNoRaw = clean[clean.length - 3];
    const refRaw = clean[clean.length - 2];
    const fileName = clean[clean.length - 1];

    const crew = crewByEmpNo.get(normalizeKey(empNoRaw));
    if (!crew) {
      skipped.push({ path: rawPath, reason: `No crew member found with Employee ID "${empNoRaw}".`, category: "No Match" });
      continue;
    }

    const refKey = `${crew.crewUuid}::${normalizeKey(refRaw)}`;
    if (ambiguousRefs.has(refKey)) {
      skipped.push({ path: rawPath, reason: `Attachment Ref "${refRaw}" matches more than one record for Employee ID "${empNoRaw}"; resolve the duplicate before importing.`, category: "Ambiguous Ref" });
      continue;
    }
    const record = recordByCrewAndRef.get(refKey);
    if (!record) {
      skipped.push({ path: rawPath, reason: `No record found with Attachment Ref "${refRaw}" for Employee ID "${empNoRaw}".`, category: "No Match" });
      continue;
    }

    // ---- Duplicate check: skip if this (parentUuid, fileName) already exists ----
    const dupKey = `${record.parentUuid}::${normalizeKey(fileName)}`;
    if (existingAttachments.has(dupKey)) {
      skipped.push({ path: rawPath, reason: `A file named "${fileName}" is already attached to this record (Attachment Ref: "${refRaw}").`, category: "Duplicate" });
      duplicates++;
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = await entry.async("nodebuffer");
    } catch {
      skipped.push({ path: rawPath, reason: "File could not be read from the ZIP.", category: "Read Error" });
      continue;
    }

    // Validate bytes (size ceiling + MIME-signature allow-list) before writing.
    let fileType: string;
    try {
      fileType = fileStorageService.validateAttachmentBuffer(buffer);
    } catch (err) {
      const reason = err instanceof AttachmentValidationError ? err.message : "File failed validation.";
      const category: SkipCategory = reason.includes("exceeds") ? "Oversized" : "Invalid Extension";
      skipped.push({ path: rawPath, reason, category });
      continue;
    }

    let filePath: string;
    try {
      filePath = await fileStorageService.writeAttachment(
        `crew-pool/${record.config.folder}/${crew.empNo}`,
        fileName,
        buffer,
      );
    } catch (err: any) {
      skipped.push({ path: rawPath, reason: err?.message || "Failed to store file.", category: "Store Error" });
      continue;
    }

    try {
      await db.insert(record.config.attachTable).values({
        attUuid: uuidv4(),
        [record.config.attachParentKey]: record.parentUuid,
        fileName,
        fileType,
        fileSize: String(buffer.length),
        filePath,
        fileData: null,
      });
    } catch (err: any) {
      // Roll back the just-written file so a failed insert does not leave an
      // orphaned artifact on disk; keep processing the rest of the ZIP.
      await fileStorageService.deleteAttachment(filePath).catch(() => {});
      skipped.push({ path: rawPath, reason: err?.message || "Failed to save attachment record.", category: "Store Error" });
      continue;
    }
    // Mark this (parentUuid, fileName) as now existing so a second occurrence of
    // the same file within this ZIP batch is also caught as a duplicate.
    existingAttachments.add(dupKey);
    imported++;
    recordsCovered.add(record.parentUuid);
    crewCovered.add(crew.crewUuid);
  }

  return {
    success: true,
    imported,
    duplicates,
    recordsCovered: recordsCovered.size,
    crewCovered: crewCovered.size,
    skippedCount: skipped.length,
    skipped,
  };
}
