import ExcelJS from "exceljs";
import { getDb } from "../../db";
import { masterVessels, masterPorts } from "../../../../shared/schema";
import { admCompanyRanksV2, admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import { crewMembersV2, crewSeaService } from "../../../../shared/v2/crew-pool/schema";
import { vesselDraftsService } from "../../admin/services/vesselDraftsService";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import type { VesselCrewListDoc } from "./vesselCrewListParserService";

function norm(str?: string | null): string {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, " ");
}

function cleanString(str?: string | null): string {
  return (str || "").trim();
}

export interface GeneratedWorkbookResult {
  buffer: Buffer;
  summary: {
    totalVessels: number;
    totalCrewEntries: number;
    matchedCrewCount: number;
    notFoundCount: number;
    duplicateCount: number;
    unmatchedRankCount: number;
  };
}

/**
 * Ingest parsed crew list docs from ZIP and generate a downloadable Excel workbook:
 * 1. "Assignments": Employee ID, Vessel Name, IMO, Rank, Sign On Date, Lookup Status, Rank Match Status, etc.
 * 2. "VesselRankHierarchy": Unique Vessel Name, IMO, Rank, Status ("Active")
 * 3. "MasterData": Reference dropdown list for Ports, Assignment Types, and Joining Statuses
 */
export async function generateVesselImportWorkbook(docs: VesselCrewListDoc[]): Promise<GeneratedWorkbookResult> {
  const db = getDb();

  // ── Scope the crew query to names that appear in the parsed documents ───────
  // Loading the full crew table is expensive when thousands of seafarers are
  // registered but only a few dozen appear in the import ZIP.  Instead we
  // collect unique name tokens from the parsed entries and issue one ILIKE
  // query per token pair (firstName OR familyName), which typically reduces
  // the result set by an order of magnitude.
  const docNameTokens = new Set<string>();
  for (const doc of docs) {
    for (const entry of doc.entries || []) {
      const fn = (entry.familyName || "").trim();
      // Use only the first given name token — middle names add noise without
      // improving filter selectivity.
      const gn = (entry.givenNames || "").trim().split(/\s+/)[0];
      if (fn) docNameTokens.add(fn.toLowerCase());
      if (gn) docNameTokens.add(gn.toLowerCase());
    }
  }

  /**
   * Escape LIKE metacharacters so a seafarer name like "O'Brien_Jr" or
   * "Smith%100" is treated as a literal substring, not a wildcard pattern.
   * Uses backslash as the escape character (standard SQL / PostgreSQL default).
   */
  const escapeLikeToken = (token: string): string =>
    token.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  const nameTokenArray = [...docNameTokens].map(escapeLikeToken);

  // Load reference data dynamically from DB
  const [allVessels, allCompanyRanks, availableRanks, allCrew, openSeaServices, allPorts] = await Promise.all([
    db.select().from(masterVessels),
    db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false)),
    db.select().from(admAvailableRanksV2).where(eq(admAvailableRanksV2.isDeleted, false)),
    // Scoped crew query: fetch only crew whose firstName or familyName
    // contains at least one name token from the parsed documents.
    // Falls back to an empty result (not the full table) if docs are empty,
    // so the workbook can still be generated with "NOT FOUND" status for all.
    nameTokenArray.length > 0
      ? db.select().from(crewMembersV2).where(
          and(
            eq(crewMembersV2.isDeleted, false),
            or(
              ...nameTokenArray.flatMap((token) => [
                ilike(crewMembersV2.firstName, `%${token}%`),
                ilike(crewMembersV2.familyName, `%${token}%`),
              ]),
            ),
          ),
        )
      : Promise.resolve([]),
    db.select().from(crewSeaService).where(isNull(crewSeaService.toDate)),
    db.select().from(masterPorts).where(eq(masterPorts.isDeleted, false)),
  ]);

  // Extract unique, sorted master port names (A-Z) for type-ahead search
  const portNamesSet = new Set<string>();
  for (const p of allPorts) {
    const name = cleanString(p.name || p.portName);
    if (name) portNamesSet.add(name);
  }
  const portNames = Array.from(portNamesSet).sort((a, b) => a.localeCompare(b));

  // Company ranks indexed by rankId
  const companyRankByRankIdMap = new Map<string, any>();
  for (const cr of allCompanyRanks) {
    companyRankByRankIdMap.set(cr.rankId, cr);
  }

  // Build dynamic company ranks lookup map from adm_available_ranks_v2 (rank + label) and adm_company_ranks_v2
  const companyRankByNameMap = new Map<string, any>();
  for (const cr of allCompanyRanks) {
    if (cr.rank) companyRankByNameMap.set(norm(cr.rank), cr);
  }
  for (const ar of availableRanks) {
    const targetCompanyRank = companyRankByRankIdMap.get(ar.rankId);
    if (targetCompanyRank) {
      if (ar.rank) companyRankByNameMap.set(norm(ar.rank), targetCompanyRank);
      if (ar.label) companyRankByNameMap.set(norm(ar.label), targetCompanyRank);
    }
  }

  // Build application rank hierarchy sort order map from adm_available_ranks_v2
  const rankSortOrderMap = new Map<string, number>();
  for (const ar of availableRanks) {
    const order = typeof ar.sortOrder === "number" ? ar.sortOrder : 999;
    if (ar.rankId) rankSortOrderMap.set(ar.rankId, order);
    if (ar.name) rankSortOrderMap.set(norm(ar.name), order);
    if (ar.label) rankSortOrderMap.set(norm(ar.label), order);
  }

  const getRankSortPriority = (rankOrRoleName: string): number => {
    const clean = norm(rankOrRoleName);
    const baseClean = clean.replace(/_\d+$/, "");
    if (rankSortOrderMap.has(clean)) return rankSortOrderMap.get(clean)!;
    if (rankSortOrderMap.has(baseClean)) return rankSortOrderMap.get(baseClean)!;
    const companyRank = companyRankByNameMap.get(clean) || companyRankByNameMap.get(baseClean);
    if (companyRank && rankSortOrderMap.has(companyRank.rankId)) {
      return rankSortOrderMap.get(companyRank.rankId)!;
    }
    return 9999;
  };

  // Extract unique base company rank names and position role labels sorted per application hierarchy
  const companyRankNamesSet = new Set<string>();
  const companyRoleLabelsSet = new Set<string>();
  for (const cr of allCompanyRanks) {
    if (!cr.isRoleRow && cr.rank) {
      companyRankNamesSet.add(cleanString(cr.rank));
    } else if (cr.rank && !cr.role) {
      companyRankNamesSet.add(cleanString(cr.rank));
    }
    if (cr.role) {
      companyRoleLabelsSet.add(cleanString(cr.role));
    }
  }

  const companyRankNames = Array.from(companyRankNamesSet).sort((a, b) => {
    const orderA = getRankSortPriority(a);
    const orderB = getRankSortPriority(b);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  const companyRoleLabels = Array.from(companyRoleLabelsSet).sort((a, b) => {
    const orderA = getRankSortPriority(a);
    const orderB = getRankSortPriority(b);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  const assignmentTypes = ["Primary", "Secondary"];
  const joiningStatuses = ["Signed On", "Planned", "In Transit"];
  const hierarchyStatuses = ["Active", "Not Required"];

  // Vessel lookup by IMO (digits only) or Name
  const vesselByImoMap = new Map<string, any>();
  const vesselByNameMap = new Map<string, any>();
  for (const v of allVessels) {
    if (v.imo) vesselByImoMap.set(v.imo.replace(/\D/g, ""), v);
    if (v.vessel) vesselByNameMap.set(norm(v.vessel), v);
  }

  // Multi-index crew lookup maps supporting First + Middle name variations
  const crewByFnLnDobMap = new Map<string, any[]>();
  const crewByLnFnDobMap = new Map<string, any[]>();
  const crewByFullNameMap = new Map<string, any[]>();
  const crewByFnLnMap = new Map<string, any[]>(); // Fallback without DOB constraint
  const crewByEmpIdMap = new Map<string, any>();
  const crewByPassportMap = new Map<string, any>();
  const seaServiceMap = new Map<string, { vesselName: string; fromDate: string }>();

  const addMap = (map: Map<string, any[]>, key: string, c: any) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  };

  for (const c of allCrew) {
    const fn = norm(c.firstName);
    const mn = norm(c.middleName);
    const ln = norm(c.familyName);
    const dob = c.dob ? String(c.dob).slice(0, 10) : "";

    const fnMn = [fn, mn].filter(Boolean).join(" ");
    const empId = cleanString(c.employeeId || c.empNo);
    const item = { ...c, dob, employeeId: empId };

    if (empId) crewByEmpIdMap.set(norm(empId), item);

    addMap(crewByFnLnDobMap, `${fnMn}|${ln}|${dob}`, item);
    if (fn && fn !== fnMn) addMap(crewByFnLnDobMap, `${fn}|${ln}|${dob}`, item);

    addMap(crewByLnFnDobMap, `${ln}|${fnMn}|${dob}`, item);
    if (fn && fn !== fnMn) addMap(crewByLnFnDobMap, `${ln}|${fn}|${dob}`, item);

    addMap(crewByFullNameMap, `${fnMn} ${ln}`, item);
    addMap(crewByFullNameMap, `${ln} ${fnMn}`, item);
    if (fn && fn !== fnMn) {
      addMap(crewByFullNameMap, `${fn} ${ln}`, item);
      addMap(crewByFullNameMap, `${ln} ${fn}`, item);
    }

    addMap(crewByFnLnMap, `${fnMn}|${ln}`, item);
    addMap(crewByFnLnMap, `${ln}|${fnMn}`, item);
    if (fn && fn !== fnMn) {
      addMap(crewByFnLnMap, `${fn}|${ln}`, item);
      addMap(crewByFnLnMap, `${ln}|${fn}`, item);
    }
  }

  for (const s of openSeaServices) {
    if (s.crewUuid && !seaServiceMap.has(s.crewUuid)) {
      seaServiceMap.set(s.crewUuid, {
        vesselName: s.vesselName || "",
        fromDate: s.fromDate || "",
      });
    }
  }

  let totalCrewEntries = 0;
  let matchedCrewCount = 0;
  let notFoundCount = 0;
  let duplicateCount = 0;
  let unmatchedRankCount = 0;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAIL Crewing Platform";

  // Sheet 1: Comprehensive Client Instructions & Examples
  const instructionsSheet = workbook.addWorksheet("Instructions", {
    views: [{ showGridLines: true }],
  });
  const assignmentsSheet = workbook.addWorksheet("Assignments");
  const hierarchySheet = workbook.addWorksheet("VesselRankHierarchy");
  const masterDataSheet = workbook.addWorksheet("MasterData");

  instructionsSheet.columns = [
    { key: "colA", width: 48 },
    { key: "colB", width: 26 },
    { key: "colC", width: 14 },
    { key: "colD", width: 18 },
    { key: "colE", width: 18 },
    { key: "colF", width: 16 },
    { key: "colG", width: 18 },
    { key: "colH", width: 16 },
    { key: "colI", width: 20 },
    { key: "colJ", width: 18 },
    { key: "colK", width: 16 },
    { key: "colL", width: 18 },
    { key: "colM", width: 38 },
  ];

  // Helper to add styled single-column A title / section header / instruction items
  const addInstrTitle = (text: string) => {
    const row = instructionsSheet.addRow([text]);
    row.height = 32;
    const cell = row.getCell(1);
    cell.font = { bold: true, size: 14, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  };

  const addInstrSection = (text: string) => {
    const row = instructionsSheet.addRow([text]);
    row.height = 24;
    const cell = row.getCell(1);
    cell.font = { bold: true, size: 11, color: { argb: "1E293B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  };

  const addInstrItem = (text: string) => {
    const row = instructionsSheet.addRow([text]);
    row.height = 20;
    const cell = row.getCell(1);
    cell.font = { size: 10, color: { argb: "0F172A" } };
    cell.alignment = { vertical: "middle" };
  };

  addInstrTitle("SAIL CREW PLANNING & ASSIGNMENT IMPORT GUIDE");
  addInstrItem("IMPORTANT: The system has automatically pre-populated and matched all existing crew assignments and vessel rank structures from SAIL records.");
  addInstrItem("CLIENT ACTION: Review and verify the pre-filled data. ONLY update or add rows if a seafarer is missing, an unmatched rank/record needs correction, or a new reliever is assigned.");
  instructionsSheet.addRow([]);

  addInstrSection("1. OVERVIEW OF WORKSHEETS IN THIS WORKBOOK");
  addInstrItem("• Sheet 1 (Instructions): User review guide, field definitions, and practical examples (Reference only).");
  addInstrItem("• Sheet 2 (Assignments): Pre-populated crew list for primary on-board crew and secondary (reliever) assignments.");
  addInstrItem("• Sheet 3 (VesselRankHierarchy): Pre-populated vessel position slot configuration (Active vs Not Required).");
  addInstrItem("• Sheet 4 (MasterData): System reference lists (Company Ranks, Positions, Ports, Statuses). Do NOT modify.");
  instructionsSheet.addRow([]);

  addInstrSection("2. HOW TO REVIEW & CONFIGURE 'VesselRankHierarchy' (STAGE 1)");
  addInstrItem("• Pre-Filled Data: All standard vessel positions are already populated based on company manning setup.");
  addInstrItem("• Rank (Column C): Displays base company rank (e.g., Master, Chief Officer, Able Seaman).");
  addInstrItem("• Position (Column D): Single rank uses base rank (Master); multi-slot ranks use position roles (e.g. AB_1, AB_2, OS_1).");
  addInstrItem("• Status: Active (Col E): Keeps/creates the active planning slot in Vessel Planning.");
  addInstrItem("• Status: Not Required (Col E): If a position is not carried on this vessel (e.g. vessel carries only 2 ABs and does NOT carry AB_3), select 'Not Required'. No empty slot will be created. Active crew on board are safely preserved.");
  instructionsSheet.addRow([]);

  addInstrSection("3. HOW TO REVIEW & UPDATE 'Assignments' (STAGE 2)");
  addInstrItem("• Review Mode: Seafarers with 'OK' status are already matched. Only update rows marked as 'NOT FOUND' or 'UNMATCHED'.");
  addInstrItem("• Employee ID (Column A): Seafarer Employee ID or Passport number registered in SAIL.");
  addInstrItem("• Vessel Name & IMO (Col B/C): Target vessel name and IMO number.");
  addInstrItem("• Rank & Position (Col D/E): Select Rank and Position role from dropdowns if corrections are needed.");
  addInstrItem("• Sign On Date (Column F): Enter date in YYYY-MM-DD format (e.g., 2026-04-15).");
  addInstrItem("• Contract Period (Column G): Contract duration in months (e.g. 6 or 9).");
  addInstrItem("• Relief Due Date (Column H): Auto-calculated by Excel formula =IF(AND(F<>'', G<>''), EDATE(F, G), '').");
  addInstrItem("• Port of Joining (Column I): Select from the alphabetical port dropdown list.");
  addInstrItem("• Assignment Type: Primary: Current on-board incumbent crew or planned primary crew.");
  addInstrItem("• Assignment Type: Secondary: Reliever crew member. The entire row will highlight YELLOW automatically.");
  addInstrItem("• Reliever Rank (Column L): When Assignment Type is 'Secondary', select the specific position being relieved (e.g. AB_2, Master).");
  instructionsSheet.addRow([]);

  addInstrSection("4. PRACTICAL EXAMPLES (WITH DUMMY VESSELS)");

  // Example header for Assignments (Shifted to Column B)
  instructionsSheet.addRow(["", "EXAMPLE A: 'Assignments' Sheet Data Layout"]);
  const exAssignHead = instructionsSheet.addRow([
    "",
    "Employee ID", "Vessel Name", "IMO", "Rank", "Position", "Sign On Date",
    "Contract Period", "Relief Due Date", "Port of Joining", "Assignment Type",
    "Joining Status", "Reliever Rank", "Remarks / Description"
  ]);
  exAssignHead.height = 22;
  exAssignHead.eachCell((c, colNumber) => {
    if (colNumber >= 2) {
      c.font = { bold: true, size: 9 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "CBD5E1" } };
      c.alignment = { vertical: "middle", horizontal: "center" };
    }
  });

  const exRow1 = instructionsSheet.addRow([
    "",
    "EMP1001", "M/V Atlantic Pioneer", "9123456", "Master", "Master", "2026-01-10",
    6, "2026-07-10", "Singapore", "Primary", "Signed On", "", "Primary Master currently on board"
  ]);
  const exRow2 = instructionsSheet.addRow([
    "",
    "EMP1002", "M/V Atlantic Pioneer", "9123456", "Able Seaman", "AB_1", "2026-02-01",
    9, "2026-11-01", "Rotterdam", "Primary", "Signed On", "", "Primary AB occupying Slot 1"
  ]);
  const exRow3 = instructionsSheet.addRow([
    "",
    "EMP1003", "M/V Atlantic Pioneer", "9123456", "Able Seaman", "AB_2", "2026-03-15",
    9, "2026-12-15", "Houston", "Primary", "Signed On", "", "Primary AB occupying Slot 2"
  ]);
  const exRow4 = instructionsSheet.addRow([
    "",
    "EMP1004", "M/V Atlantic Pioneer", "9123456", "Able Seaman", "AB_2", "2026-12-01",
    9, "2027-09-01", "Houston", "Secondary", "Planned", "AB_2", "RELIEVER for AB_2 (Yellow row)"
  ]);

  // Highlight Secondary example row cells (from Column B onwards) in yellow
  exRow4.eachCell((c, colNumber) => {
    if (colNumber >= 2) {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF08A" } };
    }
  });

  instructionsSheet.addRow([]);
  instructionsSheet.addRow(["", "EXAMPLE B: 'VesselRankHierarchy' Sheet Data Layout"]);
  const exHierHead = instructionsSheet.addRow([
    "",
    "Vessel Name", "IMO", "Rank", "Position", "Status", "", "", "", "", "", "", "Description / Manning Rule"
  ]);
  exHierHead.height = 22;
  exHierHead.eachCell((c, colNumber) => {
    if (colNumber >= 2) {
      c.font = { bold: true, size: 9 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "CBD5E1" } };
      c.alignment = { vertical: "middle", horizontal: "center" };
    }
  });

  instructionsSheet.addRow(["", "M/V Atlantic Pioneer", "9123456", "Master", "Master", "Active", "", "", "", "", "", "", "Active single-slot Master"]);
  instructionsSheet.addRow(["", "M/V Atlantic Pioneer", "9123456", "Able Seaman", "AB_1", "Active", "", "", "", "", "", "", "Active Able Seaman Slot 1"]);
  instructionsSheet.addRow(["", "M/V Atlantic Pioneer", "9123456", "Able Seaman", "AB_2", "Active", "", "", "", "", "", "", "Active Able Seaman Slot 2"]);
  instructionsSheet.addRow(["", "M/V Atlantic Pioneer", "9123456", "Able Seaman", "AB_3", "Not Required", "", "", "", "", "", "", "NOT REQUIRED (Vessel carries only 2 ABs; no slot created)"]);

  instructionsSheet.addRow([]);
  addInstrSection("5. IMPORTANT RULES FOR CLEAN IMPORT");
  addInstrItem("• Do Not Alter Headers: Keep column headers and worksheet tab names unchanged.");
  addInstrItem("• Date Standard: Enter dates in YYYY-MM-DD format only.");
  addInstrItem("• All-or-Nothing Validation: If any required value is invalid, an Error Excel will be returned highlighting issues in red.");

  assignmentsSheet.columns = [
    { header: "Employee ID", key: "employeeId", width: 16 },
    { header: "Vessel Name", key: "vesselName", width: 22 },
    { header: "IMO", key: "imo", width: 14 },
    { header: "Rank", key: "rank", width: 18 },
    { header: "Position", key: "position", width: 18 },
    { header: "Sign On Date", key: "signOnDate", width: 14, style: { numFmt: "yyyy-mm-dd" } },
    { header: "Contract Period (Months)", key: "contractPeriod", width: 22 },
    { header: "Relief Due Date", key: "reliefDue", width: 16, style: { numFmt: "yyyy-mm-dd" } },
    { header: "Port of Joining", key: "portOfJoining", width: 18 },
    { header: "Assignment Type", key: "assignmentType", width: 16 },
    { header: "Joining Status", key: "joiningStatus", width: 16 },
    { header: "Reliever Rank", key: "relieverRank", width: 16 },
    { header: "Lookup Status", key: "lookupStatus", width: 28 },
    { header: "Rank Match Status", key: "rankMatchStatus", width: 18 },
  ];

  hierarchySheet.columns = [
    { header: "Vessel Name", key: "vesselName", width: 22 },
    { header: "IMO", key: "imo", width: 14 },
    { header: "Rank", key: "rank", width: 18 },
    { header: "Position", key: "position", width: 18 },
    { header: "Status", key: "status", width: 14 },
  ];

  masterDataSheet.columns = [
    { header: "Company Rank", key: "rankName", width: 24 },
    { header: "Position Label", key: "positionLabel", width: 20 },
    { header: "Port Name", key: "portName", width: 26 },
    { header: "Assignment Type", key: "assignmentType", width: 20 },
    { header: "Joining Status", key: "joiningStatus", width: 20 },
    { header: "Hierarchy Status", key: "hierarchyStatus", width: 20 },
  ];

  // Populate MasterData sheet values
  const maxMasterRows = Math.max(
    companyRankNames.length,
    companyRoleLabels.length,
    portNames.length,
    assignmentTypes.length,
    joiningStatuses.length,
    hierarchyStatuses.length
  );
  for (let r = 0; r < maxMasterRows; r++) {
    masterDataSheet.addRow({
      rankName: companyRankNames[r] || "",
      positionLabel: companyRoleLabels[r] || "",
      portName: portNames[r] || "",
      assignmentType: assignmentTypes[r] || "",
      joiningStatus: joiningStatuses[r] || "",
      hierarchyStatus: hierarchyStatuses[r] || "",
    });
  }

  const mandatoryAssignmentsKeys = new Set([
    "employeeId",
    "vesselName",
    "rank",
    "position",
    "signOnDate",
    "assignmentType",
  ]);

  const mandatoryHierarchyKeys = new Set([
    "vesselName",
    "rank",
    "position",
  ]);

  // Style Assignments Sheet Headers (Yellow for mandatory fields, Grey for optional fields)
  const assignmentsHeaderRow = assignmentsSheet.getRow(1);
  assignmentsHeaderRow.height = 26;
  assignmentsSheet.columns.forEach((col, idx) => {
    const cell = assignmentsHeaderRow.getCell(idx + 1);
    const isMandatory = mandatoryAssignmentsKeys.has(String(col.key || ""));
    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isMandatory ? "FEF08A" : "E2E8F0" }, // Yellow for mandatory, Grey for optional
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Style Hierarchy Sheet Headers (Yellow for mandatory fields, Grey for optional fields)
  const hierarchyHeaderRow = hierarchySheet.getRow(1);
  hierarchyHeaderRow.height = 26;
  hierarchySheet.columns.forEach((col, idx) => {
    const cell = hierarchyHeaderRow.getCell(idx + 1);
    const isMandatory = mandatoryHierarchyKeys.has(String(col.key || ""));
    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isMandatory ? "FEF08A" : "E2E8F0" }, // Yellow for mandatory, Grey for optional
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Style MasterData Sheet Headers
  const masterHeaderRow = masterDataSheet.getRow(1);
  masterHeaderRow.height = 26;
  masterDataSheet.columns.forEach((_, idx) => {
    const cell = masterHeaderRow.getCell(idx + 1);
    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "E2E8F0" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const writtenHierarchyVessels = new Set<string>();
  const vesselRankCountsMap = new Map<string, Map<string, number>>();
  const vesselRankSeqMap = new Map<string, number>();

  for (const doc of docs) {
    if (!doc.entries || doc.entries.length === 0) continue;

    // Track assigned crew UUIDs within this document to prevent multi-instance role collisions (AB_1 vs AB_2)
    const assignedCrewUuidsInDoc = new Set<string>();

    // Match Vessel in system by IMO digits or Name
    const cleanDocImo = (doc.imo || "").replace(/\D/g, "");
    const matchedVessel = (cleanDocImo ? vesselByImoMap.get(cleanDocImo) : null) || vesselByNameMap.get(norm(doc.vesselName));
    const vesselUuid = matchedVessel?.vesselUuid || null;
    const vesselName = cleanString(matchedVessel?.vessel || doc.vesselName || "Unknown Vessel");
    const imo = doc.imo || matchedVessel?.imo || "";

    const vesselKey = cleanDocImo || norm(vesselName);
    const shouldAddHierarchy = !writtenHierarchyVessels.has(vesselKey);
    if (shouldAddHierarchy) {
      writtenHierarchyVessels.add(vesselKey);
    }

    if (vesselUuid) {
      if (!vesselRankCountsMap.has(vesselUuid)) {
        vesselRankCountsMap.set(vesselUuid, new Map<string, number>());
      }
    }

    const rankCounts = new Map<string, number>();
    doc.entries.forEach((e: any) => {
      const key = norm(e.rankOrRating);
      rankCounts.set(key, (rankCounts.get(key) || 0) + 1);

      if (vesselUuid) {
        const vMap = vesselRankCountsMap.get(vesselUuid)!;
        vMap.set(key, Math.max(vMap.get(key) || 0, rankCounts.get(key)!));
      }
    });

    const rankInstanceCounters = new Map<string, number>();
    const vesselActiveRanksSet = new Set<string>();

    for (const entry of doc.entries) {
      totalCrewEntries++;
      const rawRank = cleanString(entry.rankOrRating);
      const baseRank = rawRank.replace(/_\d+$/, "");
      const rankKey = norm(baseRank);
      vesselActiveRanksSet.add(rankKey);

      const companyRank = companyRankByNameMap.get(rankKey) || companyRankByNameMap.get(norm(rawRank));
      const isRankMatched = !!companyRank;
      if (!isRankMatched) {
        unmatchedRankCount++;
      }

      const displayRank = companyRank?.rank || baseRank; // Always base rank name (e.g. Master, AB, Deck Cadet)

      const count = rankCounts.get(norm(rawRank)) || rankCounts.get(rankKey) || 1;
      let positionValue = companyRank?.role || baseRank;
      if (count > 1) {
        const nextNum = (rankInstanceCounters.get(rankKey) || 0) + 1;
        rankInstanceCounters.set(rankKey, nextNum);
        const roleBase = (companyRank?.role || baseRank).replace(/_\d+$/, "");
        positionValue = `${roleBase}_${nextNum}`;
      } else {
        positionValue = positionValue.replace(/_\d+$/, "");
      }

      // Multi-strategy candidate crew lookup
      const gName = norm(entry.givenNames);
      const fName = norm(entry.familyName);
      const dob = entry.dob || "";

      let candidates = crewByFnLnDobMap.get(`${gName}|${fName}|${dob}`) || [];
      if (candidates.length === 0) {
        candidates = crewByLnFnDobMap.get(`${fName}|${gName}|${dob}`) || [];
      }
      if (candidates.length === 0) {
        candidates = crewByFullNameMap.get(`${gName} ${fName}`) || crewByFullNameMap.get(`${fName} ${gName}`) || [];
      }
      if (candidates.length === 0) {
        // Fallback matching without DOB constraint if DOB is omitted or mismatched
        candidates = crewByFnLnMap.get(`${gName}|${fName}`) || crewByFnLnMap.get(`${fName}|${gName}`) || [];
      }

      // Filter out seafarers already assigned to previous role instances (e.g. AB_1) in this document
      const unassignedCandidates = candidates.filter((c: any) => !assignedCrewUuidsInDoc.has(c.crewUuid));

      let selectedCrew: any = null;
      let lookupStatus = "NOT FOUND";

      if (unassignedCandidates.length === 1) {
        selectedCrew = unassignedCandidates[0];
        lookupStatus = "OK";
        matchedCrewCount++;
      } else if (unassignedCandidates.length > 1) {
        // Multiple unassigned candidates — cannot safely auto-select; flag for manual review
        lookupStatus = `AMBIGUOUS (${unassignedCandidates.length} matches)`;
        duplicateCount++;
      } else if (candidates.length > 0) {
        // All candidate matches were already assigned in this document
        lookupStatus = "DUPLICATE";
        duplicateCount++;
      } else {
        notFoundCount++;
      }

      let employeeId = "";
      let crewUuid = "";
      let signOnDate = "";

      if (selectedCrew) {
        employeeId = selectedCrew.employeeId || selectedCrew.empNo || "";
        crewUuid = selectedCrew.crewUuid;
        assignedCrewUuidsInDoc.add(crewUuid);

        const activeService = seaServiceMap.get(crewUuid);
        if (activeService) {
          const activeVesselNorm = norm(activeService.vesselName);
          const currentVesselNorm = norm(vesselName);

          if (activeVesselNorm && activeVesselNorm !== currentVesselNorm) {
            lookupStatus = `Signed on ${activeService.vesselName}`;
            signOnDate = "";
          } else {
            signOnDate = activeService.fromDate || "";
          }
        }
      }

      const addedRow = assignmentsSheet.addRow({
        employeeId,
        vesselName,
        imo,
        rank: displayRank,
        position: positionValue,
        signOnDate,
        contractPeriod: "",
        reliefDue: "",
        portOfJoining: doc.portOfJoining || "",
        assignmentType: "Primary",
        isCurrent: "Yes",
        joiningStatus: "Signed On",
        relieverRank: "",
        lookupStatus,
        rankMatchStatus: isRankMatched ? "OK" : "UNMATCHED",
      });

      const rNum = addedRow.number;

      // Highlight AMBIGUOUS rows in light orange to draw attention for manual review
      if (lookupStatus.startsWith("AMBIGUOUS")) {
        for (let col = 1; col <= 14; col++) {
          addedRow.getCell(col).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FED7AA" }, // Light orange (Tailwind orange-200)
          };
        }
      }

      // Format Date Cells (Col 6: Sign On Date, Col 8: Relief Due Date)
      addedRow.getCell(6).numFmt = "yyyy-mm-dd";
      addedRow.getCell(8).numFmt = "yyyy-mm-dd";

      // Col 4 (D): Rank dropdown pointing to MasterData!$A$2:$A${rankCount+1}
      const rankCount = Math.max(1, companyRankNames.length);
      addedRow.getCell(4).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`MasterData!$A$2:$A$${rankCount + 1}`],
        showErrorMessage: true,
        errorTitle: "Invalid Rank",
        error: "Please select a rank from the company ranks list",
      };

      // Col 5 (E): Position dropdown pointing to MasterData!$B$2:$B${roleCount+1}
      const roleCount = Math.max(1, companyRoleLabels.length);
      addedRow.getCell(5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`MasterData!$B$2:$B$${roleCount + 1}`],
        showErrorMessage: true,
        errorTitle: "Invalid Position",
        error: "Please select a position label from the list",
      };

      // Col 8 (H): Relief Due Date formula EDATE(SignOnDate Col F, ContractPeriod Col G)
      addedRow.getCell(8).value = {
        formula: `IF(AND(F${rNum}<>"", G${rNum}<>""), EDATE(F${rNum}, G${rNum}), "")`,
      };

      // Col 9 (I): Port of Joining dropdown pointing to MasterData!$C$2:$C${portCount+1}
      const portCount = Math.max(1, portNames.length);
      addedRow.getCell(9).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`MasterData!$C$2:$C$${portCount + 1}`],
        showErrorMessage: true,
        errorTitle: "Invalid Port",
        error: "Please select a port from the dropdown list",
      };

      // Col 10 (J): Assignment Type dropdown pointing to MasterData!$D$2:$D$3
      addedRow.getCell(10).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ["MasterData!$D$2:$D$3"],
        showErrorMessage: true,
        errorTitle: "Invalid Assignment Type",
        error: "Please select Primary or Secondary",
      };

      // Col 11 (K): Joining Status dropdown pointing to MasterData!$E$2:$E$4
      addedRow.getCell(11).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["MasterData!$E$2:$E$4"],
        showErrorMessage: true,
        errorTitle: "Invalid Joining Status",
        error: "Please select Signed On, Planned, or In Transit",
      };

      // Col 12 (L): Reliever Rank Position dropdown pointing to MasterData!$B$2:$B${roleCount+1}
      addedRow.getCell(12).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`MasterData!$B$2:$B$${roleCount + 1}`],
        showErrorMessage: true,
        errorTitle: "Invalid Reliever Position",
        error: "Please select a reliever position from the list",
      };

      if (shouldAddHierarchy) {
        const addedHRow = hierarchySheet.addRow({
          vesselName,
          imo,
          rank: displayRank,
          position: positionValue,
          status: "Active",
        });

        // Col 3 (C): Rank dropdown pointing to MasterData!$A$2:$A${rankCount+1}
        const rankCount = Math.max(1, companyRankNames.length);
        addedHRow.getCell(3).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`MasterData!$A$2:$A$${rankCount + 1}`],
          showErrorMessage: true,
          errorTitle: "Invalid Rank",
          error: "Please select a rank from the company ranks list",
        };

        // Col 4 (D): Position dropdown pointing to MasterData!$B$2:$B${roleCount+1}
        const roleCount = Math.max(1, companyRoleLabels.length);
        addedHRow.getCell(4).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`MasterData!$B$2:$B$${roleCount + 1}`],
          showErrorMessage: true,
          errorTitle: "Invalid Position",
          error: "Please select a position label from the list",
        };

        // Col 5 (E): Status dropdown pointing to MasterData!$F$2:$F$3
        addedHRow.getCell(5).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: ["MasterData!$F$2:$F$3"],
          showErrorMessage: true,
          errorTitle: "Invalid Status",
          error: "Please select Active or Not Required",
        };
      }
    }
  }

  // Add Conditional Formatting to dynamically highlight entire row with yellow when Assignment Type (Col J) is Secondary
  const maxAssignmentRows = Math.max(100, assignmentsSheet.rowCount + 50);
  assignmentsSheet.addConditionalFormatting({
    ref: `A2:N${maxAssignmentRows}`,
    rules: [
      {
        priority: 1,
        type: "expression",
        formulae: ['TRIM(UPPER($J2))="SECONDARY"'],
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: "FEF08A" },
            fgColor: { argb: "FEF08A" },
          },
        },
      },
    ],
  });

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    buffer,
    summary: {
      totalVessels: docs.length,
      totalCrewEntries,
      matchedCrewCount,
      notFoundCount,
      duplicateCount,
      unmatchedRankCount,
    },
  };
}
