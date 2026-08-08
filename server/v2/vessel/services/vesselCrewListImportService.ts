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
    const vesselRowsMap = new Map<string, { vesselUuid: string; vesselName: string; rows: { rank: string; position: string; status: string }[] }>();

    for (let rowNumber = 2; rowNumber <= hierarchySheet.rowCount; rowNumber++) {
      const row = hierarchySheet.getRow(rowNumber);
      const vesselName = getCellValue(row.getCell(1));
      const imo = getCellValue(row.getCell(2));
      const rank = getCellValue(row.getCell(3));
      const position = getCellValue(row.getCell(4));
      const status = getCellValue(row.getCell(5)) || getCellValue(row.getCell(4)); // Fallback if 4-column sheet uploaded

      if (!vesselName && !imo) continue;

      const cleanImo = (imo || "").replace(/\D/g, "");
      let matchedVessel: any = (cleanImo ? vesselByImoMap.get(cleanImo) : null) || vesselByNameMap.get(norm(vesselName));

      if (!matchedVessel) {
        result.errors.push(`Row ${rowNumber}: Vessel "${vesselName || "Unknown"}" ${imo ? `(IMO: ${imo})` : ""} is not registered in Master Vessels. Please create the vessel in Master Vessels before uploading.`);
        continue;
      }

      const key: string = matchedVessel.vesselUuid;
      if (!vesselRowsMap.has(key)) {
        vesselRowsMap.set(key, { vesselUuid: key, vesselName: matchedVessel.vessel || vesselName, rows: [] });
      }
      vesselRowsMap.get(key)!.rows.push({ rank, position, status });
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
          const posKey = norm(r.position || r.rank);
          const st = norm(r.status);

          if (st === "deleted" || st === "not required" || st === "inactive") {
            deletedRankRoles.add(posKey);
          } else {
            activeRankRoles.add(posKey);
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
          const st = norm(r.status);
          if (st === "deleted" || st === "not required" || st === "inactive") {
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
export interface AssignmentsImportResult {
  totalRowsProcessed: number;
  primaryAssignedCount: number;
  secondaryAssignedCount: number;
  skippedCount: number;
  errors: string[];
  errorExcelBuffer?: string;
  success?: boolean;
}

function parseDateStringStrict(str: string | null | undefined): string | null {
  if (!str) return null;
  const trimmed = String(str).trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // DD-MMM-YYYY or DD-MMM-YY (e.g. 15-Jan-1985 or 01-Jan-80)
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };
  const textMatch = trimmed.match(/^(\d{1,2})[\/\s-]([a-zA-Z]{3})[\/\s-](\d{2,4})$/);
  if (textMatch) {
    const [, dd, mmm, yyyyStr] = textMatch;
    const mm = monthNames[mmm.toLowerCase()];
    let yyyy = yyyyStr;
    if (yyyy.length === 2) {
      const yrNum = parseInt(yyyy, 10);
      yyyy = yrNum > 30 ? `19${yyyy}` : `20${yyyy}`;
    }
    if (mm) {
      return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
    }
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

  // Fallback for native JS Date string output or ISO string (e.g., "Sat Sep 05 2026 05:30:00 GMT+0530...")
  const jsDate = new Date(trimmed);
  if (!isNaN(jsDate.getTime())) {
    const yr = jsDate.getFullYear();
    const mo = String(jsDate.getMonth() + 1).padStart(2, "0");
    const da = String(jsDate.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  }

  return null;
}

function computeReliefDueDate(signOnDateStr: string, contractMonths: number): string {
  const dateObj = new Date(signOnDateStr);
  dateObj.setMonth(dateObj.getMonth() + contractMonths);
  return dateObj.toISOString().split("T")[0];
}

/**
 * Stage 2: Import Assignments sheet ➔ updates vessel_planning_v2 & inserts crew_assignments
 * Uses Strict All-or-Nothing Validation & Atomic Database Transactions.
 */
export async function importCrewAssignments(xlsxBuffer: Buffer): Promise<AssignmentsImportResult> {
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
    const [allCrew, allVessels, allPorts]: [any[], any[], any[]] = await Promise.all([
      db.select().from(crewMembersV2).where(eq(crewMembersV2.isDeleted, false)),
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
    const rowErrorsMap = new Map<number, string[]>(); // rowNumber -> array of validation errors

    for (let rowNumber = 2; rowNumber <= assignmentsSheet.rowCount; rowNumber++) {
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

      // Strict Mandatory Fields Validation
      if (!employeeId) errors.push("Employee ID is missing");
      if (!vesselName && !imo) errors.push("Vessel Name / IMO is missing");
      if (!rank) errors.push("Rank is missing");
      if (!position) errors.push("Position is missing");
      if (!signOnDate) errors.push("Sign On Date is missing");

      // Validate Assignment Type Enum
      const normAssignType = norm(assignmentType);
      if (assignmentType && normAssignType !== "primary" && normAssignType !== "secondary") {
        errors.push(`Assignment Type '${assignmentType}' is invalid (Must be Primary or Secondary)`);
      }

      // Validate Joining Status Enum
      if (joiningStatus) {
        const normStatus = norm(joiningStatus);
        if (normStatus !== "signed on" && normStatus !== "planned" && normStatus !== "in transit") {
          errors.push(`Joining Status '${joiningStatus}' is invalid (Must be Signed On, Planned, or In Transit)`);
        }
      }

      // Validate Date Format
      const parsedSignOn = parseDateStringStrict(signOnDate);
      if (signOnDate && !parsedSignOn) {
        errors.push(`Sign On Date '${signOnDate}' is invalid or unparseable`);
      }

      const parsedReliefDue = parseDateStringStrict(reliefDue);
      if (reliefDue && !parsedReliefDue) {
        errors.push(`Relief Due Date '${reliefDue}' is invalid or unparseable`);
      }

      // Validate Seafarer Existence
      let crew: any = null;
      if (employeeId) {
        crew = crewByEmpIdMap.get(norm(employeeId)) || crewByPassportMap.get(norm(employeeId));
        if (!crew) {
          errors.push(`Seafarer with Employee ID / Passport '${employeeId}' is not registered in system`);
        }
      }

      // Validate Vessel Existence
      const cleanImo = (imo || "").replace(/\D/g, "");
      let vessel: any = (cleanImo ? vesselByImoMap.get(cleanImo) : null) || vesselByNameMap.get(norm(vesselName));
      if (vesselName || imo) {
        if (!vessel) {
          errors.push(`Vessel '${vesselName}' ${imo ? `(IMO: ${imo})` : ""} is not registered in Master Vessels`);
        } else if (!vessel.vesselUuid) {
          errors.push(`Vessel '${vesselName}' is missing a valid system identifier in Master Vessels`);
        }
      }

      // Validate Port of Joining (if provided)
      let joiningPortUuid: string | undefined = undefined;
      if (portOfJoining) {
        joiningPortUuid = portByNameMap.get(norm(portOfJoining));
        if (!joiningPortUuid) {
          errors.push(`Port of Joining '${portOfJoining}' is not registered in Master Ports`);
        }
      }

      if (errors.length > 0) {
        rowErrorsMap.set(rowNumber, errors);
      }

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

    // Check for validation failures -> ALL-OR-NOTHING ROLLBACK & GENERATE ERROR EXCEL
    if (rowErrorsMap.size > 0) {
      for (const [rowNum, errList] of rowErrorsMap.entries()) {
        result.errors.push(`Row ${rowNum}: ${errList.join("; ")}`);
      }
      result.skippedCount = rowsToProcess.length;

      // Highlight failed cells and append "Validation Errors" column in Error Excel
      const errColNum = (assignmentsSheet.columnCount || 13) + 1;
      assignmentsSheet.getCell(1, errColNum).value = "Validation Errors";
      assignmentsSheet.getCell(1, errColNum).font = { bold: true, color: { argb: "991B1B" } };
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

    // PHASE 2: ATOMIC DATABASE COMMIT (All-or-Nothing Transaction)
    await db.transaction(async (tx: any) => {
      for (const item of rowsToProcess) {
        const crew = item.crew;
        const vessel = item.vessel;
        const isPrimary = item.assignmentType === "primary";

        // Auto-compute reliefDue if missing but signOnDate and contractPeriod are present
        let finalReliefDue = item.reliefDue;
        if (!finalReliefDue && item.signOnDate && item.contractPeriod) {
          finalReliefDue = computeReliefDueDate(item.signOnDate, item.contractPeriod);
        }

        const targetPos = item.position || item.rank;
        if (isPrimary) {
          const planningRecords: any[] = await vesselPlanningService.getByVesselUuid(vessel.vesselUuid);
          let matchedSlot: any = planningRecords.find(
            (p: any) =>
              (p.role && norm(p.role) === norm(targetPos)) ||
              norm(p.rank) === norm(targetPos) ||
              norm(p.rank) === norm(item.rank)
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

          await crewAssignmentsService.assignToVessel(crew.crewUuid, vessel.vesselUuid, {
            signOnDate: item.signOnDate || new Date(),
            reliefDue: finalReliefDue || undefined,
            contractPeriod: item.contractPeriod ? String(item.contractPeriod) : undefined,
            assignmentType: "primary",
            isCurrent: true,
            vesselName: vessel.vessel,
            rank: item.rank,
          });

          result.primaryAssignedCount++;
        } else {
          const targetRank = item.relieverRank || item.position || item.rank;
          const planningRecords: any[] = await vesselPlanningService.getByVesselUuid(vessel.vesselUuid);
          let matchedSlot: any = planningRecords.find(
            (p: any) =>
              (p.role && norm(p.role) === norm(targetRank)) ||
              norm(p.rank) === norm(targetRank) ||
              norm(p.rank) === norm(item.rank)
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

          await crewAssignmentsService.assignToVessel(crew.crewUuid, vessel.vesselUuid, {
            signOnDate: item.signOnDate || new Date(),
            reliefDue: finalReliefDue || undefined,
            contractPeriod: item.contractPeriod ? String(item.contractPeriod) : undefined,
            assignmentType: "secondary",
            isCurrent: false,
            vesselName: vessel.vessel,
            rank: item.rank,
          });

          result.secondaryAssignedCount++;
        }
      }
    });

    result.success = true;
  } catch (err: any) {
    const rawMsg = err.message || String(err);
    let userFriendlyMsg = rawMsg;

    if (rawMsg.includes('null value in column "vessel_uuid"')) {
      userFriendlyMsg = "One or more vessels in the uploaded sheet are missing a valid vessel identifier in Master Vessels.";
    } else if (rawMsg.includes('null value in column')) {
      userFriendlyMsg = "Required database information is missing from the uploaded record.";
    } else if (rawMsg.includes("violates not-null constraint")) {
      userFriendlyMsg = "Import aborted: A mandatory field was missing during database save.";
    } else if (rawMsg.includes("violates foreign key constraint")) {
      userFriendlyMsg = "Import aborted: Referenced seafarer, vessel, or port does not exist in master records.";
    } else if (rawMsg.includes("violates unique constraint")) {
      userFriendlyMsg = "Import aborted: A duplicate record already exists in the system.";
    }

    result.errors.push(`Failed to process assignments import: ${userFriendlyMsg}`);
    result.success = false;
  }

  return result;
}
