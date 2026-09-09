import ExcelJS from "exceljs";
import { getDb } from "../../db";
import { masterVessels, masterPorts } from "../../../../shared/schema";
import { admCompanyRanksV2, admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import { crewMembersV2, crewSeaService } from "../../../../shared/v2/crew-pool/schema";
import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import type { VesselCrewListDoc } from "./vesselCrewListParserService";

function norm(str?: string | null): string {
  return (str || "")
    .normalize("NFC")   // unify precomposed vs decomposed Unicode forms (e.g. é vs e+combining)
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, " ");
}

function cleanString(str?: string | null): string {
  return (str || "").trim();
}

interface ResolvedRankPosition {
  displayRank: string;
  position: string;
  isRankMatched: boolean;
}

/**
 * Resolve each raw rank string (in the order given) to its display Rank and
 * Position, using the company's Admin-defined position slots — the
 * `Master_1` / `Master_2`-style role rows created via the "Multiple" button
 * in Rank Admin (admCompanyRanksV2 rows with isRoleRow=true, linked back to
 * their base rank row via originalRankId === baseRow.id).
 *
 * A rank only gets numbered positions if Admin has defined 2+ of these role
 * rows for it; otherwise every crew member of that rank gets the plain rank
 * name, regardless of how many are on the vessel.
 */
function resolveRankPositions(
  rawRanks: string[],
  allCompanyRanks: any[],
): ResolvedRankPosition[] {
  const baseRankByNameMap = new Map<string, any>();
  for (const cr of allCompanyRanks) {
    if (!cr.isRoleRow && cr.rank) {
      baseRankByNameMap.set(norm(cr.rank), cr);
    }
  }

  const roleRowsByBaseId = new Map<string, any[]>();
  for (const cr of allCompanyRanks) {
    if (cr.isRoleRow && cr.originalRankId) {
      if (!roleRowsByBaseId.has(cr.originalRankId)) roleRowsByBaseId.set(cr.originalRankId, []);
      roleRowsByBaseId.get(cr.originalRankId)!.push(cr);
    }
  }
  for (const rows of roleRowsByBaseId.values()) {
    rows.sort((a, b) => {
      const na = parseInt(String(a.role || "").split("_").pop() || "0", 10) || 0;
      const nb = parseInt(String(b.role || "").split("_").pop() || "0", 10) || 0;
      return na - nb;
    });
  }

  const instanceCounters = new Map<string, number>();

  return rawRanks.map((rawRankInput) => {
    const rawRank = cleanString(rawRankInput);
    const baseRank = rawRank.replace(/_\d+$/, "");
    const rankKey = norm(baseRank);

    const baseRow = baseRankByNameMap.get(rankKey);
    const displayRank = baseRow?.rank || baseRank;
    const isRankMatched = !!baseRow;

    const roleRows = baseRow ? (roleRowsByBaseId.get(baseRow.id) || []) : [];

    const seenIndex = instanceCounters.get(rankKey) || 0;
    instanceCounters.set(rankKey, seenIndex + 1);

    let position: string;
    if (roleRows.length >= 2) {
      const slot = roleRows[seenIndex];
      position = slot ? cleanString(slot.role) : `${displayRank}_${seenIndex + 1}`;
    } else {
      position = displayRank;
    }

    return { displayRank, position, isRankMatched };
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared scaffold types and private helpers
// ─────────────────────────────────────────────────────────────────────────────

interface RefData {
  allVessels: any[];
  allCompanyRanks: any[];
  availableRanks: any[];
  allPorts: any[];
}

interface WorkbookScaffold {
  workbook: ExcelJS.Workbook;
  assignmentsSheet: ExcelJS.Worksheet;
  hierarchySheet: ExcelJS.Worksheet;
  masterDataSheet: ExcelJS.Worksheet;
  companyRankByNameMap: Map<string, any>;
  companyRankByRankIdMap: Map<string, any>;
  vesselByImoMap: Map<string, any>;
  vesselByNameMap: Map<string, any>;
  companyRankNames: string[];
  companyRoleLabels: string[];
  portNames: string[];
  rankCount: number;
  roleCount: number;
  portCount: number;
  getRankSortPriority: (rankOrRoleName: string) => number;
}

/**
 * Build the shared workbook scaffold: create the workbook, all 4 sheets,
 * Instructions content, column definitions, header styling, and MasterData rows.
 * Both generateVesselImportWorkbook and buildWorkbookFromDb call this.
 */
function buildScaffold(ref: RefData): WorkbookScaffold {
  const { allVessels, allCompanyRanks, availableRanks, allPorts } = ref;

  // ── Port names ──────────────────────────────────────────────────────────────
  const portNamesSet = new Set<string>();
  for (const p of allPorts) {
    const name = cleanString(p.name || p.portName);
    if (name) portNamesSet.add(name);
  }
  const portNames = Array.from(portNamesSet).sort((a, b) => a.localeCompare(b));

  // ── Company rank maps ───────────────────────────────────────────────────────
  const companyRankByRankIdMap = new Map<string, any>();
  for (const cr of allCompanyRanks) {
    companyRankByRankIdMap.set(cr.rankId, cr);
  }

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

  // ── Rank sort order ─────────────────────────────────────────────────────────
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

  // ── Rank and role label lists ───────────────────────────────────────────────
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

  // ── Vessel lookup maps ──────────────────────────────────────────────────────
  const vesselByImoMap = new Map<string, any>();
  const vesselByNameMap = new Map<string, any>();
  for (const v of allVessels) {
    if (v.imoNumber) vesselByImoMap.set(v.imoNumber.replace(/\D/g, ""), v);
    if (v.vessel) vesselByNameMap.set(norm(v.vessel), v);
  }

  // ── Build workbook and sheets ───────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAIL Crewing Platform";

  const instructionsSheet = workbook.addWorksheet("Instructions", {
    views: [{ showGridLines: true }],
  });
  const assignmentsSheet = workbook.addWorksheet("Assignments");
  const hierarchySheet = workbook.addWorksheet("VesselRankHierarchy");
  const masterDataSheet = workbook.addWorksheet("MasterData");

  // ── Instructions sheet columns ──────────────────────────────────────────────
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

  // Suppress unused variable warnings — these rows are intentionally rendered
  void exRow1; void exRow2; void exRow3;

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

  // ── Assignments sheet columns ────────────────────────────────────────────────
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

  // ── VesselRankHierarchy sheet columns ────────────────────────────────────────
  hierarchySheet.columns = [
    { header: "Vessel Name", key: "vesselName", width: 22 },
    { header: "IMO", key: "imo", width: 14 },
    { header: "Rank", key: "rank", width: 18 },
    { header: "Position", key: "position", width: 18 },
    { header: "Status", key: "status", width: 14 },
  ];

  // ── MasterData sheet columns ─────────────────────────────────────────────────
  masterDataSheet.columns = [
    { header: "Company Rank", key: "rankName", width: 24 },
    { header: "Position Label", key: "positionLabel", width: 20 },
    { header: "Port Name", key: "portName", width: 26 },
    { header: "Assignment Type", key: "assignmentType", width: 20 },
    { header: "Joining Status", key: "joiningStatus", width: 20 },
    { header: "Hierarchy Status", key: "hierarchyStatus", width: 20 },
  ];

  // ── Populate MasterData sheet ────────────────────────────────────────────────
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

  // ── Header styling: Assignments ──────────────────────────────────────────────
  const mandatoryAssignmentsKeys = new Set([
    "employeeId", "vesselName", "rank", "position", "signOnDate", "assignmentType",
  ]);
  const assignmentsHeaderRow = assignmentsSheet.getRow(1);
  assignmentsHeaderRow.height = 26;
  assignmentsSheet.columns.forEach((col, idx) => {
    const cell = assignmentsHeaderRow.getCell(idx + 1);
    const isMandatory = mandatoryAssignmentsKeys.has(String(col.key || ""));
    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isMandatory ? "FEF08A" : "E2E8F0" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // ── Header styling: VesselRankHierarchy ──────────────────────────────────────
  const mandatoryHierarchyKeys = new Set(["vesselName", "rank", "position"]);
  const hierarchyHeaderRow = hierarchySheet.getRow(1);
  hierarchyHeaderRow.height = 26;
  hierarchySheet.columns.forEach((col, idx) => {
    const cell = hierarchyHeaderRow.getCell(idx + 1);
    const isMandatory = mandatoryHierarchyKeys.has(String(col.key || ""));
    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isMandatory ? "FEF08A" : "E2E8F0" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // ── Header styling: MasterData ───────────────────────────────────────────────
  const masterHeaderRow = masterDataSheet.getRow(1);
  masterHeaderRow.height = 26;
  masterDataSheet.columns.forEach((_, idx) => {
    const cell = masterHeaderRow.getCell(idx + 1);
    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const rankCount = Math.max(1, companyRankNames.length);
  const roleCount = Math.max(1, companyRoleLabels.length);
  const portCount = Math.max(1, portNames.length);

  return {
    workbook,
    assignmentsSheet,
    hierarchySheet,
    masterDataSheet,
    companyRankByNameMap,
    companyRankByRankIdMap,
    vesselByImoMap,
    vesselByNameMap,
    companyRankNames,
    companyRoleLabels,
    portNames,
    rankCount,
    roleCount,
    portCount,
    getRankSortPriority,
  };
}

/**
 * Append one data row to the Assignments sheet, applying all Excel dropdowns,
 * the Relief Due Date EDATE formula, and optional highlight for AMBIGUOUS rows.
 * Returns the added ExcelJS row.
 */
function appendAssignmentRow(
  scaffold: WorkbookScaffold,
  data: {
    employeeId: string;
    vesselName: string;
    imo: string;
    rank: string;
    position: string;
    signOnDate: string;
    contractPeriod: string | number;
    portOfJoining: string;
    assignmentType: string;
    joiningStatus: string;
    relieverRank: string;
    lookupStatus: string;
    rankMatchStatus: string;
    isAmbiguous?: boolean;
  },
): ExcelJS.Row {
  const { assignmentsSheet, rankCount, roleCount, portCount } = scaffold;

  const addedRow = assignmentsSheet.addRow({
    employeeId: data.employeeId,
    vesselName: data.vesselName,
    imo: data.imo,
    rank: data.rank,
    position: data.position,
    signOnDate: data.signOnDate,
    contractPeriod: data.contractPeriod,
    reliefDue: "",
    portOfJoining: data.portOfJoining,
    assignmentType: data.assignmentType,
    isCurrent: "Yes",
    joiningStatus: data.joiningStatus,
    relieverRank: data.relieverRank,
    lookupStatus: data.lookupStatus,
    rankMatchStatus: data.rankMatchStatus,
  });

  const rNum = addedRow.number;

  // Highlight AMBIGUOUS rows in light orange
  if (data.isAmbiguous) {
    for (let col = 1; col <= 14; col++) {
      addedRow.getCell(col).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FED7AA" },
      };
    }
  }

  // Format date cells
  addedRow.getCell(6).numFmt = "yyyy-mm-dd";
  addedRow.getCell(8).numFmt = "yyyy-mm-dd";

  // Col 4 (D): Rank dropdown
  addedRow.getCell(4).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`MasterData!$A$2:$A$${rankCount + 1}`],
    showErrorMessage: true,
    errorTitle: "Invalid Rank",
    error: "Please select a rank from the company ranks list",
  };

  // Col 5 (E): Position dropdown
  addedRow.getCell(5).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`MasterData!$B$2:$B$${roleCount + 1}`],
    showErrorMessage: true,
    errorTitle: "Invalid Position",
    error: "Please select a position label from the list",
  };

  // Col 8 (H): Relief Due Date EDATE formula
  addedRow.getCell(8).value = {
    formula: `IF(AND(F${rNum}<>"", G${rNum}<>""), EDATE(F${rNum}, G${rNum}), "")`,
  };

  // Col 9 (I): Port of Joining dropdown
  addedRow.getCell(9).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`MasterData!$C$2:$C$${portCount + 1}`],
    showErrorMessage: true,
    errorTitle: "Invalid Port",
    error: "Please select a port from the dropdown list",
  };

  // Col 10 (J): Assignment Type dropdown
  addedRow.getCell(10).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ["MasterData!$D$2:$D$3"],
    showErrorMessage: true,
    errorTitle: "Invalid Assignment Type",
    error: "Please select Primary or Secondary",
  };

  // Col 11 (K): Joining Status dropdown
  addedRow.getCell(11).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ["MasterData!$E$2:$E$4"],
    showErrorMessage: true,
    errorTitle: "Invalid Joining Status",
    error: "Please select Signed On, Planned, or In Transit",
  };

  // Col 12 (L): Reliever Rank dropdown
  addedRow.getCell(12).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`MasterData!$B$2:$B$${roleCount + 1}`],
    showErrorMessage: true,
    errorTitle: "Invalid Reliever Position",
    error: "Please select a reliever position from the list",
  };

  return addedRow;
}

/**
 * Append one data row to the VesselRankHierarchy sheet, applying all dropdowns.
 * Returns the added ExcelJS row.
 */
function appendHierarchyRow(
  scaffold: WorkbookScaffold,
  data: {
    vesselName: string;
    imo: string;
    rank: string;
    position: string;
    status: string;
  },
): ExcelJS.Row {
  const { hierarchySheet, rankCount, roleCount } = scaffold;

  const addedHRow = hierarchySheet.addRow({
    vesselName: data.vesselName,
    imo: data.imo,
    rank: data.rank,
    position: data.position,
    status: data.status,
  });

  // Col 3 (C): Rank dropdown
  addedHRow.getCell(3).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`MasterData!$A$2:$A$${rankCount + 1}`],
    showErrorMessage: true,
    errorTitle: "Invalid Rank",
    error: "Please select a rank from the company ranks list",
  };

  // Col 4 (D): Position dropdown
  addedHRow.getCell(4).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`MasterData!$B$2:$B$${roleCount + 1}`],
    showErrorMessage: true,
    errorTitle: "Invalid Position",
    error: "Please select a position label from the list",
  };

  // Col 5 (E): Status dropdown
  addedHRow.getCell(5).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ["MasterData!$F$2:$F$3"],
    showErrorMessage: true,
    errorTitle: "Invalid Status",
    error: "Please select Active or Not Required",
  };

  return addedHRow;
}

/**
 * Apply Secondary-row conditional formatting to the Assignments sheet.
 * Highlights entire row yellow when Assignment Type (Col J) is "Secondary".
 */
function applyAssignmentsConditionalFormatting(assignmentsSheet: ExcelJS.Worksheet): void {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ingest parsed crew list docs from ZIP and generate a downloadable Excel workbook:
 * 1. "Assignments": Employee ID, Vessel Name, IMO, Rank, Sign On Date, Lookup Status, Rank Match Status, etc.
 * 2. "VesselRankHierarchy": Unique Vessel Name, IMO, Rank, Status ("Active")
 * 3. "MasterData": Reference dropdown list for Ports, Assignment Types, and Joining Statuses
 */
export async function generateVesselImportWorkbook(docs: VesselCrewListDoc[]): Promise<GeneratedWorkbookResult> {
  const db = getDb();

  // ── Scope the crew query to names that appear in the parsed documents ───────
  const docNameTokens = new Set<string>();
  for (const doc of docs) {
    for (const entry of doc.entries || []) {
      const fn = (entry.familyName || "").trim();
      const gn = (entry.givenNames || "").trim().split(/\s+/)[0];
      if (fn) docNameTokens.add(fn.normalize("NFC").toLowerCase());
      if (gn) docNameTokens.add(gn.normalize("NFC").toLowerCase());
    }
  }

  const escapeLikeToken = (token: string): string =>
    token.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  const nameTokenArray = [...docNameTokens].map(escapeLikeToken);

  // Load reference data dynamically from DB
  const [allVessels, allCompanyRanks, availableRanks, allCrew, openSeaServices, allPorts] = await Promise.all([
    db.select().from(masterVessels),
    db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false)),
    db.select().from(admAvailableRanksV2).where(eq(admAvailableRanksV2.isDeleted, false)),
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

  const scaffold = buildScaffold({ allVessels, allCompanyRanks, availableRanks, allPorts });

  // ── Build crew lookup maps ───────────────────────────────────────────────────
  const crewByFnLnDobMap = new Map<string, any[]>();
  const crewByLnFnDobMap = new Map<string, any[]>();
  const crewByFullNameMap = new Map<string, any[]>();
  const crewByFnLnMap = new Map<string, any[]>();
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

  const writtenHierarchyVessels = new Set<string>();

  for (const doc of docs) {
    if (!doc.entries || doc.entries.length === 0) continue;

    const assignedCrewUuidsInDoc = new Set<string>();

    const cleanDocImo = (doc.imo || "").replace(/\D/g, "");
    const matchedVessel =
      (cleanDocImo ? scaffold.vesselByImoMap.get(cleanDocImo) : null) ||
      scaffold.vesselByNameMap.get(norm(doc.vesselName));
    const vesselName = cleanString(matchedVessel?.vessel || doc.vesselName || "Unknown Vessel");
    const imo = doc.imo || matchedVessel?.imoNumber || "";
    const docImoChecksumFailed = doc.imoChecksumFailed === true;

    const vesselKey = cleanDocImo || norm(vesselName);
    const shouldAddHierarchy = !writtenHierarchyVessels.has(vesselKey);
    if (shouldAddHierarchy) writtenHierarchyVessels.add(vesselKey);

    const vesselActiveRanksSet = new Set<string>();

    // Resolve Rank/Position from Admin's defined position slots (not by
    // counting crew occurrences — see resolveRankPositions).
    const resolvedPositions = resolveRankPositions(
      doc.entries.map((e: any) => e.rankOrRating || ""),
      allCompanyRanks,
    );

    for (let entryIdx = 0; entryIdx < doc.entries.length; entryIdx++) {
      const entry = doc.entries[entryIdx];
      totalCrewEntries++;
      const rankKey = norm(cleanString(entry.rankOrRating).replace(/_\d+$/, ""));
      vesselActiveRanksSet.add(rankKey);

      const { displayRank, position: positionValue, isRankMatched } = resolvedPositions[entryIdx];
      if (!isRankMatched) unmatchedRankCount++;

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
        candidates = crewByFnLnMap.get(`${gName}|${fName}`) || crewByFnLnMap.get(`${fName}|${gName}`) || [];
      }

      const unassignedCandidates = candidates.filter((c: any) => !assignedCrewUuidsInDoc.has(c.crewUuid));

      let selectedCrew: any = null;
      let lookupStatus = "NOT FOUND";

      if (unassignedCandidates.length === 1) {
        selectedCrew = unassignedCandidates[0];
        lookupStatus = "OK";
        matchedCrewCount++;
      } else if (unassignedCandidates.length > 1) {
        lookupStatus = `AMBIGUOUS (${unassignedCandidates.length} matches)`;
        duplicateCount++;
      } else if (candidates.length > 0) {
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

      if (docImoChecksumFailed) lookupStatus += " / IMO_CHECKSUM_FAIL";
      if ((entry as any).dobStatus === "DOB_AMBIGUOUS") lookupStatus += " / DOB_AMBIGUOUS";

      appendAssignmentRow(scaffold, {
        employeeId,
        vesselName,
        imo,
        rank: displayRank,
        position: positionValue,
        signOnDate,
        contractPeriod: "",
        portOfJoining: doc.portOfJoining || "",
        assignmentType: "Primary",
        joiningStatus: "Signed On",
        relieverRank: "",
        lookupStatus,
        rankMatchStatus: isRankMatched ? "OK" : "UNMATCHED",
        isAmbiguous: lookupStatus.startsWith("AMBIGUOUS"),
      });

      if (shouldAddHierarchy) {
        appendHierarchyRow(scaffold, {
          vesselName,
          imo,
          rank: displayRank,
          position: positionValue,
          status: "Active",
        });
      }
    }
  }

  applyAssignmentsConditionalFormatting(scaffold.assignmentsSheet);

  const buffer = Buffer.from(await scaffold.workbook.xlsx.writeBuffer());

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

/**
 * Build the vessel import workbook directly from the database.
 *
 * Queries crewSeaService WHERE serviceType = 'Company' AND toDate IS NULL,
 * joins masterVessels for IMO and crewMembersV2 for empNo.
 * All Assignments rows get Lookup Status = "OK" — no name matching needed
 * because the crew are already confirmed in the DB.
 *
 * The workbook structure (4 sheets, columns, dropdowns, conditional formatting)
 * is byte-for-byte identical to generateVesselImportWorkbook() output.
 */
export async function buildWorkbookFromDb(): Promise<GeneratedWorkbookResult> {
  const db = getDb();

  // Load reference data + open company sea service records in parallel
  const [allVessels, allCompanyRanks, availableRanks, allPorts, rawSeaServices] = await Promise.all([
    db.select().from(masterVessels),
    db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false)),
    db.select().from(admAvailableRanksV2).where(eq(admAvailableRanksV2.isDeleted, false)),
    db.select().from(masterPorts).where(eq(masterPorts.isDeleted, false)),
    db.select().from(crewSeaService).where(
      and(
        eq(crewSeaService.serviceType, "company"),
        isNull(crewSeaService.toDate),
        eq(crewSeaService.isDeleted, false),
      )
    ),
  ]);

  // Load crewMembersV2 for empNo — only the crew present in open sea service
  const crewUuidSet = new Set<string>();
  for (const s of rawSeaServices) {
    if (s.crewUuid) crewUuidSet.add(s.crewUuid);
  }
  const crewUuidsInService: string[] = Array.from(crewUuidSet);

  const crewRows: { crewUuid: string; empNo: string; employeeId: string | null }[] =
    crewUuidsInService.length > 0
      ? await db
          .select({
            crewUuid: crewMembersV2.crewUuid,
            empNo: crewMembersV2.empNo,
            employeeId: crewMembersV2.employeeId,
          })
          .from(crewMembersV2)
          .where(
            and(
              eq(crewMembersV2.isDeleted, false),
              inArray(crewMembersV2.crewUuid, crewUuidsInService),
            )
          )
      : [];

  // Build employee ID lookup map: crewUuid → employeeId || empNo
  // Stage 2 resolves either field; prefer employeeId when populated.
  const empIdByCrewUuid = new Map<string, string>();
  for (const c of crewRows) {
    const id = cleanString(c.employeeId || c.empNo);
    if (c.crewUuid && id) empIdByCrewUuid.set(c.crewUuid, id);
  }

  const scaffold = buildScaffold({ allVessels, allCompanyRanks, availableRanks, allPorts });
  const { vesselByImoMap } = scaffold;

  // Build vessel IMO map by vesselUuid
  const vesselByUuidMap = new Map<string, any>();
  for (const v of allVessels) {
    if (v.vesselUuid) vesselByUuidMap.set(v.vesselUuid, v);
  }

  // Group sea service records by vessel (using vesselUuid as the key)
  const servicesByVessel = new Map<string, typeof rawSeaServices>();
  for (const s of rawSeaServices) {
    const key = s.vesselUuid || norm(s.vesselName || "");
    if (!key) continue;
    if (!servicesByVessel.has(key)) servicesByVessel.set(key, []);
    servicesByVessel.get(key)!.push(s);
  }

  let totalCrewEntries = 0;
  let matchedCrewCount = 0;
  let unmatchedRankCount = 0;

  for (const [vesselKey, services] of servicesByVessel) {
    const firstService = services[0];
    // Primary lookup by vesselUuid; fallback to name-based lookup
    const matchedVessel = vesselByUuidMap.get(vesselKey) ||
      scaffold.vesselByNameMap.get(norm(firstService.vesselName || ""));

    const vesselName = cleanString(
      matchedVessel?.vessel || firstService.vesselName || "Unknown Vessel"
    );
    const imo = matchedVessel?.imoNumber || "";

    // Resolve Rank/Position from Admin's defined position slots (not by
    // counting crew occurrences — see resolveRankPositions).
    const resolvedPositions = resolveRankPositions(
      services.map((s: any) => s.rank || ""),
      allCompanyRanks,
    );

    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      totalCrewEntries++;

      const { displayRank, position: positionValue, isRankMatched } = resolvedPositions[i];
      if (!isRankMatched) unmatchedRankCount++;

      const empId = empIdByCrewUuid.get(s.crewUuid || "") || "";
      const signOnDate = s.fromDate || "";

      // Crew resolved from DB: OK when empId is present; NOT FOUND when the
      // crewMembersV2 record is missing or soft-deleted (empId blank after lookup).
      const lookupStatus = empId ? "OK" : "NOT FOUND";
      if (empId) matchedCrewCount++;

      appendAssignmentRow(scaffold, {
        employeeId: empId,
        vesselName,
        imo,
        rank: displayRank,
        position: positionValue,
        signOnDate,
        contractPeriod: "",
        portOfJoining: "",
        assignmentType: "Primary",
        joiningStatus: "Signed On",
        relieverRank: "",
        lookupStatus,
        rankMatchStatus: isRankMatched ? "OK" : "UNMATCHED",
        isAmbiguous: false,
      });

      // Hierarchy row — one per assignment (position slot)
      appendHierarchyRow(scaffold, {
        vesselName,
        imo,
        rank: displayRank,
        position: positionValue,
        status: "Active",
      });
    }
  }

  applyAssignmentsConditionalFormatting(scaffold.assignmentsSheet);

  const buffer = Buffer.from(await scaffold.workbook.xlsx.writeBuffer());

  return {
    buffer,
    summary: {
      totalVessels: servicesByVessel.size,
      totalCrewEntries,
      matchedCrewCount,
      notFoundCount: totalCrewEntries - matchedCrewCount,
      duplicateCount: 0,
      unmatchedRankCount,
    },
  };
}
