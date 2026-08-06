import ExcelJS from "exceljs";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels, masterPorts } from "../../../../shared/schema";
import { admCompanyRanksV2 } from "../../../../shared/v2/admin/schema";
import { vesselRevisionsService } from "../../admin/services/vesselRevisionsService";
import { vesselDraftsService } from "../../admin/services/vesselDraftsService";
import { vesselPlanningService } from "./vesselPlanningService";
import { crewAssignmentsService } from "../../crew-pool/services/crewAssignmentsService";
import { eq } from "drizzle-orm";

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
}

function norm(str: string | null | undefined): string {
  return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getCellValue(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  if (typeof cell.value === "string") return cell.value.trim();
  if (typeof cell.value === "number") return String(cell.value).trim();
  if (cell.value && typeof cell.value === "object") {
    if ("result" in cell.value && cell.value.result != null) {
      return String(cell.value.result).trim();
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

/**
 * Stage 1: Import VesselRankHierarchy sheet ➔ updates adm_vessel_revisions_v2 & syncs vessel_planning_v2 slots
 * Restricts duplicate re-uploads if the exact hierarchy is already imported.
 */
export async function importVesselRankHierarchy(xlsxBuffer: Buffer): Promise<HierarchyImportResult> {
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
      result.errors.push("Missing 'VesselRankHierarchy' sheet in uploaded Excel workbook");
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

    // Group rows by vessel IMO / Name
    const vesselRowsMap = new Map<string, { vesselUuid: string; vesselName: string; rows: { rank: string; status: string }[] }>();

    for (let rowNumber = 2; rowNumber <= hierarchySheet.rowCount; rowNumber++) {
      const row = hierarchySheet.getRow(rowNumber);
      const vesselName = getCellValue(row.getCell(1));
      const imo = getCellValue(row.getCell(2));
      const rank = getCellValue(row.getCell(3));
      const status = getCellValue(row.getCell(4));

      if (!vesselName && !imo) continue;

      const cleanImo = (imo || "").replace(/\D/g, "");
      let matchedVessel: any = (cleanImo ? vesselByImoMap.get(cleanImo) : null) || vesselByNameMap.get(norm(vesselName));

      if (!matchedVessel) {
        // Auto-create vessel in master_vessels if not found so import completes seamlessly
        try {
          const [newVessel] = await db
            .insert(masterVessels)
            .values({
              vessel: vesselName || "Imported Vessel",
              imo: imo || undefined,
              isDeleted: false,
            })
            .returning();

          matchedVessel = newVessel;
          if (cleanImo) vesselByImoMap.set(cleanImo, matchedVessel);
          if (vesselName) vesselByNameMap.set(norm(vesselName), matchedVessel);
        } catch (err: any) {
          result.errors.push(`Row ${rowNumber}: Could not create or resolve vessel "${vesselName}": ${err.message}`);
          continue;
        }
      }

      const key: string = matchedVessel.vesselUuid;
      if (!vesselRowsMap.has(key)) {
        vesselRowsMap.set(key, { vesselUuid: key, vesselName: matchedVessel.vessel || vesselName, rows: [] });
      }
      vesselRowsMap.get(key)!.rows.push({ rank, status });
    }

    const todayStr = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY

    // Load company ranks as fallback structure
    const allCompanyRanks = await db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false));

    // Submit revisions for each vessel
    for (const [vesselUuid, group] of vesselRowsMap.entries()) {
      try {
        // Fetch existing planning records for vessel to check for duplicate upload
        const existingPlanning: any[] = await vesselPlanningService.getByVesselUuid(vesselUuid);
        const existingRanksSet = new Set<string>(existingPlanning.map((p) => norm(p.rank)));

        // Build set of Active and Deleted rank roles from sheet
        const activeRankRoles = new Set<string>();
        const deletedRankRoles = new Set<string>();

        group.rows.forEach((r) => {
          const rankKey = norm(r.rank);
          if (norm(r.status) === "deleted") {
            deletedRankRoles.add(rankKey);
          } else {
            activeRankRoles.add(rankKey);
          }
        });

        // Check if all active rank roles in sheet ALREADY exist in vessel planning and no ranks are deleted
        let isIdenticalHierarchy = activeRankRoles.size > 0 && deletedRankRoles.size === 0;
        if (isIdenticalHierarchy) {
          for (const rankKey of activeRankRoles) {
            if (!existingRanksSet.has(rankKey)) {
              isIdenticalHierarchy = false;
              break;
            }
          }
        }

        if (isIdenticalHierarchy) {
          result.errors.push(`Duplicate upload restricted: Rank hierarchy for vessel "${group.vesselName}" has already been imported into the system.`);
          continue;
        }

        group.rows.forEach((r) => {
          if (norm(r.status) === "deleted") {
            result.deletedRanksCount++;
          } else {
            result.activeRanksCount++;
          }
        });

        // Load draft for vessel
        const drafts = await vesselDraftsService.getByVesselId(vesselUuid);
        let revisionDataList: any[] = [];

        if (drafts.length > 0 && drafts[0].draftData) {
          revisionDataList = JSON.parse(drafts[0].draftData);
        } else {
          // If no draft exists, load latest revision
          const revisions = await vesselRevisionsService.getByVesselId(vesselUuid);
          if (revisions.length > 0 && revisions[0].revisionData) {
            revisionDataList = JSON.parse(revisions[0].revisionData);
          }
        }

        if (revisionDataList.length === 0) {
          // Build default revision structure from company ranks
          revisionDataList = allCompanyRanks.map((cr: any) => ({
            ...cr,
            actualManningFlag: false,
            actualManning: [],
            safeManning: false,
            optimumManning: false,
            highWorkloadManning: false,
          }));
        }

        // Update actualManningFlag in revision_data
        const updatedRevisionData = revisionDataList.map((rankObj: any) => {
          const roleName = rankObj.role || rankObj.rank;
          const roleKey = norm(roleName);

          if (deletedRankRoles.has(roleKey)) {
            return { ...rankObj, actualManningFlag: false };
          }
          if (activeRankRoles.has(roleKey)) {
            return { ...rankObj, actualManningFlag: true };
          }
          return rankObj;
        });

        // Submit revision -> INSERTS adm_vessel_revisions_v2, DELETES draft, calls syncVesselPlanningV2()
        await vesselRevisionsService.submit({
          vesselId: vesselUuid,
          revisionDate: todayStr,
          revisionData: JSON.stringify(updatedRevisionData),
        });

        result.vesselsProcessed++;
      } catch (err: any) {
        result.errors.push(`Vessel ${vesselUuid}: ${err.message || String(err)}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to process hierarchy import: ${err.message || String(err)}`);
  }

  return result;
}

/**
 * Stage 2: Import Assignments sheet ➔ updates vessel_planning_v2 & inserts crew_assignments (fully independent)
 * Restricts duplicate assignments if seafarer is already assigned to the exact vessel slot.
 */
export async function importCrewAssignments(xlsxBuffer: Buffer): Promise<AssignmentsImportResult> {
  const result: AssignmentsImportResult = {
    totalRowsProcessed: 0,
    primaryAssignedCount: 0,
    secondaryAssignedCount: 0,
    skippedCount: 0,
    errors: [],
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
    const [allCrew, allVessels, allPorts]: [any[], any[], any[]] = await Promise.all([
      db.select().from(crewMembersV2).where(eq(crewMembersV2.isDeleted, false)),
      db.select().from(masterVessels),
      db.select().from(masterPorts).where(eq(masterPorts.isDeleted, false)),
    ]);

    const crewByEmpIdMap = new Map<string, any>();
    for (const c of allCrew) {
      if (c.employeeId) crewByEmpIdMap.set(norm(c.employeeId), c);
      if (c.empNo) crewByEmpIdMap.set(norm(c.empNo), c);
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
    }

    // Build dynamic header map from Row 1 for robust column resolution
    const headerRow = assignmentsSheet.getRow(1);
    const colMap = new Map<string, number>();
    headerRow.eachCell((cell, colNum) => {
      const headerText = norm(getCellValue(cell));
      if (headerText) colMap.set(headerText, colNum);
    });

    const getColVal = (row: ExcelJS.Row, headerName: string, fallbackIdx: number): string => {
      const colIdx = colMap.get(norm(headerName)) || fallbackIdx;
      return getCellValue(row.getCell(colIdx));
    };

    const rowsToProcess: any[] = [];
    for (let rowNumber = 2; rowNumber <= assignmentsSheet.rowCount; rowNumber++) {
      const row = assignmentsSheet.getRow(rowNumber);

      const employeeId = getColVal(row, "Employee ID", 1);
      const vesselName = getColVal(row, "Vessel Name", 2);
      const imo = getColVal(row, "IMO", 3);
      const rank = getColVal(row, "Rank", 4);
      const signOnDate = getColVal(row, "Sign On Date", 5);
      const contractPeriod = getColVal(row, "Contract Period (Months)", 6);
      const reliefDue = getColVal(row, "Relief Due Date", 7);
      const portOfJoining = getColVal(row, "Port of Joining", 8);
      const assignmentType = getColVal(row, "Assignment Type", 9) || "Primary";
      const joiningStatus = getColVal(row, "Joining Status", 10) || "Signed On";
      const relieverRank = getColVal(row, "Reliever Rank", 11);

      if (!employeeId && !vesselName && !rank) continue;

      if (!employeeId) {
        result.skippedCount++;
        result.errors.push(`Row ${rowNumber} (${rank}): Employee ID is missing`);
        continue;
      }

      rowsToProcess.push({
        rowNumber,
        employeeId,
        vesselName,
        imo,
        rank,
        signOnDate,
        contractPeriod,
        reliefDue,
        portOfJoining,
        assignmentType,
        joiningStatus,
        relieverRank,
      });
    }

    for (const item of rowsToProcess) {
      result.totalRowsProcessed++;

      const crew: any = crewByEmpIdMap.get(norm(item.employeeId));
      if (!crew) {
        result.errors.push(`Row ${item.rowNumber}: Employee ID "${item.employeeId}" not found in system`);
        result.skippedCount++;
        continue;
      }

      const cleanImo = (item.imo || "").replace(/\D/g, "");
      let vessel: any = (cleanImo ? vesselByImoMap.get(cleanImo) : null) || vesselByNameMap.get(norm(item.vesselName));

      if (!vessel) {
        // Auto-create missing vessel in master_vessels if not found so Stage 2 can run independently!
        try {
          const [newVessel] = await db
            .insert(masterVessels)
            .values({
              vessel: item.vesselName || "Imported Vessel",
              imo: item.imo || undefined,
              isDeleted: false,
            })
            .returning();

          vessel = newVessel;
          if (cleanImo) vesselByImoMap.set(cleanImo, vessel);
          if (item.vesselName) vesselByNameMap.set(norm(item.vesselName), vessel);
        } catch (err: any) {
          result.errors.push(`Row ${item.rowNumber}: Could not resolve vessel "${item.vesselName}": ${err.message}`);
          result.skippedCount++;
          continue;
        }
      }

      const joiningPortUuid: string | undefined = item.portOfJoining ? portByNameMap.get(norm(item.portOfJoining)) || undefined : undefined;
      const isPrimary = norm(item.assignmentType) === "primary";

      try {
        if (isPrimary) {
          // Primary Crew Assignment
          const planningRecords: any[] = await vesselPlanningService.getByVesselUuid(vessel.vesselUuid);
          let matchedSlot: any = planningRecords.find((p: any) => norm(p.rank) === norm(item.rank));

          // DUPLICATE CHECK: Restrict duplicate assignment if seafarer is already assigned to this slot on the vessel
          if (matchedSlot && matchedSlot.crewUuid === crew.crewUuid) {
            result.skippedCount++;
            result.errors.push(`Row ${item.rowNumber} (${item.employeeId}): Seafarer "${crew.firstName} ${crew.familyName}" is already assigned to ${item.rank} on ${vessel.vessel} (Duplicate upload skipped)`);
            continue;
          }

          if (!matchedSlot) {
            // Auto-create position slot in vessel_planning_v2 if missing so Stage 2 can run independently
            matchedSlot = await vesselPlanningService.create({
              vesselUuid: vessel.vesselUuid,
              rankId: "R000",
              rank: item.rank,
              crewStatus: "primary",
              isArchived: false,
              isDeleted: false,
            });
          }

          if (matchedSlot) {
            await vesselPlanningService.update(matchedSlot.planUuid, {
              crewUuid: crew.crewUuid,
              crewStatus: "primary",
              signOnDate: item.signOnDate || undefined,
              joiningPortUuid: joiningPortUuid,
              joiningStatus: item.joiningStatus || "Signed On",
            });
          }

          // Insert into crew_assignments
          await crewAssignmentsService.assignToVessel(crew.crewUuid, vessel.vesselUuid, {
            signOnDate: item.signOnDate || new Date(),
            reliefDue: item.reliefDue || undefined,
            contractPeriod: item.contractPeriod || undefined,
            assignmentType: "primary",
            isCurrent: true,
            vesselName: vessel.vessel,
            rank: item.rank,
          });

          result.primaryAssignedCount++;
        } else {
          // Secondary Reliever Assignment
          const targetRank = item.relieverRank || item.rank;
          const planningRecords: any[] = await vesselPlanningService.getByVesselUuid(vessel.vesselUuid);
          let matchedSlot: any = planningRecords.find((p: any) => norm(p.rank) === norm(targetRank));

          // DUPLICATE CHECK: Restrict duplicate reliever assignment if reliever is already assigned to this slot
          if (matchedSlot && matchedSlot.relieverCrewUuid === crew.crewUuid) {
            result.skippedCount++;
            result.errors.push(`Row ${item.rowNumber} (${item.employeeId}): Reliever "${crew.firstName} ${crew.familyName}" is already assigned to ${targetRank} on ${vessel.vessel} (Duplicate upload skipped)`);
            continue;
          }

          if (!matchedSlot) {
            matchedSlot = await vesselPlanningService.create({
              vesselUuid: vessel.vesselUuid,
              rankId: "R000",
              rank: targetRank,
              crewStatus: "primary",
              isArchived: false,
              isDeleted: false,
            });
          }

          if (matchedSlot) {
            await vesselPlanningService.updateReliever(matchedSlot.planUuid, {
              relieverCrewUuid: crew.crewUuid,
              relieverSignOnDate: item.signOnDate || undefined,
              joiningPortUuid: joiningPortUuid,
              joiningStatus: item.joiningStatus || "Planned",
            });
          }

          // Insert into crew_assignments as secondary
          await crewAssignmentsService.assignToVessel(crew.crewUuid, vessel.vesselUuid, {
            signOnDate: item.signOnDate || new Date(),
            reliefDue: item.reliefDue || undefined,
            contractPeriod: item.contractPeriod || undefined,
            assignmentType: "secondary",
            isCurrent: false,
            vesselName: vessel.vessel,
            rank: item.rank,
          });

          result.secondaryAssignedCount++;
        }
      } catch (err: any) {
        result.errors.push(`Row ${item.rowNumber} (${item.employeeId}): ${err.message || String(err)}`);
      }
    }

    if (result.totalRowsProcessed > 0 && result.skippedCount === result.totalRowsProcessed) {
      result.errors.unshift("Duplicate upload restricted: All crew assignments in this sheet have already been imported into the system.");
    }
  } catch (err: any) {
    result.errors.push(`Failed to process assignments import: ${err.message || String(err)}`);
  }

  return result;
}
