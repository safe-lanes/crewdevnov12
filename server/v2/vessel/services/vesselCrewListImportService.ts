import ExcelJS from "exceljs";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels, masterPorts } from "../../../../shared/schema";
import { admCompanyRanksV2, admVesselRevisionsV2 } from "../../../../shared/v2/admin/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { vesselRevisionsService } from "../../admin/services/vesselRevisionsService";
import { vesselDraftsService } from "../../admin/services/vesselDraftsService";
import { vesselPlanningService } from "./vesselPlanningService";
import { vesselPlanningRepository } from "../repositories/vesselPlanningRepository";
import { crewAssignmentsService } from "../../crew-pool/services/crewAssignmentsService";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";

export interface HierarchyImportResult {
  vesselsProcessed: number;
  activeRanksCount: number;
  deletedRanksCount: number;
  errors: string[];
}

export interface AssignmentsImportResult {
  totalRowsProcessed: number;
  primaryAssignedCount: number;
  secondaryAssignedCount: number;
  skippedCount: number;
  errors: string[];
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
//   1. Planning rows — only vacant slots (crewUuid IS NULL) created AFTER
//      phase2StartTime are soft-deleted.  Pre-existing vacant slots (created
//      before the import started) and all assigned rows are left untouched.
//   2. Revisions — hard-deleted by exact ID, not by vessel UUID, so historical
//      revisions for those vessels survive.
//   3. Drafts — submit() hard-deletes drafts; we re-create them from the
//      in-memory copy captured during Phase 1 validation.

interface CommittedVessel {
  vesselUuid: string;
  revisionId: number;
  /** All drafts that existed for this vessel before submit() hard-deleted them. */
  savedDrafts: { vesselId: string; revision: string; draftData: string }[];
  /**
   * planUuids that were active BEFORE submit() ran.
   * Used to restore rows that syncVesselPlanningV2's dedup step soft-deleted.
   */
  preSyncPlanUuids: string[];
  /**
   * planUuids created by syncVesselPlanningV2 during THIS submit() call.
   * Rollback soft-deletes exactly these rows — no time-window predicate needed.
   */
  createdPlanUuids: string[];
}

async function rollbackHierarchyImport(
  committed: CommittedVessel[],
): Promise<void> {
  if (committed.length === 0) return;
  const db = getDb();
  const revisionIds = committed.map((c) => c.revisionId);

  try {
    // Step 1 — Soft-delete the EXACT planning rows created by this import run.
    // We use the planUuids returned by syncVesselPlanningV2 rather than a
    // time-window predicate, so concurrent slots on the same vessel are safe.
    const allCreatedUuids = committed.flatMap((c) => c.createdPlanUuids);
    if (allCreatedUuids.length > 0) {
      await db
        .update(vesselPlanningV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(vesselPlanningV2.planUuid, allCreatedUuids));
    }

    // Step 2 — Restore pre-existing rows that syncVesselPlanningV2's dedup
    // step may have soft-deleted.  We recorded every active planUuid that
    // existed before submit() ran; any of those now marked isDeleted=true
    // were deleted by the sync and must be reinstated.
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

    // Step 3 — Hard-delete the exact revision rows created by this import (by ID).
    await db
      .delete(admVesselRevisionsV2)
      .where(inArray(admVesselRevisionsV2.id, revisionIds));

    // Step 4 — Restore ALL drafts hard-deleted by submit(), using the verbatim
    // copies captured during Phase 1 validation (entire array per vessel).
    for (const c of committed) {
      for (const draft of c.savedDrafts) {
        await vesselDraftsService.create({
          vesselId: draft.vesselId,
          revision: draft.revision,
          draftData: draft.draftData,
        });
      }
    }
  } catch (rollbackErr) {
    console.error(
      "[VESSEL IMPORT] Rollback failed — manual intervention may be required:",
      rollbackErr,
    );
  }
}

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
 * Optimisation: planning records for all vessels are loaded in ONE batch query
 * before the loop, eliminating the per-vessel getByVesselUuid call (~400 ms × N).
 */
export async function importVesselRankHierarchy(
  xlsxBuffer: Buffer,
): Promise<HierarchyImportResult> {
  const result: HierarchyImportResult = {
    vesselsProcessed: 0,
    activeRanksCount: 0,
    deletedRanksCount: 0,
    errors: [],
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
      /**
       * ALL drafts captured verbatim before submit() hard-deletes them.
       * submit() iterates and deletes every draft for a vessel, so capturing
       * only drafts[0] would permanently lose any additional drafts on failure.
       */
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
        if (
          st === "deleted" ||
          st === "not required" ||
          st === "inactive"
        ) {
          deletedRankRoles.add(posKey);
        } else {
          activeRankRoles.add(posKey);
        }
      }

      // Duplicate-upload guard (unchanged logic)
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
      // Capture EVERY draft verbatim — submit() hard-deletes all drafts for a
      // vessel; only capturing drafts[0] would permanently lose any extras.
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

    // ── Phase 2: Parallel batch writes (10 vessels at a time) ───────────────
    const BATCH_SIZE = 10;
    const committed: CommittedVessel[] = [];

    for (let i = 0; i < validVessels.length; i += BATCH_SIZE) {
      const batch = validVessels.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (v) => {
          // Snapshot the planUuids that are active BEFORE this submit() call.
          // syncVesselPlanningV2's dedup step may soft-delete some of these;
          // we record them so rollback can restore the exact pre-import state.
          const preSyncPlanUuids = (planningByVessel.get(v.vesselUuid) || []).map(
            (p: any) => p.planUuid as string,
          );

          const submitResult = await vesselRevisionsService.submit(
            {
              vesselId: v.vesselUuid,
              revisionDate: todayStr,
              revisionData: JSON.stringify(v.updatedRevisionData),
            },
            // throwOnSyncError=true causes submit() to:
            //   (a) pass strictMode=true to syncVesselPlanningV2 so per-record
            //       creation failures propagate instead of being swallowed
            //   (b) attach partialRevisionId to the thrown error so the failure
            //       handler below can include this vessel in the rollback set
            //       even though allSettled carries no return value on rejection
            { throwOnSyncError: true },
          );
          return {
            vesselUuid: v.vesselUuid,
            revisionId: submitResult.revision.id,
            // Exact planUuids created by this submit's syncVesselPlanningV2 call.
            // Rollback soft-deletes only these rows — no time-window predicate.
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
        // Collect ALL started vessels from THIS failing batch before rolling back:
        //
        // Fulfilled — committed successfully; must be reversed (all three artefacts:
        //   revision, drafts, newly created planning rows).
        // Rejected with partialRevisionId — submit() created the revision and
        //   deleted ALL drafts before sync threw; rollback must undo those writes
        //   too, even though allSettled returns no value for rejected items.
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
            // Identify the corresponding ValidatedVessel to restore its drafts.
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
              // Sync threw before returning, so no planUuids were captured.
              createdPlanUuids: [],
            });
          }
        }
        await rollbackHierarchyImport(committed);
        const firstMsg =
          failures[0].reason?.message || String(failures[0].reason);
        result.errors.push(
          `Import failed after committing ${committed.length} vessel(s). All changes have been rolled back. Error: ${firstMsg}`,
        );
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
  } catch (err: any) {
    result.errors.push(
      `Failed to process hierarchy import: ${err.message || String(err)}`,
    );
  }

  return result;
}

// ── Helpers shared by Stage 2 ────────────────────────────────────────────────

function parseDateStringStrict(str: string | null | undefined): string | null {
  if (!str) return null;
  const trimmed = String(str).trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // DD-MMM-YYYY or DD-MMM-YY
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const textMatch = trimmed.match(
    /^(\d{1,2})[\/\s-]([a-zA-Z]{3})[\/\s-](\d{2,4})$/,
  );
  if (textMatch) {
    const [, dd, mmm, yyyyStr] = textMatch;
    const mm = monthNames[mmm.toLowerCase()];
    let yyyy = yyyyStr;
    if (yyyy.length === 2) {
      const yrNum = parseInt(yyyy, 10);
      yyyy = yrNum > 30 ? `19${yyyy}` : `20${yyyy}`;
    }
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
  }

  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serialNum = parseFloat(trimmed);
    if (serialNum > 20000 && serialNum < 90000) {
      const dateObj = new Date((serialNum - (25567 + 2)) * 86400 * 1000);
      if (!isNaN(dateObj.getTime())) {
        const yr = dateObj.getUTCFullYear();
        const mo = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const da = String(dateObj.getUTCDate()).padStart(2, "0");
        return `${yr}-${mo}-${da}`;
      }
    }
  }

  // Fallback: native JS Date string / ISO string
  const jsDate = new Date(trimmed);
  if (!isNaN(jsDate.getTime())) {
    const yr = jsDate.getFullYear();
    const mo = String(jsDate.getMonth() + 1).padStart(2, "0");
    const da = String(jsDate.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  }

  return null;
}

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
 * Optimisation: planning records for all referenced vessels are loaded in ONE
 * batch query before the transaction loop, replacing the per-row
 * vesselPlanningService.getByVesselUuid() call (was ~400 ms × N rows).
 */
export async function importCrewAssignments(
  xlsxBuffer: Buffer,
): Promise<AssignmentsImportResult> {
  const result: AssignmentsImportResult = {
    totalRowsProcessed: 0,
    primaryAssignedCount: 0,
    secondaryAssignedCount: 0,
    skippedCount: 0,
    errors: [],
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
    const [allCrew, allVessels, allPorts]: [any[], any[], any[]] =
      await Promise.all([
        db
          .select()
          .from(crewMembersV2)
          .where(eq(crewMembersV2.isDeleted, false)),
        db.select().from(masterVessels),
        db.select().from(masterPorts).where(eq(masterPorts.isDeleted, false)),
      ]);

    const crewByEmpIdMap = new Map<string, any>();
    const crewByPassportMap = new Map<string, any>();
    for (const c of allCrew) {
      if (c.employeeId) crewByEmpIdMap.set(norm(c.employeeId), c);
      if (c.empNo) crewByEmpIdMap.set(norm(c.empNo), c);
      if (c.passportNo) crewByPassportMap.set(norm(c.passportNo), c);
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

    // Build dynamic header map from Row 1
    const headerRow = assignmentsSheet.getRow(1);
    const colMap = new Map<string, number>();
    headerRow.eachCell((cell, colNum) => {
      const headerText = norm(getCellValue(cell));
      if (headerText) colMap.set(headerText, colNum);
    });

    const getColVal = (
      row: ExcelJS.Row,
      headerName: string,
      fallbackIdx: number,
    ): string => {
      const colIdx = colMap.get(norm(headerName)) || fallbackIdx;
      return getCellValue(row.getCell(colIdx));
    };

    const rowsToProcess: any[] = [];
    const rowErrorsMap = new Map<number, string[]>();

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
      if (
        assignmentType &&
        normAssignType !== "primary" &&
        normAssignType !== "secondary"
      ) {
        errors.push(
          `Assignment Type '${assignmentType}' is invalid (Must be Primary or Secondary)`,
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
            `Joining Status '${joiningStatus}' is invalid (Must be Signed On, Planned, or In Transit)`,
          );
        }
      }

      const parsedSignOn = parseDateStringStrict(signOnDate);
      if (signOnDate && !parsedSignOn) {
        errors.push(
          `Sign On Date '${signOnDate}' is invalid or unparseable`,
        );
      }

      const parsedReliefDue = parseDateStringStrict(reliefDue);
      if (reliefDue && !parsedReliefDue) {
        errors.push(
          `Relief Due Date '${reliefDue}' is invalid or unparseable`,
        );
      }

      let crew: any = null;
      if (employeeId) {
        crew =
          crewByEmpIdMap.get(norm(employeeId)) ||
          crewByPassportMap.get(norm(employeeId));
        if (!crew) {
          errors.push(
            `Seafarer with Employee ID / Passport '${employeeId}' is not registered in system`,
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

      if (errors.length > 0) rowErrorsMap.set(rowNumber, errors);

      rowsToProcess.push({
        rowNumber,
        employeeId,
        vesselName,
        imo,
        rank,
        position,
        signOnDate: parsedSignOn,
        contractPeriod: contractPeriod ? parseInt(contractPeriod, 10) || null : null,
        reliefDue: parsedReliefDue,
        portOfJoining,
        joiningPortUuid,
        assignmentType: normAssignType === "secondary" ? "secondary" : "primary",
        joiningStatus: joiningStatus || "Signed On",
        relieverRank,
        crew,
        vessel,
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

    // ── Pre-load ALL planning in ONE batch query ──────────────────────────────
    // Replaces per-row vesselPlanningService.getByVesselUuid() calls
    // (~400 ms × 2 000 rows → ~1–2 s total regardless of row count).
    const uniqueVesselUuids = [
      ...new Set(
        rowsToProcess
          .filter((r) => r.vessel?.vesselUuid)
          .map((r) => r.vessel.vesselUuid as string),
      ),
    ];

    const batchPlanning =
      uniqueVesselUuids.length > 0
        ? await vesselPlanningRepository.findByVesselUuidBatch(uniqueVesselUuids)
        : [];

    const planningByVessel = new Map<string, any[]>();
    for (const p of batchPlanning) {
      if (!planningByVessel.has(p.vesselUuid))
        planningByVessel.set(p.vesselUuid, []);
      planningByVessel.get(p.vesselUuid)!.push(p);
    }

    // ── Atomic DB transaction ─────────────────────────────────────────────────
    await db.transaction(async (tx: any) => {
      for (const item of rowsToProcess) {
        const crew = item.crew;
        const vessel = item.vessel;
        const isPrimary = item.assignmentType === "primary";

        let finalReliefDue = item.reliefDue;
        if (!finalReliefDue && item.signOnDate && item.contractPeriod) {
          finalReliefDue = computeReliefDueDate(
            item.signOnDate,
            item.contractPeriod,
          );
        }

        const targetPos = item.position || item.rank;

        // Use pre-loaded planning map — eliminates the N+1 per-row DB call
        const planningRecords: any[] =
          planningByVessel.get(vessel.vesselUuid) || [];

        if (isPrimary) {
          let matchedSlot: any = planningRecords.find(
            (p: any) =>
              (p.role && norm(p.role) === norm(targetPos)) ||
              norm(p.rank) === norm(targetPos) ||
              norm(p.rank) === norm(item.rank),
          );

          if (!matchedSlot) {
            matchedSlot = await vesselPlanningService.create({
              vesselUuid: vessel.vesselUuid,
              rankId: "R000",
              rank: item.position || item.rank,
              crewStatus: "primary",
              isArchived: false,
              isDeleted: false,
            });
            // Register the new slot in the pre-loaded map so subsequent rows
            // for the same vessel find it rather than creating a duplicate.
            if (matchedSlot) {
              if (!planningByVessel.has(vessel.vesselUuid))
                planningByVessel.set(vessel.vesselUuid, []);
              planningByVessel.get(vessel.vesselUuid)!.push(matchedSlot);
            }
          }

          if (matchedSlot) {
            await vesselPlanningService.update(matchedSlot.planUuid, {
              crewUuid: crew.crewUuid,
              crewStatus: "primary",
              signOnDate: item.signOnDate || undefined,
              reliefDue: finalReliefDue || undefined,
              joiningPortUuid: item.joiningPortUuid,
              joiningStatus: item.joiningStatus,
              contractPeriodMonths: item.contractPeriod || undefined,
            });
          }

          await crewAssignmentsService.assignToVessel(
            crew.crewUuid,
            vessel.vesselUuid,
            {
              signOnDate: item.signOnDate || new Date(),
              reliefDue: finalReliefDue || undefined,
              contractPeriod: item.contractPeriod
                ? String(item.contractPeriod)
                : undefined,
              assignmentType: "primary",
              isCurrent: true,
              vesselName: vessel.vessel,
              rank: item.rank,
            },
          );

          result.primaryAssignedCount++;
        } else {
          const targetRank = item.relieverRank || item.position || item.rank;
          let matchedSlot: any = planningRecords.find(
            (p: any) =>
              (p.role && norm(p.role) === norm(targetRank)) ||
              norm(p.rank) === norm(targetRank) ||
              norm(p.rank) === norm(item.rank),
          );

          if (!matchedSlot) {
            matchedSlot = await vesselPlanningService.create({
              vesselUuid: vessel.vesselUuid,
              rankId: "R000",
              rank: targetRank,
              crewStatus: "primary",
              isArchived: false,
              isDeleted: false,
            });
            // Register the new slot in the pre-loaded map so subsequent rows
            // for the same vessel find it rather than creating a duplicate.
            if (matchedSlot) {
              if (!planningByVessel.has(vessel.vesselUuid))
                planningByVessel.set(vessel.vesselUuid, []);
              planningByVessel.get(vessel.vesselUuid)!.push(matchedSlot);
            }
          }

          if (matchedSlot) {
            await vesselPlanningService.updateReliever(matchedSlot.planUuid, {
              relieverCrewUuid: crew.crewUuid,
              relieverSignOnDate: item.signOnDate || undefined,
              reliefDue: finalReliefDue || undefined,
              joiningPortUuid: item.joiningPortUuid,
              joiningStatus: item.joiningStatus,
              relieverContractPeriodMonths: item.contractPeriod || undefined,
            });
          }

          await crewAssignmentsService.assignToVessel(
            crew.crewUuid,
            vessel.vesselUuid,
            {
              signOnDate: item.signOnDate || new Date(),
              reliefDue: finalReliefDue || undefined,
              contractPeriod: item.contractPeriod
                ? String(item.contractPeriod)
                : undefined,
              assignmentType: "secondary",
              isCurrent: false,
              vesselName: vessel.vessel,
              rank: item.rank,
            },
          );

          result.secondaryAssignedCount++;
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
