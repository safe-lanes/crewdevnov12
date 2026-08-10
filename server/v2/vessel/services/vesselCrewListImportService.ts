import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { crewMembersV2, crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels, masterPorts } from "../../../../shared/schema";
import { admCompanyRanksV2, admVesselRevisionsV2 } from "../../../../shared/v2/admin/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { vesselRevisionsService } from "../../admin/services/vesselRevisionsService";
import { vesselDraftsService } from "../../admin/services/vesselDraftsService";
import { vesselPlanningRepository } from "../repositories/vesselPlanningRepository";
import { and, eq, inArray, sql } from "drizzle-orm";
import { parseDateString } from "../utils/dateUtils";

// ── Module-level concurrency guard for Stage 1 ───────────────────────────────
// Prevents two simultaneous requests from both running Phase 2 writes for the
// same vessel in the same Node.js process.  For multi-process deployments this
// should be replaced with a distributed lock (e.g. Redis or a Postgres advisory
// lock inside the revision service's own transaction).
const HIERARCHY_IMPORT_IN_PROGRESS = new Set<string>();

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface HierarchyImportResult {
  vesselsProcessed: number;
  activeRanksCount: number;
  deletedRanksCount: number;
  errors: string[];
  warnings: string[];
}

export interface AssignmentsImportResult {
  totalRowsProcessed: number;
  primaryAssignedCount: number;
  secondaryAssignedCount: number;
  /** Rows whose assignment already existed and were updated in-place (no duplicate inserted). */
  alreadyImportedCount: number;
  skippedCount: number;
  errors: string[];
  warnings: string[];
  errorExcelBuffer?: string;
  success?: boolean;
}

function norm(str: string | null | undefined): string {
  return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getCellValue(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  if (cell.value instanceof Date) {
    const d = cell.value;
    if (!isNaN(d.getTime())) {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}`;
    }
  }
  if (typeof cell.value === "string") return cell.value.trim();
  if (typeof cell.value === "number") return String(cell.value).trim();
  if (cell.value && typeof cell.value === "object") {
    if ("result" in cell.value && cell.value.result != null) {
      const res = cell.value.result;
      if (res instanceof Date) {
        if (!isNaN(res.getTime())) {
          const yr = res.getFullYear();
          const mo = String(res.getMonth() + 1).padStart(2, "0");
          const da = String(res.getDate()).padStart(2, "0");
          return `${yr}-${mo}-${da}`;
        }
      }
      return String(res).trim();
    }
    if ("text" in cell.value && cell.value.text != null) {
      return String(cell.value.text).trim();
    }
    if ("richText" in cell.value && Array.isArray((cell.value as any).richText)) {
      return (cell.value as any).richText.map((rt: any) => rt.text).join("").trim();
    }
  }
  return (cell.text || "").trim();
}

// ── Stage 1 rollback ─────────────────────────────────────────────────────────
// Called only when a parallel write batch fails after some vessels already
// committed.
//
// Precision guarantees:
//   1. Planning rows — only vacant slots created by this run are soft-deleted.
//   2. Revisions   — hard-deleted by exact ID, so historical revisions survive.
//   3. Drafts      — submit() hard-deletes drafts; we re-create them verbatim.
//
// Each step runs in its own try/catch. The RollbackResult indicates whether all
// steps succeeded so the caller can give an honest message to the operator.

interface CommittedVessel {
  vesselUuid: string;
  revisionId: number;
  /** All drafts captured before submit() hard-deleted them. */
  savedDrafts: { vesselId: string; revision: string; draftData: string }[];
  /** planUuids active BEFORE submit() ran (may have been dedup-deleted). */
  preSyncPlanUuids: string[];
  /** planUuids created by syncVesselPlanningV2 during THIS submit(). */
  createdPlanUuids: string[];
}

interface RollbackResult {
  success: boolean;
  failedSteps: string[];
}

async function rollbackHierarchyImport(
  committed: CommittedVessel[],
  auditUserUuid?: string,
): Promise<RollbackResult> {
  if (committed.length === 0) return { success: true, failedSteps: [] };

  const db = getDb();
  const revisionIds = committed.map((c) => c.revisionId);
  const failedSteps: string[] = [];

  // Step 1 — Soft-delete the EXACT planning rows created by this import run.
  try {
    const allCreatedUuids = committed.flatMap((c) => c.createdPlanUuids);
    if (allCreatedUuids.length > 0) {
      await db
        .update(vesselPlanningV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(vesselPlanningV2.planUuid, allCreatedUuids));
    }
  } catch (e: any) {
    failedSteps.push(`Step 1 (remove new planning rows): ${e.message || e}`);
    console.error("[VESSEL IMPORT] Rollback Step 1 failed:", e);
  }

  // Step 2 — Restore pre-existing rows the sync's dedup step may have soft-deleted.
  try {
    const allPreSyncUuids = committed.flatMap((c) => c.preSyncPlanUuids);
    if (allPreSyncUuids.length > 0) {
      await db
        .update(vesselPlanningV2)
        .set({ isDeleted: false, updatedAt: new Date() })
        .where(
          and(
            inArray(vesselPlanningV2.planUuid, allPreSyncUuids),
            eq(vesselPlanningV2.isDeleted, true),
          ),
        );
    }
  } catch (e: any) {
    failedSteps.push(`Step 2 (restore pre-existing planning rows): ${e.message || e}`);
    console.error("[VESSEL IMPORT] Rollback Step 2 failed:", e);
  }

  // Step 3 — Hard-delete the exact revision rows created by this import.
  try {
    await db
      .delete(admVesselRevisionsV2)
      .where(inArray(admVesselRevisionsV2.id, revisionIds));
  } catch (e: any) {
    failedSteps.push(`Step 3 (delete new revisions): ${e.message || e}`);
    console.error("[VESSEL IMPORT] Rollback Step 3 failed:", e);
  }

  // Step 4 — Restore ALL drafts hard-deleted by submit().
  try {
    for (const c of committed) {
      for (const draft of c.savedDrafts) {
        await vesselDraftsService.create({
          vesselId: draft.vesselId,
          revision: draft.revision,
          draftData: draft.draftData,
          createdByUuid: auditUserUuid ?? null,
        });
      }
    }
  } catch (e: any) {
    failedSteps.push(`Step 4 (restore vessel drafts): ${e.message || e}`);
    console.error("[VESSEL IMPORT] Rollback Step 4 failed:", e);
  }

  if (failedSteps.length > 0) {
    console.error(
      "[VESSEL IMPORT] Rollback partially failed — manual DB intervention may be required:",
      failedSteps,
    );
  }

  return { success: failedSteps.length === 0, failedSteps };
}

// ── Stage 1 expected headers ──────────────────────────────────────────────────
// Validated against row 1 of VesselRankHierarchy sheet (case-insensitive).
const HIERARCHY_EXPECTED_HEADERS: { col: number; name: string }[] = [
  { col: 1, name: "Vessel Name" },
  { col: 2, name: "IMO" },
  { col: 3, name: "Rank" },
  { col: 4, name: "Position" },
  { col: 5, name: "Status" },
];

// ── Stage 2 required headers (normalised) ────────────────────────────────────
// These must be present in row 1 of the Assignments sheet.  Missing any of
// them aborts the import immediately with no silent positional fallback.
const REQUIRED_ASSIGNMENT_HEADERS = [
  "employee id",
  "vessel name",
  "rank",
  "position",
  "sign on date",
  "assignment type",
];

/**
 * Stage 1: Import VesselRankHierarchy sheet → updates adm_vessel_revisions_v2
 * and syncs vessel_planning_v2 slots.
 *
 * Two-phase design:
 *   Phase 1 — validate ALL vessels (no DB writes).  If any vessel fails,
 *              return the full error list immediately with zero writes.
 *   Phase 2 — write in parallel batches of 10 via Promise.allSettled.
 *              On any batch failure, compensating rollback undoes all committed
 *              vessels from this run before returning.
 *
 * Concurrency:  A module-level Set guards against two simultaneous uploads for
 *               the same vessel in the same Node.js process.
 *
 * Optimisation: planning records for all vessels are loaded in ONE batch query
 * before the loop, eliminating the per-vessel getByVesselUuid call.
 */
export async function importVesselRankHierarchy(
  xlsxBuffer: Buffer,
  auditUserUuid?: string,
): Promise<HierarchyImportResult> {
  const result: HierarchyImportResult = {
    vesselsProcessed: 0,
    activeRanksCount: 0,
    deletedRanksCount: 0,
    errors: [],
    warnings: [],
  };

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuffer as any);

    const hierarchySheet = workbook.getWorksheet("VesselRankHierarchy");
    if (!hierarchySheet) {
      result.errors.push(
        "Missing 'VesselRankHierarchy' sheet in uploaded Excel workbook",
      );
      return result;
    }

    // ── Header validation ─────────────────────────────────────────────────────
    // Ensures columns have not been renamed or reordered.  Checked case-insensitively.
    const hdrRow = hierarchySheet.getRow(1);
    const hdrErrors: string[] = [];
    for (const expected of HIERARCHY_EXPECTED_HEADERS) {
      const found = norm(getCellValue(hdrRow.getCell(expected.col)));
      if (found !== norm(expected.name)) {
        hdrErrors.push(
          `Column ${expected.col}: expected "${expected.name}", found "${getCellValue(hdrRow.getCell(expected.col)) || "(empty)"}"`,
        );
      }
    }
    if (hdrErrors.length > 0) {
      result.errors.push(
        `VesselRankHierarchy sheet has incorrect column headers — do not rename or reorder columns. ` +
        `Issues: ${hdrErrors.join("; ")}`,
      );
      return result;
    }

    const db = getDb();
    const vessels: any[] = await db.select().from(masterVessels);
    const vesselByImoMap = new Map<string, any>();
    const vesselByNameMap = new Map<string, any>();
    for (const v of vessels) {
      if (v.imo) vesselByImoMap.set(v.imo.replace(/\D/g, ""), v);
      if (v.vessel) vesselByNameMap.set(norm(v.vessel), v);
    }

    // Group rows by vessel UUID
    const vesselRowsMap = new Map<
      string,
      {
        vesselUuid: string;
        vesselName: string;
        rows: { rank: string; position: string; status: string }[];
      }
    >();

    for (let rowNumber = 2; rowNumber <= hierarchySheet.rowCount; rowNumber++) {
      const row = hierarchySheet.getRow(rowNumber);
      const vesselName = getCellValue(row.getCell(1));
      const imo = getCellValue(row.getCell(2));
      const rank = getCellValue(row.getCell(3));
      const position = getCellValue(row.getCell(4));
      const status =
        getCellValue(row.getCell(5)) || getCellValue(row.getCell(4));

      if (!vesselName && !imo) continue;

      const cleanImo = (imo || "").replace(/\D/g, "");
      const matchedVessel: any =
        (cleanImo ? vesselByImoMap.get(cleanImo) : null) ||
        vesselByNameMap.get(norm(vesselName));

      if (!matchedVessel) {
        result.errors.push(
          `Row ${rowNumber}: Vessel "${vesselName || "Unknown"}" ${imo ? `(IMO: ${imo})` : ""} is not registered in Master Vessels. Please create the vessel in Master Vessels before uploading.`,
        );
        continue;
      }

      const key: string = matchedVessel.vesselUuid;
      if (!vesselRowsMap.has(key)) {
        vesselRowsMap.set(key, {
          vesselUuid: key,
          vesselName: matchedVessel.vessel || vesselName,
          rows: [],
        });
      }
      vesselRowsMap.get(key)!.rows.push({ rank, position, status });
    }

    // Early-exit: missing vessel errors surfaced above
    if (result.errors.length > 0) return result;

    // ── Pre-load all planning in ONE batch query ─────────────────────────────
    const allVesselUuids = [...vesselRowsMap.keys()];
    const batchPlanningFlat =
      allVesselUuids.length > 0
        ? await vesselPlanningRepository.findByVesselUuidBatch(allVesselUuids)
        : [];

    const planningByVessel = new Map<string, any[]>();
    for (const p of batchPlanningFlat) {
      if (!planningByVessel.has(p.vesselUuid))
        planningByVessel.set(p.vesselUuid, []);
      planningByVessel.get(p.vesselUuid)!.push(p);
    }

    const todayStr = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY
    const allCompanyRanks = await db
      .select()
      .from(admCompanyRanksV2)
      .where(eq(admCompanyRanksV2.isDeleted, false));

    // ── Phase 1: Validate & prepare revision data (zero DB writes) ───────────
    interface ValidatedVessel {
      vesselUuid: string;
      vesselName: string;
      updatedRevisionData: any[];
      activeRanksCount: number;
      deletedRanksCount: number;
      savedDrafts: { vesselId: string; revision: string; draftData: string }[];
    }

    const validVessels: ValidatedVessel[] = [];

    for (const [vesselUuid, group] of vesselRowsMap.entries()) {
      const existingPlanning = planningByVessel.get(vesselUuid) || [];
      const existingRanksSet = new Set<string>(
        existingPlanning.map((p) => norm(p.rank)),
      );

      const activeRankRoles = new Set<string>();
      const deletedRankRoles = new Set<string>();

      for (const r of group.rows) {
        const posKey = norm(r.position || r.rank);
        const st = norm(r.status);
        if (st === "deleted" || st === "not required" || st === "inactive") {
          deletedRankRoles.add(posKey);
        } else {
          activeRankRoles.add(posKey);
        }
      }

      // Duplicate-upload guard
      let isIdenticalHierarchy =
        activeRankRoles.size > 0 && deletedRankRoles.size === 0;
      if (isIdenticalHierarchy) {
        for (const rankKey of activeRankRoles) {
          if (!existingRanksSet.has(rankKey)) {
            isIdenticalHierarchy = false;
            break;
          }
        }
      }
      if (isIdenticalHierarchy) {
        result.errors.push(
          `Duplicate upload restricted: Rank hierarchy for vessel "${group.vesselName}" has already been imported into the system.`,
        );
        continue;
      }

      // Load draft / latest revision data (read-only, no writes).
      const drafts = await vesselDraftsService.getByVesselId(vesselUuid);
      let revisionDataList: any[] = [];
      const savedDrafts: { vesselId: string; revision: string; draftData: string }[] = [];
      if (drafts.length > 0) {
        if (drafts[0].draftData) {
          revisionDataList = JSON.parse(drafts[0].draftData);
        }
        for (const d of drafts) {
          if (d.draftData) {
            savedDrafts.push({
              vesselId: vesselUuid,
              revision: d.revision,
              draftData: d.draftData,
            });
          }
        }
      } else {
        const revisions = await vesselRevisionsService.getByVesselId(vesselUuid);
        if (revisions.length > 0 && revisions[0].revisionData) {
          revisionDataList = JSON.parse(revisions[0].revisionData);
        }
      }

      if (revisionDataList.length === 0) {
        revisionDataList = allCompanyRanks.map((cr: any) => ({
          ...cr,
          actualManningFlag: false,
          actualManning: [],
          safeManning: false,
          optimumManning: false,
          highWorkloadManning: false,
        }));
      }

      const updatedRevisionData = revisionDataList.map((rankObj: any) => {
        const roleName = rankObj.role || rankObj.rank;
        const roleKey = norm(roleName);
        if (deletedRankRoles.has(roleKey))
          return { ...rankObj, actualManningFlag: false };
        if (activeRankRoles.has(roleKey))
          return { ...rankObj, actualManningFlag: true };
        return rankObj;
      });

      validVessels.push({
        vesselUuid,
        vesselName: group.vesselName,
        updatedRevisionData,
        activeRanksCount: activeRankRoles.size,
        deletedRanksCount: deletedRankRoles.size,
        savedDrafts,
      });
    }

    // If validation found any errors, stop before writing anything
    if (result.errors.length > 0) return result;
    if (validVessels.length === 0) return result;

    // ── Stage 1 concurrency guard ─────────────────────────────────────────────
    // Prevents two simultaneous requests from both committing Phase 2 writes
    // for the same vessel in the same Node.js process.
    const conflictVessels = validVessels.filter((v) =>
      HIERARCHY_IMPORT_IN_PROGRESS.has(v.vesselUuid),
    );
    if (conflictVessels.length > 0) {
      result.errors.push(
        `Import already in progress for vessel(s): ${conflictVessels.map((v) => `"${v.vesselName}"`).join(", ")} — ` +
        `please wait for the current import to complete before retrying.`,
      );
      return result;
    }
    // Register all vessels as being actively imported in this process
    const lockedForThisRun = validVessels.map((v) => v.vesselUuid);
    for (const uuid of lockedForThisRun) {
      HIERARCHY_IMPORT_IN_PROGRESS.add(uuid);
    }

    try {
      // ── Phase 2: Parallel batch writes (10 vessels at a time) ───────────────
      const BATCH_SIZE = 10;
      const committed: CommittedVessel[] = [];

      for (let i = 0; i < validVessels.length; i += BATCH_SIZE) {
        const batch = validVessels.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (v) => {
            const preSyncPlanUuids = (planningByVessel.get(v.vesselUuid) || []).map(
              (p: any) => p.planUuid as string,
            );

            const submitResult = await vesselRevisionsService.submit(
              {
                vesselId: v.vesselUuid,
                revisionDate: todayStr,
                revisionData: JSON.stringify(v.updatedRevisionData),
              },
              { throwOnSyncError: true, auditUserUuid },
            );
            return {
              vesselUuid: v.vesselUuid,
              revisionId: submitResult.revision.id,
              createdPlanUuids: submitResult.metadata.createdPlanUuids ?? [],
              vessel: v,
              preSyncPlanUuids,
            };
          }),
        );

        const failures = batchResults.filter(
          (r) => r.status === "rejected",
        ) as PromiseRejectedResult[];

        if (failures.length > 0) {
          for (const r of batchResults) {
            if (r.status === "fulfilled") {
              committed.push({
                vesselUuid: r.value.vesselUuid,
                revisionId: r.value.revisionId,
                savedDrafts: r.value.vessel.savedDrafts,
                preSyncPlanUuids: r.value.preSyncPlanUuids,
                createdPlanUuids: r.value.createdPlanUuids,
              });
            } else if (r.reason?.partialRevisionId) {
              const partialVessel = batch.find(
                (bv) => bv.vesselUuid === r.reason.partialSavedForVessel,
              );
              committed.push({
                vesselUuid: r.reason.partialSavedForVessel,
                revisionId: r.reason.partialRevisionId,
                savedDrafts: partialVessel?.savedDrafts ?? [],
                preSyncPlanUuids: partialVessel
                  ? (planningByVessel.get(partialVessel.vesselUuid) || []).map(
                      (p: any) => p.planUuid as string,
                    )
                  : [],
                createdPlanUuids: [],
              });
            }
          }

          // ── Rollback with honest result reporting ──────────────────────────
          const rollbackResult = await rollbackHierarchyImport(committed, auditUserUuid);
          const firstMsg =
            failures[0].reason?.message || String(failures[0].reason);

          if (!rollbackResult.success) {
            result.errors.push(
              `PARTIAL ROLLBACK — manual review required. ` +
              `The following rollback steps failed: ${rollbackResult.failedSteps.join("; ")}. ` +
              `Original import error: ${firstMsg}`,
            );
          } else {
            result.errors.push(
              `Import failed after committing ${committed.length} vessel(s). All changes have been rolled back. Error: ${firstMsg}`,
            );
          }
          result.vesselsProcessed = 0;
          result.activeRanksCount = 0;
          result.deletedRanksCount = 0;
          return result;
        }

        for (const r of batchResults) {
          if (r.status === "fulfilled") {
            committed.push({
              vesselUuid: r.value.vesselUuid,
              revisionId: r.value.revisionId,
              savedDrafts: r.value.vessel.savedDrafts,
              preSyncPlanUuids: r.value.preSyncPlanUuids,
              createdPlanUuids: r.value.createdPlanUuids,
            });
            result.activeRanksCount += r.value.vessel.activeRanksCount;
            result.deletedRanksCount += r.value.vessel.deletedRanksCount;
            result.vesselsProcessed++;
          }
        }
      }
    } finally {
      // Always release in-process locks regardless of success or failure
      for (const uuid of lockedForThisRun) {
        HIERARCHY_IMPORT_IN_PROGRESS.delete(uuid);
      }
    }
  } catch (err: any) {
    result.errors.push(
      `Failed to process hierarchy import: ${err.message || String(err)}`,
    );
  }

  return result;
}

// ── Helpers shared by Stage 2 ────────────────────────────────────────────────

function computeReliefDueDate(
  signOnDateStr: string,
  contractMonths: number,
): string {
  const dateObj = new Date(signOnDateStr);
  dateObj.setMonth(dateObj.getMonth() + contractMonths);
  return dateObj.toISOString().split("T")[0];
}

/**
 * Stage 2: Import Assignments sheet → updates vessel_planning_v2 & inserts
 * crew_assignments (fully independent of Stage 1).
 *
 * All DB mutations run inside a SINGLE db.transaction() and are executed
 * directly via the tx object — no service-layer calls inside the transaction.
 * This guarantees atomicity: if any row fails, ALL planning and assignment
 * writes from this run are rolled back together.
 *
 * Hardening:
 *  - Strict header validation: missing required headers abort before any write.
 *  - Duplicate-slot guard: two rows targeting the same vessel+position+type
 *    are a pre-flight error, not a silent overwrite.
 *  - Rank resolution: if a row would need to create a new planning slot AND
 *    the rank name cannot be matched to adm_company_ranks_v2, the import is
 *    rejected in pre-flight — no "R000" sentinel is ever persisted.
 *  - Idempotency: re-uploading the same file updates the existing assignment
 *    row in-place instead of inserting a duplicate history entry.
 *  - Concurrency: pg_try_advisory_xact_lock() inside the transaction prevents
 *    two simultaneous uploads for the same vessels from both committing.
 *  - Audit trail: auditUserUuid is stamped on every insert/update.
 *
 * Optimisation: planning records for all referenced vessels are loaded in ONE
 * batch query before the transaction, and that map is updated in-memory as
 * new slots are created during the run.
 */
export async function importCrewAssignments(
  xlsxBuffer: Buffer,
  auditUserUuid?: string,
): Promise<AssignmentsImportResult> {
  const result: AssignmentsImportResult = {
    totalRowsProcessed: 0,
    primaryAssignedCount: 0,
    secondaryAssignedCount: 0,
    alreadyImportedCount: 0,
    skippedCount: 0,
    errors: [],
    warnings: [],
    success: false,
  };

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuffer as any);

    const assignmentsSheet = workbook.getWorksheet("Assignments");
    if (!assignmentsSheet) {
      result.errors.push("Missing 'Assignments' sheet in uploaded Excel workbook");
      return result;
    }

    const db = getDb();

    // ── Initial data loads (parallel) ────────────────────────────────────────
    const [allCrew, allVessels, allPorts, allCompanyRanks]: [any[], any[], any[], any[]] =
      await Promise.all([
        db.select().from(crewMembersV2).where(eq(crewMembersV2.isDeleted, false)),
        db.select().from(masterVessels),
        db.select().from(masterPorts).where(eq(masterPorts.isDeleted, false)),
        db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false)),
      ]);

    // Build lookup maps
    const crewByEmpIdMap = new Map<string, any[]>();
    const crewByPassportMap = new Map<string, any[]>();
    const addToMap = (map: Map<string, any[]>, key: string, c: any) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    };
    for (const c of allCrew) {
      if (c.employeeId) addToMap(crewByEmpIdMap, norm(c.employeeId), c);
      if (c.empNo) addToMap(crewByEmpIdMap, norm(c.empNo), c);
      if (c.passportNo) addToMap(crewByPassportMap, norm(c.passportNo), c);
    }

    const vesselByImoMap = new Map<string, any>();
    const vesselByNameMap = new Map<string, any>();
    for (const v of allVessels) {
      if (v.imo) vesselByImoMap.set(v.imo.replace(/\D/g, ""), v);
      if (v.vessel) vesselByNameMap.set(norm(v.vessel), v);
    }

    const portByNameMap = new Map<string, string>();
    for (const p of allPorts) {
      if (p.portName) portByNameMap.set(norm(p.portName), p.portUuid);
      if (p.name) portByNameMap.set(norm(p.name), p.portUuid);
    }

    // Company rank lookup — keyed by both rank and role names (normalised)
    const companyRankByNameMap = new Map<string, any>();
    for (const cr of allCompanyRanks) {
      if (cr.rank) companyRankByNameMap.set(norm(cr.rank), cr);
      if (cr.role) companyRankByNameMap.set(norm(cr.role), cr);
    }

    // ── Build dynamic header map from Row 1 ───────────────────────────────────
    const headerRow = assignmentsSheet.getRow(1);
    const colMap = new Map<string, number>();
    headerRow.eachCell((cell, colNum) => {
      const headerText = norm(getCellValue(cell));
      if (headerText) colMap.set(headerText, colNum);
    });

    // ── Strict header validation ───────────────────────────────────────────────
    // Required headers must be present — no silent positional fallback.
    const missingRequired = REQUIRED_ASSIGNMENT_HEADERS.filter(
      (h) => !colMap.has(h),
    );
    if (missingRequired.length > 0) {
      const foundHeaders = [...colMap.keys()]
        .filter((k) => k.length > 0)
        .map((k) => `"${k}"`)
        .join(", ");
      result.errors.push(
        `Assignments sheet is missing required column header(s): ${missingRequired.map((h) => `"${h}"`).join(", ")}. ` +
        `Found headers: ${foundHeaders || "(none)"}. ` +
        `Do not rename or remove column headers from the generated template.`,
      );
      return result;
    }

    // Column getter: uses header map; fallbackIdx used for optional columns
    const getColVal = (row: ExcelJS.Row, headerName: string, fallbackIdx: number): string => {
      const colIdx = colMap.get(norm(headerName)) ?? fallbackIdx;
      return getCellValue(row.getCell(colIdx));
    };

    // ── Quick scan: collect vessel UUIDs for batch planning pre-load ──────────
    // Single O(n) pass using only vessel lookup — no full validation yet.
    const vesselUuidsInSheet = new Set<string>();
    for (let r = 2; r <= assignmentsSheet.rowCount; r++) {
      const row = assignmentsSheet.getRow(r);
      const vesselName = getColVal(row, "Vessel Name", 2);
      const imo = getColVal(row, "IMO", 3);
      const cleanImo = (imo || "").replace(/\D/g, "");
      const v: any =
        (cleanImo ? vesselByImoMap.get(cleanImo) : null) ||
        vesselByNameMap.get(norm(vesselName));
      if (v?.vesselUuid) vesselUuidsInSheet.add(v.vesselUuid);
    }

    // ── Pre-load ALL planning for vessels in this sheet (ONE query) ───────────
    const scannedVesselUuids = [...vesselUuidsInSheet];
    const batchPlanning =
      scannedVesselUuids.length > 0
        ? await vesselPlanningRepository.findByVesselUuidBatch(scannedVesselUuids)
        : [];

    // planningByVessel is mutated in the write loop as new slots are created
    const planningByVessel = new Map<string, any[]>();
    for (const p of batchPlanning) {
      if (!planningByVessel.has(p.vesselUuid))
        planningByVessel.set(p.vesselUuid, []);
      planningByVessel.get(p.vesselUuid)!.push(p);
    }

    // ── Pre-flight validation loop ────────────────────────────────────────────
    const rowsToProcess: any[] = [];
    const rowErrorsMap = new Map<number, string[]>();

    // Duplicate-slot guard: tracks (vesselUuid|position|assignmentType) within this file
    const slotOwnershipMap = new Map<string, { rowNumber: number; employeeId: string }>();

    for (
      let rowNumber = 2;
      rowNumber <= assignmentsSheet.rowCount;
      rowNumber++
    ) {
      const row = assignmentsSheet.getRow(rowNumber);

      const employeeId = getColVal(row, "Employee ID", 1);
      const vesselName = getColVal(row, "Vessel Name", 2);
      const imo = getColVal(row, "IMO", 3);
      const rank = getColVal(row, "Rank", 4);
      const position = getColVal(row, "Position", 5);
      const signOnDate = getColVal(row, "Sign On Date", 6);
      const contractPeriod = getColVal(row, "Contract Period (Months)", 7);
      const reliefDue = getColVal(row, "Relief Due Date", 8);
      const portOfJoining = getColVal(row, "Port of Joining", 9);
      const rawAssignmentType = getColVal(row, "Assignment Type", 10);
      const assignmentType = rawAssignmentType || "Primary";
      const rawJoiningStatus = getColVal(row, "Joining Status", 11);
      const joiningStatus = rawJoiningStatus || "Signed On";
      const relieverRank = getColVal(row, "Reliever Rank", 12);

      if (!employeeId && !vesselName && !rank && !signOnDate) continue;

      const errors: string[] = [];

      if (!employeeId) errors.push("Employee ID is missing");
      if (!vesselName && !imo) errors.push("Vessel Name / IMO is missing");
      if (!rank) errors.push("Rank is missing");
      if (!position) errors.push("Position is missing");
      if (!signOnDate) errors.push("Sign On Date is missing");

      const normAssignType = norm(assignmentType);
      const isPrimary = normAssignType !== "secondary";
      if (
        assignmentType &&
        normAssignType !== "primary" &&
        normAssignType !== "secondary"
      ) {
        errors.push(
          `Assignment Type '${assignmentType}' is invalid (must be Primary or Secondary)`,
        );
      }

      if (joiningStatus) {
        const normStatus = norm(joiningStatus);
        if (
          normStatus !== "signed on" &&
          normStatus !== "planned" &&
          normStatus !== "in transit"
        ) {
          errors.push(
            `Joining Status '${joiningStatus}' is invalid (must be Signed On, Planned, or In Transit)`,
          );
        }
      }

      const parsedSignOn = parseDateString(signOnDate);
      if (signOnDate && !parsedSignOn) {
        errors.push(`Sign On Date '${signOnDate}' is invalid or unparseable`);
      }

      const parsedReliefDue = parseDateString(reliefDue);
      if (reliefDue && !parsedReliefDue) {
        errors.push(`Relief Due Date '${reliefDue}' is invalid or unparseable`);
      }

      let crew: any = null;
      if (employeeId) {
        const rawCandidates =
          crewByEmpIdMap.get(norm(employeeId)) ??
          crewByPassportMap.get(norm(employeeId)) ??
          [];
        const seenUuids = new Set<string>();
        const empCandidates = rawCandidates.filter((c: any) => {
          if (seenUuids.has(c.crewUuid)) return false;
          seenUuids.add(c.crewUuid);
          return true;
        });
        if (empCandidates.length > 1) {
          errors.push(
            `AMBIGUOUS (${empCandidates.length} matches) for Employee ID / Passport '${employeeId}' — resolve duplicate records before importing`,
          );
        } else if (empCandidates.length === 1) {
          crew = empCandidates[0];
        } else {
          errors.push(
            `Seafarer with Employee ID / Passport '${employeeId}' is not registered in the system`,
          );
        }
      }

      const cleanImo = (imo || "").replace(/\D/g, "");
      const vessel: any =
        (cleanImo ? vesselByImoMap.get(cleanImo) : null) ||
        vesselByNameMap.get(norm(vesselName));
      if (vesselName || imo) {
        if (!vessel) {
          errors.push(
            `Vessel '${vesselName}' ${imo ? `(IMO: ${imo})` : ""} is not registered in Master Vessels`,
          );
        } else if (!vessel.vesselUuid) {
          errors.push(
            `Vessel '${vesselName}' is missing a valid system identifier in Master Vessels`,
          );
        }
      }

      let joiningPortUuid: string | undefined = undefined;
      if (portOfJoining) {
        joiningPortUuid = portByNameMap.get(norm(portOfJoining));
        if (!joiningPortUuid) {
          errors.push(
            `Port of Joining '${portOfJoining}' is not registered in Master Ports`,
          );
        }
      }

      // ── Rank resolution check ──────────────────────────────────────────────
      // Rank resolution is ONLY required when a new planning slot would need to
      // be created (i.e. no existing slot matches this vessel+position).  If a
      // slot already exists, its rankId is already set in the DB — no action.
      //
      // Unresolvable ranks are a pre-flight hard error: the "R000" sentinel is
      // never silently persisted.
      let resolvedRankId: string | null = null;
      const targetPos = (isPrimary ? position : relieverRank || position) || rank;
      if (vessel?.vesselUuid) {
        const existingPlanning = planningByVessel.get(vessel.vesselUuid) || [];
        const matchedSlot = existingPlanning.find(
          (p: any) =>
            (p.role && norm(p.role) === norm(targetPos)) ||
            norm(p.rank) === norm(targetPos) ||
            norm(p.rank) === norm(rank),
        );
        if (!matchedSlot) {
          // A new slot will need to be created — resolve rankId now
          const baseRankKey = norm(targetPos).replace(/_\d+$/, "");
          const matchedCR =
            companyRankByNameMap.get(norm(targetPos)) ||
            companyRankByNameMap.get(baseRankKey);
          if (!matchedCR?.rankId) {
            errors.push(
              `Position "${targetPos}" for vessel "${vessel.vessel || vesselName}" is not found in company rank configuration. ` +
              `A new planning slot would need to be created but the rank cannot be resolved. ` +
              `Ensure the position name exactly matches a rank defined in Admin > Company Ranks, ` +
              `or run Stage 1 (Hierarchy Import) for this vessel first.`,
            );
          } else {
            resolvedRankId = matchedCR.rankId;
          }
        }
        // resolvedRankId remains null when an existing slot is found (rankId already set in DB)
      }

      // ── Duplicate-slot guard (within this xlsx file) ───────────────────────
      // Two rows targeting the same vessel + position + assignment type is a
      // conflict — only one crew member can occupy a slot at a time.
      if (vessel?.vesselUuid && targetPos && errors.length === 0) {
        const slotKey = `${vessel.vesselUuid}|${norm(targetPos)}|${isPrimary ? "primary" : "secondary"}`;
        if (slotOwnershipMap.has(slotKey)) {
          const first = slotOwnershipMap.get(slotKey)!;
          errors.push(
            `Duplicate slot conflict: Row ${first.rowNumber} (Employee: ${first.employeeId}) already targets ` +
            `vessel "${vessel.vessel || vesselName}" / position "${targetPos}" as ${isPrimary ? "Primary" : "Secondary"}. ` +
            `Only one crew member per vessel+position+type is allowed per import.`,
          );
        } else {
          slotOwnershipMap.set(slotKey, { rowNumber, employeeId });
        }
      }

      if (errors.length > 0) rowErrorsMap.set(rowNumber, errors);

      rowsToProcess.push({
        rowNumber,
        employeeId,
        vesselName,
        imo,
        rank,
        position,
        targetPos,
        signOnDate: parsedSignOn,
        contractPeriod: contractPeriod ? parseInt(contractPeriod, 10) || null : null,
        reliefDue: parsedReliefDue,
        portOfJoining,
        joiningPortUuid,
        assignmentType: isPrimary ? "primary" : "secondary",
        joiningStatus: joiningStatus || "Signed On",
        relieverRank,
        crew,
        vessel,
        resolvedRankId, // non-null only when a new slot must be created
      });
    }

    result.totalRowsProcessed = rowsToProcess.length;

    // Validation errors → annotate error excel, return early
    if (rowErrorsMap.size > 0) {
      for (const [rowNum, errList] of rowErrorsMap.entries()) {
        result.errors.push(`Row ${rowNum}: ${errList.join("; ")}`);
      }
      result.skippedCount = rowsToProcess.length;

      const errColNum = (assignmentsSheet.columnCount || 13) + 1;
      assignmentsSheet.getCell(1, errColNum).value = "Validation Errors";
      assignmentsSheet.getCell(1, errColNum).font = {
        bold: true,
        color: { argb: "991B1B" },
      };
      assignmentsSheet.getCell(1, errColNum).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FEE2E2" },
      };
      for (let r = 2; r <= assignmentsSheet.rowCount; r++) {
        const rowErrs = rowErrorsMap.get(r);
        if (rowErrs && rowErrs.length > 0) {
          const errCell = assignmentsSheet.getCell(r, errColNum);
          errCell.value = rowErrs.join("; ");
          errCell.font = { color: { argb: "991B1B" } };
          errCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FEF2F2" },
          };
        }
      }

      const errBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
      result.errorExcelBuffer = errBuffer.toString("base64");
      result.success = false;
      return result;
    }

    // ── Crew UUIDs for idempotency check (computed outside tx — no DB read) ──
    // The actual existing-assignments query runs INSIDE the transaction, after
    // advisory locks are held, to guarantee a consistent view (a concurrent
    // importer for the same vessels cannot commit between our lock acquisition
    // and this read).
    const allCrewUuidsForCheck = [
      ...new Set(
        rowsToProcess
          .filter((r) => r.crew?.crewUuid)
          .map((r) => r.crew.crewUuid as string),
      ),
    ];

    // ── Collect unique vessel UUIDs for advisory locking ─────────────────────
    const uniqueVesselUuids = [
      ...new Set(
        rowsToProcess
          .filter((r) => r.vessel?.vesselUuid)
          .map((r) => r.vessel.vesselUuid as string),
      ),
    ];

    // ── Atomic DB transaction ─────────────────────────────────────────────────
    // ALL planning and assignment writes go through tx — the same DB connection.
    // This guarantees that a failure at any row rolls back ALL prior writes from
    // this import run together.
    await db.transaction(async (tx: any) => {
      // ── Stage 2 concurrency: acquire transaction-scoped advisory locks ──────
      // pg_try_advisory_xact_lock() is transaction-level: held until commit or
      // rollback, enforced across ALL connections — unlike session-level locks
      // which are connection-scoped in a pool.
      for (const vesselUuid of uniqueVesselUuids) {
        const lockResult = await tx.execute(
          sql`SELECT pg_try_advisory_xact_lock(hashtext(${vesselUuid})::bigint) AS locked`,
        );
        const lockRow =
          (lockResult as any).rows?.[0] ??
          (Array.isArray(lockResult) ? lockResult[0] : null);
        const acquired =
          lockRow?.locked === true ||
          lockRow?.locked === "t" ||
          lockRow?.locked === 1;
        if (!acquired) {
          const conflictVessel = allVessels.find(
            (v: any) => v.vesselUuid === vesselUuid,
          );
          throw new Error(
            `Import already in progress for vessel "${conflictVessel?.vessel ?? vesselUuid}" — ` +
            `please wait for the current import to complete and retry.`,
          );
        }
      }

      // ── Re-read planning INSIDE the transaction after locks are held ─────────
      // The pre-fetched planningByVessel map was built before the advisory locks
      // were acquired — a concurrent import could have committed new slots in the
      // window between our pre-fetch and this point.  Re-query through tx now so
      // slot matching uses the committed state at lock time, eliminating the race
      // that would allow two concurrent uploads to both insert a duplicate slot.
      const txPlanningRows = uniqueVesselUuids.length > 0
        ? await tx
            .select()
            .from(vesselPlanningV2)
            .where(
              and(
                inArray(vesselPlanningV2.vesselUuid, uniqueVesselUuids),
                eq(vesselPlanningV2.isDeleted, false),
              ),
            )
        : [];

      // Build the in-transaction planning map — this is the authoritative source
      // for slot matching and creation for the duration of this transaction.
      const txPlanningByVessel = new Map<string, any[]>();
      for (const p of txPlanningRows) {
        if (!txPlanningByVessel.has(p.vesselUuid)) txPlanningByVessel.set(p.vesselUuid, []);
        txPlanningByVessel.get(p.vesselUuid)!.push(p);
      }

      // ── Idempotency check: query existing assignments under advisory lock ────
      // Querying INSIDE the transaction (via tx) after locks are held guarantees
      // a consistent view — a concurrent importer for the same vessels cannot
      // commit assignments between our lock acquisition and this read.
      const existingAssignmentsRaw =
        allCrewUuidsForCheck.length > 0
          ? await tx
              .select({
                assignUuid: crewAssignments.assignUuid,
                crewUuid: crewAssignments.crewUuid,
                vesselUuid: crewAssignments.vesselUuid,
                assignmentType: crewAssignments.assignmentType,
                signOnDate: crewAssignments.signOnDate,
                reliefDue: crewAssignments.reliefDue,
                contractPeriod: crewAssignments.contractPeriod,
              })
              .from(crewAssignments)
              .where(
                and(
                  inArray(crewAssignments.crewUuid, allCrewUuidsForCheck),
                  eq(crewAssignments.isDeleted, false),
                ),
              )
          : [];

      const existingAssignmentMap = new Map<
        string,
        (typeof existingAssignmentsRaw)[number]
      >();
      for (const a of existingAssignmentsRaw) {
        if (!a.crewUuid || !a.vesselUuid) continue;
        const key = `${a.crewUuid}|${a.vesselUuid}|${a.assignmentType ?? ""}|${a.signOnDate ?? ""}`;
        existingAssignmentMap.set(key, a);
      }

      for (const item of rowsToProcess) {
        const crew = item.crew;
        const vessel = item.vessel;
        const isPrimary = item.assignmentType === "primary";
        const targetPos = item.targetPos;

        let finalReliefDue = item.reliefDue;
        if (!finalReliefDue && item.signOnDate && item.contractPeriod) {
          finalReliefDue = computeReliefDueDate(
            item.signOnDate,
            item.contractPeriod,
          );
        }

        // ── Find or create the planning slot ──────────────────────────────────
        // txPlanningByVessel was built from a locked re-read inside this
        // transaction — it reflects any slots committed by concurrent imports
        // before our advisory locks were acquired.  New slots created below are
        // added to the map immediately so subsequent rows for the same vessel
        // find them without additional DB round-trips.
        const planningRecords: any[] = txPlanningByVessel.get(vessel.vesselUuid) || [];
        let matchedSlot: any = planningRecords.find(
          (p: any) =>
            (p.role && norm(p.role) === norm(targetPos)) ||
            norm(p.rank) === norm(targetPos) ||
            norm(p.rank) === norm(item.rank),
        );

        if (!matchedSlot) {
          // item.resolvedRankId is guaranteed non-null here (pre-flight validated)
          const [newSlot] = await tx
            .insert(vesselPlanningV2)
            .values({
              planUuid: uuidv4(),
              vesselUuid: vessel.vesselUuid,
              rankId: item.resolvedRankId!,
              rank: targetPos,
              crewStatus: "primary",
              isArchived: false,
              isDeleted: false,
              createdByUuid: auditUserUuid ?? null,
              updatedByUuid: auditUserUuid ?? null,
            })
            .returning();
          matchedSlot = newSlot;
          // Register in the in-transaction map so subsequent rows find it
          if (!txPlanningByVessel.has(vessel.vesselUuid))
            txPlanningByVessel.set(vessel.vesselUuid, []);
          txPlanningByVessel.get(vessel.vesselUuid)!.push(newSlot);
        }

        // ── Update planning slot with crew assignment details ──────────────────
        if (matchedSlot) {
          if (isPrimary) {
            await tx
              .update(vesselPlanningV2)
              .set({
                crewUuid: crew.crewUuid,
                crewStatus: "primary",
                signOnDate: item.signOnDate ?? null,
                reliefDue: finalReliefDue ?? null,
                joiningPortUuid: item.joiningPortUuid ?? null,
                joiningStatus: item.joiningStatus ?? null,
                contractPeriodMonths: item.contractPeriod ?? null,
                updatedAt: new Date(),
                updatedByUuid: auditUserUuid ?? null,
              })
              .where(eq(vesselPlanningV2.planUuid, matchedSlot.planUuid));
          } else {
            await tx
              .update(vesselPlanningV2)
              .set({
                relieverCrewUuid: crew.crewUuid,
                relieverSignOnDate: item.signOnDate ?? null,
                reliefDue: finalReliefDue ?? null,
                joiningPortUuid: item.joiningPortUuid ?? null,
                joiningStatus: item.joiningStatus ?? null,
                relieverContractPeriodMonths: item.contractPeriod ?? null,
                updatedAt: new Date(),
                updatedByUuid: auditUserUuid ?? null,
              })
              .where(eq(vesselPlanningV2.planUuid, matchedSlot.planUuid));
          }
        }

        // ── Upsert crew_assignment row ─────────────────────────────────────────
        // If the same assignment already exists (same crew+vessel+type+signOn),
        // update mutable fields in-place rather than inserting a duplicate entry.
        const assignKey = `${crew.crewUuid}|${vessel.vesselUuid}|${item.assignmentType}|${item.signOnDate ?? ""}`;
        const existingAssignment = existingAssignmentMap.get(assignKey);

        if (existingAssignment) {
          // Already imported — update mutable fields only
          await tx
            .update(crewAssignments)
            .set({
              reliefDue: finalReliefDue ?? existingAssignment.reliefDue ?? null,
              contractPeriod: item.contractPeriod
                ? String(item.contractPeriod)
                : existingAssignment.contractPeriod,
              updatedAt: new Date(),
              updatedByUuid: auditUserUuid ?? null,
            })
            .where(eq(crewAssignments.assignUuid, existingAssignment.assignUuid));
          result.alreadyImportedCount++;
        } else {
          if (isPrimary) {
            // Mark the crew member's current primary assignment as no longer current
            // (mirrors the logic in crewAssignmentsService.assignToVessel)
            await tx
              .update(crewAssignments)
              .set({
                isCurrent: false,
                updatedAt: new Date(),
                updatedByUuid: auditUserUuid ?? null,
              })
              .where(
                and(
                  eq(crewAssignments.crewUuid, crew.crewUuid),
                  eq(crewAssignments.assignmentType, "primary"),
                  eq(crewAssignments.isCurrent, true),
                ),
              );
          }

          await tx.insert(crewAssignments).values({
            assignUuid: uuidv4(),
            crewUuid: crew.crewUuid,
            vesselUuid: vessel.vesselUuid,
            // Historical snapshots — preserved so crew history remains readable
            // even if the vessel is later renamed or the rank definition changes.
            vesselName: vessel.vessel ?? null,
            rank: item.rank ?? null,
            isCurrent: isPrimary, // true for primary, false for secondary
            signOnDate: item.signOnDate ?? null,
            reliefDue: finalReliefDue ?? null,
            contractPeriod: item.contractPeriod ? String(item.contractPeriod) : null,
            assignmentType: item.assignmentType,
            portOfJoiningUuid: item.joiningPortUuid ?? null,
            isDeleted: false,
            createdByUuid: auditUserUuid ?? null,
            updatedByUuid: auditUserUuid ?? null,
          });

          if (isPrimary) result.primaryAssignedCount++;
          else result.secondaryAssignedCount++;
        }
      }
    });

    result.success = true;
  } catch (err: any) {
    const rawMsg = err.message || String(err);
    let userFriendlyMsg = rawMsg;

    if (rawMsg.includes('null value in column "vessel_uuid"')) {
      userFriendlyMsg =
        "One or more vessels in the uploaded sheet are missing a valid vessel identifier in Master Vessels.";
    } else if (rawMsg.includes("null value in column")) {
      userFriendlyMsg =
        "Required database information is missing from the uploaded record.";
    } else if (rawMsg.includes("violates not-null constraint")) {
      userFriendlyMsg =
        "Import aborted: A mandatory field was missing during database save.";
    } else if (rawMsg.includes("violates foreign key constraint")) {
      userFriendlyMsg =
        "Import aborted: Referenced seafarer, vessel, or port does not exist in master records.";
    } else if (rawMsg.includes("violates unique constraint")) {
      userFriendlyMsg =
        "Import aborted: A duplicate record already exists in the system.";
    }

    result.errors.push(
      `Failed to process assignments import: ${userFriendlyMsg}`,
    );
    result.success = false;
  }

  return result;
}
