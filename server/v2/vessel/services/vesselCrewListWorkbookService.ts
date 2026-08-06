import ExcelJS from "exceljs";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";
import { admCompanyRanksV2, admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import { crewMembersV2, crewSeaService } from "../../../../shared/v2/crew-pool/schema";
import { vesselDraftsService } from "../../admin/services/vesselDraftsService";
import { eq, isNull } from "drizzle-orm";
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
 * Ingest parsed crew list docs from ZIP and generate a downloadable 2-sheet Excel workbook:
 * 1. "Assignments": Employee ID, Vessel Name, IMO, Rank, Sign On Date, Lookup Status, Rank Match Status, etc.
 * 2. "VesselRankHierarchy": Unique Vessel Name, IMO, Rank, Status ("Active")
 */
export async function generateVesselImportWorkbook(docs: VesselCrewListDoc[]): Promise<GeneratedWorkbookResult> {
  const db = getDb();

  // Load reference data dynamically from DB
  const allVessels = await db.select().from(masterVessels);
  const allCompanyRanks = await db.select().from(admCompanyRanksV2).where(eq(admCompanyRanksV2.isDeleted, false));
  const availableRanks = await db.select().from(admAvailableRanksV2).where(eq(admAvailableRanksV2.isDeleted, false));
  const allCrew = await db.select().from(crewMembersV2).where(eq(crewMembersV2.isDeleted, false));
  const openSeaServices = await db.select().from(crewSeaService).where(isNull(crewSeaService.toDate));

  // Vessel lookup by IMO (digits only) or Name
  const vesselByImoMap = new Map<string, any>();
  const vesselByNameMap = new Map<string, any>();
  for (const v of allVessels) {
    if (v.imo) vesselByImoMap.set(v.imo.replace(/\D/g, ""), v);
    if (v.vessel) vesselByNameMap.set(norm(v.vessel), v);
  }

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

  // Multi-index crew lookup maps supporting First + Middle name variations
  const crewByFnLnDobMap = new Map<string, any[]>();
  const crewByLnFnDobMap = new Map<string, any[]>();
  const crewByFullNameMap = new Map<string, any[]>();
  const crewByFnLnMap = new Map<string, any[]>(); // Fallback without DOB constraint

  const addMap = (map: Map<string, any[]>, key: string, c: any) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  };

  for (const c of allCrew) {
    const fn = norm(c.firstName);
    const mn = norm(c.middleName);
    const ln = norm(c.familyName);
    const dob = c.dob || "";

    const fnMn = [fn, mn].filter(Boolean).join(" ");

    addMap(crewByFnLnDobMap, `${fnMn}|${ln}|${dob}`, c);
    if (fn !== fnMn) addMap(crewByFnLnDobMap, `${fn}|${ln}|${dob}`, c);

    addMap(crewByLnFnDobMap, `${ln}|${fnMn}|${dob}`, c);
    if (fn !== fnMn) addMap(crewByLnFnDobMap, `${ln}|${fn}|${dob}`, c);

    addMap(crewByFullNameMap, `${fnMn} ${ln}`, c);
    addMap(crewByFullNameMap, `${ln} ${fnMn}`, c);
    if (fn !== fnMn) {
      addMap(crewByFullNameMap, `${fn} ${ln}`, c);
      addMap(crewByFullNameMap, `${ln} ${fn}`, c);
    }

    addMap(crewByFnLnMap, `${fnMn}|${ln}`, c);
    addMap(crewByFnLnMap, `${ln}|${fnMn}`, c);
    if (fn !== fnMn) {
      addMap(crewByFnLnMap, `${fn}|${ln}`, c);
      addMap(crewByFnLnMap, `${ln}|${fn}`, c);
    }
  }

  // Open sea service map by crewUuid -> active sea service record
  const seaServiceMap = new Map<string, { vesselName: string; fromDate: string }>();
  for (const ss of openSeaServices) {
    if (ss.crewUuid && !seaServiceMap.has(ss.crewUuid)) {
      seaServiceMap.set(ss.crewUuid, {
        vesselName: ss.vesselName || "",
        fromDate: ss.fromDate || "",
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

  const assignmentsSheet = workbook.addWorksheet("Assignments");
  const hierarchySheet = workbook.addWorksheet("VesselRankHierarchy");

  assignmentsSheet.columns = [
    { header: "Employee ID", key: "employeeId", width: 16 },
    { header: "Vessel Name", key: "vesselName", width: 22 },
    { header: "IMO", key: "imo", width: 14 },
    { header: "Rank", key: "rank", width: 18 },
    { header: "Sign On Date", key: "signOnDate", width: 14 },
    { header: "Contract Period (Months)", key: "contractPeriod", width: 22 },
    { header: "Relief Due Date", key: "reliefDue", width: 16 },
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
    { header: "Status", key: "status", width: 14 },
  ];

  const mandatoryAssignmentsKeys = new Set([
    "employeeId",
    "vesselName",
    "rank",
    "signOnDate",
    "assignmentType",
  ]);

  const mandatoryHierarchyKeys = new Set([
    "vesselName",
    "rank",
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

  const writtenHierarchyVessels = new Set<string>();
  const vesselRankCountsMap = new Map<string, Map<string, number>>();

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
      const rankKey = norm(rawRank);
      const baseRankKey = norm(rawRank.split("_")[0]);
      vesselActiveRanksSet.add(rankKey);

      const count = rankCounts.get(rankKey) || 1;
      let displayRank = rawRank;
      if (count > 1) {
        const nextNum = (rankInstanceCounters.get(rankKey) || 0) + 1;
        rankInstanceCounters.set(rankKey, nextNum);
        displayRank = `${rawRank}_${nextNum}`;
      }

      const companyRank = companyRankByNameMap.get(rankKey) || companyRankByNameMap.get(baseRankKey);
      const isRankMatched = !!companyRank;
      if (!isRankMatched) {
        unmatchedRankCount++;
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
        // Tie-breaker 1: Check if one candidate's rank matches entry rank (e.g., AB)
        const rankMatchedCandidates = unassignedCandidates.filter((c: any) => norm(c.rank) === rankKey || norm(c.rankId) === rankKey);
        if (rankMatchedCandidates.length === 1) {
          selectedCrew = rankMatchedCandidates[0];
          lookupStatus = "OK";
          matchedCrewCount++;
        } else {
          // Tie-breaker 2: Pick the first unassigned candidate
          selectedCrew = unassignedCandidates[0];
          lookupStatus = "OK";
          matchedCrewCount++;
        }
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

      assignmentsSheet.addRow({
        employeeId,
        vesselName,
        imo,
        rank: displayRank,
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

      if (shouldAddHierarchy) {
        hierarchySheet.addRow({
          vesselName,
          imo,
          rank: displayRank,
          status: "Active",
        });
      }
    }
  }

  // Build and save revision_data JSON ONCE PER VESSEL in adm_vessel_drafts_v2
  const nowIso = new Date().toISOString();
  for (const [vesselUuid, rankCounts] of vesselRankCountsMap.entries()) {
    const revisionData: any[] = [];
    for (const cr of allCompanyRanks) {
      const crRankKey = norm(cr.rank);
      const countInDoc = rankCounts.get(crRankKey) || 0;

      if (countInDoc > 1) {
        revisionData.push({
          ...cr,
          actualManningFlag: false,
          actualManning: [],
          safeManning: false,
          optimumManning: false,
          highWorkloadManning: false,
        });

        for (let i = 1; i <= countInDoc; i++) {
          revisionData.push({
            ...cr,
            id: `${cr.id}_role_${i}_${Date.now()}`,
            originalRankId: String(cr.id),
            isRoleRow: true,
            role: `${cr.rank}_${i}`,
            actualManningFlag: true,
            actualManning: [],
            safeManning: false,
            optimumManning: false,
            highWorkloadManning: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      } else {
        revisionData.push({
          ...cr,
          actualManningFlag: countInDoc === 1,
          actualManning: [],
          safeManning: false,
          optimumManning: false,
          highWorkloadManning: false,
        });
      }
    }

    await vesselDraftsService.upsert({
      vesselId: vesselUuid,
      revision: "R0",
      draftData: JSON.stringify(revisionData),
    });
  }

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
