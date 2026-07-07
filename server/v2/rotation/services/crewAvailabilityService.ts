import { eq, and, isNull, ilike, inArray, or, sql } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2, crewAssignments, crewSeaService, crewPersonalDetails, crewLicenses } from "../../../../shared/v2/crew-pool/schema";
import { masterVesselTypes, masterNationalities } from "../../../../shared/schema";
import { crewSeaServiceService } from "../../crew-pool/services/crewSeaServiceService";

interface CrewExperience {
  company: number;
  rank: number;
  tankers: number;
  oow: number;
  endorsements: string;
}

const OOW_RANKS = new Set([
  "chief officer", "c/o", "first mate", "1st mate", "first officer", "1st officer",
  "2nd officer", "second officer", "2/o",
  "3rd officer", "third officer", "3/o",
  "2nd engineer", "second engineer", "2/e",
  "3rd engineer", "third engineer", "3/e",
  "4th engineer", "fourth engineer", "4/e",
  "junior officer", "jr. officer", "jr officer",
]);

function calculateExperienceFromSeaService(seaServiceRecords: any[], presentRank: string): CrewExperience {
  let rankMonths = 0;
  let tankerMonths = 0;
  let oowMonths = 0;

  let companyYears = 0;
  const companyRecords = seaServiceRecords.filter((r: any) => r.serviceType === "company");
  if (companyRecords.length > 0) {
    const fromDates = companyRecords
      .map((s: any) => s.fromDate)
      .filter((d: any) => d && typeof d === "string" && d.trim() !== "")
      .map((d: any) => new Date(d))
      .filter((d: any) => !isNaN(d.getTime()));

    if (fromDates.length > 0) {
      const earliestDate = new Date(
        Math.min(...fromDates.map((d: any) => d.getTime()))
      );
      const today = new Date();
      const diffMs = today.getTime() - earliestDate.getTime();
      const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
      const roundedYears = Math.round(diffYears * 10) / 10;
      companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
    }
  }
  
  for (const record of seaServiceRecords) {
    const months = parseFloat(record.periodMonths || "0") ||
      crewSeaServiceService.calculatePeriodMonths(record.fromDate, record.toDate);
    
    if (record.rank === presentRank) {
      rankMonths += months;
    }
    
    const isTankerVessel =
      record.isTanker === true ||
      record.isOilTanker === true ||
      record.isGasTanker === true ||
      record.isChemicalTanker === true;

    if (isTankerVessel) {
      tankerMonths += months;
    } else {
      const vesselType = (record.vesselTypeName || "").toLowerCase();
      if (
        vesselType.includes("tanker") ||
        vesselType.includes("chemical") ||
        vesselType.includes("lpg") ||
        vesselType.includes("lng")
      ) {
        tankerMonths += months;
      }
    }

    const rank = (record.rank || "").toLowerCase().trim();
    if (OOW_RANKS.has(rank)) {
      oowMonths += months;
    }
  }
  
  return {
    company: companyYears,
    rank: Math.round((rankMonths / 12) * 10) / 10,
    tankers: Math.round((tankerMonths / 12) * 10) / 10,
    oow: Math.round((oowMonths / 12) * 10) / 10,
    endorsements: '',
  };
}

export const crewAvailabilityService = {
  async getCrewByRank(rank: string): Promise<any[]> {
    const db = getDb();

    // Crew with an APPROVED prior-joining promotion INTO this rank are surfaced
    // in this (target-rank) pool tagged "(PR)" even though their present_rank is
    // still lower until they sign on. Conversely, present-rank crew who are
    // themselves pending a prior-joining promotion to a DIFFERENT rank are
    // surfaced at their target rank instead, so they are excluded below.
    const { PromotionReviewsService } = await import("../../promotions/services");
    const reviewsService = new PromotionReviewsService();
    const promotees = await reviewsService.getApprovedPriorJoiningPromoteesToRank(rank);
    const promoteeRankByUuid = new Map<string, string>(
      promotees.map((p) => [p.crewUuid, p.promotionToRank]),
    );
    const promoteeUuids = Array.from(promoteeRankByUuid.keys());

    const rawResults = await db
      .selectDistinctOn([crewMembersV2.crewUuid], {
        crew: crewMembersV2,
        currentVesselUuid: crewAssignments.vesselUuid,
        currentSignOnDate: crewAssignments.signOnDate,
        reliefDue: crewAssignments.reliefDue,
      })
      .from(crewMembersV2)
      .leftJoin(
        crewAssignments,
        and(
          eq(crewAssignments.crewUuid, crewMembersV2.crewUuid),
          eq(crewAssignments.isCurrent, true)
        )
      )
      .where(
        and(
          eq(crewMembersV2.isDeleted, false),
          isNull(crewMembersV2.archivedAt),
          ilike(crewMembersV2.status, "active"),
          eq(crewMembersV2.isActive, true),
          or(
            eq(crewMembersV2.presentRank, rank),
            promoteeUuids.length > 0
              ? inArray(crewMembersV2.crewUuid, promoteeUuids)
              : sql`false`
          )
        )
      );

    // Exclude present-rank crew who have a pending prior-joining promotion to a
    // different rank — they belong in their target-rank pool, not this one.
    const baseUuids = rawResults
      .filter(
        (row: any) =>
          row.crew.presentRank === rank && !promoteeRankByUuid.has(row.crew.crewUuid)
      )
      .map((row: any) => row.crew.crewUuid);
    const pendingAwayMap =
      baseUuids.length > 0
        ? await reviewsService.getPendingPriorJoiningByCrewUuids(baseUuids)
        : new Map<string, { promotionToRank: string }>();
    const results = rawResults.filter(
      (row: any) => !pendingAwayMap.has(row.crew.crewUuid)
    );

    const crewUuids = results.map((row: any) => row.crew.crewUuid);
    
    const mvtByUuid = masterVesselTypes;
    const mvtByName = aliasedTable(masterVesselTypes, "mvt_by_name");

    const seaServiceByCrewPromise = crewUuids.length > 0 
      ? db.select({
          crewUuid: crewSeaService.crewUuid,
          rank: crewSeaService.rank,
          periodMonths: crewSeaService.periodMonths,
          fromDate: crewSeaService.fromDate,
          toDate: crewSeaService.toDate,
          serviceType: crewSeaService.serviceType,
          vesselTypeUuid: crewSeaService.vesselTypeUuid,
          vesselTypeName: sql<string>`COALESCE(${mvtByUuid.vesselType}, ${mvtByName.vesselType})`,
          isTanker: sql<boolean>`COALESCE(${mvtByUuid.tanker}, ${mvtByName.tanker})`,
          isOilTanker: sql<boolean>`COALESCE(${mvtByUuid.oilTanker}, ${mvtByName.oilTanker})`,
          isGasTanker: sql<boolean>`COALESCE(${mvtByUuid.gasTanker}, ${mvtByName.gasTanker})`,
          isChemicalTanker: sql<boolean>`COALESCE(${mvtByUuid.chemicalTanker}, ${mvtByName.chemicalTanker})`,
        })
        .from(crewSeaService)
        .leftJoin(
          mvtByUuid,
          eq(crewSeaService.vesselTypeUuid, mvtByUuid.vtUuid)
        )
        .leftJoin(
          mvtByName,
          and(
            isNull(mvtByUuid.vtUuid),
            eq(crewSeaService.vesselTypeUuid, mvtByName.vesselType)
          )
        )
        .where(
          and(
            inArray(crewSeaService.crewUuid, crewUuids),
            eq(crewSeaService.isDeleted, false)
          )
        )
      : Promise.resolve([]);
      
    const personalDetailsByCrewPromise = crewUuids.length > 0
      ? db.select().from(crewPersonalDetails).where(
          and(
            inArray(crewPersonalDetails.crewUuid, crewUuids),
            eq(crewPersonalDetails.isDeleted, false)
          )
        )
      : Promise.resolve([]);
      
    const licensesByCrewPromise = crewUuids.length > 0
      ? db.select().from(crewLicenses).where(
          and(
            inArray(crewLicenses.crewUuid, crewUuids),
            eq(crewLicenses.isDeleted, false),
            isNull(crewLicenses.archivedAt)
          )
        )
      : Promise.resolve([]);

    // Collect unique vessel-type and nationality refs from crew rows.
    // Some legacy crew rows may store the raw name in the *_uuid column
    // instead of the master UUID, so we look up by either column and
    // build a single ref->name map.
    const vesselTypeRefs: string[] = Array.from(new Set<string>(
      results.map((r: any) => r.crew.vesselTypeUuid).filter((v: any): v is string => !!v)
    ));
    const nationalityRefs: string[] = Array.from(new Set<string>(
      results.map((r: any) => r.crew.nationalityUuid).filter((v: any): v is string => !!v)
    ));

    const vesselTypeMastersPromise = vesselTypeRefs.length > 0
      ? db.select({
          vtUuid: masterVesselTypes.vtUuid,
          vesselType: masterVesselTypes.vesselType,
        })
        .from(masterVesselTypes)
        .where(
          and(
            eq(masterVesselTypes.isDeleted, false),
            or(
              inArray(masterVesselTypes.vtUuid, vesselTypeRefs),
              inArray(masterVesselTypes.vesselType, vesselTypeRefs)
            )
          )
        )
      : Promise.resolve([] as Array<{ vtUuid: string | null; vesselType: string | null }>);

    const nationalityMastersPromise = nationalityRefs.length > 0
      ? db.select({
          natUuid: masterNationalities.natUuid,
          nationality: masterNationalities.nationality,
        })
        .from(masterNationalities)
        .where(
          and(
            eq(masterNationalities.isDeleted, false),
            or(
              inArray(masterNationalities.natUuid, nationalityRefs),
              inArray(masterNationalities.nationality, nationalityRefs)
            )
          )
        )
      : Promise.resolve([] as Array<{ natUuid: string | null; nationality: string | null }>);

    const [seaServiceRecords, personalDetailsRecords, licensesRecords, vesselTypeMasters, nationalityMasters] = await Promise.all([
      seaServiceByCrewPromise,
      personalDetailsByCrewPromise,
      licensesByCrewPromise,
      vesselTypeMastersPromise,
      nationalityMastersPromise,
    ]);

    // Index ref -> resolved name. Map both UUID and name keys so the same
    // map serves rows that store either form.
    const vesselTypeNameByRef = new Map<string, string>();
    for (const v of vesselTypeMasters) {
      if (v.vesselType) {
        if (v.vtUuid) vesselTypeNameByRef.set(v.vtUuid, v.vesselType);
        vesselTypeNameByRef.set(v.vesselType, v.vesselType);
      }
    }
    const nationalityNameByRef = new Map<string, string>();
    for (const n of nationalityMasters) {
      if (n.nationality) {
        if (n.natUuid) nationalityNameByRef.set(n.natUuid, n.nationality);
        nationalityNameByRef.set(n.nationality, n.nationality);
      }
    }
    
    const seaServiceByCrewMap = new Map<string, any[]>();
    for (const record of seaServiceRecords) {
      const existing = seaServiceByCrewMap.get(record.crewUuid) || [];
      existing.push(record);
      seaServiceByCrewMap.set(record.crewUuid, existing);
    }
    
    const personalDetailsByCrewMap = new Map<string, any>();
    for (const record of personalDetailsRecords) {
      personalDetailsByCrewMap.set(record.crewUuid, record);
    }
    
    const endorsementsByCrewMap = new Map<string, string[]>();
    for (const license of licensesRecords) {
      if (license.abbr) {
        const existing = endorsementsByCrewMap.get(license.crewUuid) || [];
        if (!existing.includes(license.abbr)) {
          existing.push(license.abbr);
        }
        endorsementsByCrewMap.set(license.crewUuid, existing);
      }
    }

    return results.map((row: any) => {
      const crewUuid = row.crew.crewUuid;
      const seaService = seaServiceByCrewMap.get(crewUuid) || [];
      const personalDetails = personalDetailsByCrewMap.get(crewUuid);
      const endorsements = endorsementsByCrewMap.get(crewUuid) || [];
      
      const experience = calculateExperienceFromSeaService(seaService, row.crew.presentRank);
      experience.endorsements = endorsements.slice(0, 3).join(', ');
      
      return {
        crewUuid: row.crew.crewUuid,
        empNo: row.crew.empNo,
        employeeId: row.crew.employeeId,
        firstName: row.crew.firstName,
        familyName: row.crew.familyName,
        fullName: [row.crew.firstName, row.crew.familyName].filter(Boolean).join(' ') || "Unknown",
        presentRank: row.crew.presentRank,
        status: row.crew.status,
        availability: row.crew.availability,
        nextAvailability: row.crew.nextAvailability,
        nationalityUuid: row.crew.nationalityUuid,
        vesselTypeUuid: row.crew.vesselTypeUuid,
        shipType: row.crew.vesselTypeUuid ? (vesselTypeNameByRef.get(row.crew.vesselTypeUuid) || null) : null,
        nationality: row.crew.nationalityUuid ? (nationalityNameByRef.get(row.crew.nationalityUuid) || null) : null,
        currentVesselUuid: row.currentVesselUuid,
        currentSignOnDate: row.currentSignOnDate,
        reliefDue: row.reliefDue,
        isOnboard: !!row.currentVesselUuid,
        pool: personalDetails?.crewPool || null,
        manningAgent: personalDetails?.manningAgent || null,
        hasPriorJoiningPromotion: promoteeRankByUuid.has(crewUuid),
        promotionToRank: promoteeRankByUuid.get(crewUuid) ?? null,
        experience,
      };
    });
  },

  async getAvailableCrewByRank(rank: string): Promise<any[]> {
    const allCrew = await this.getCrewByRank(rank);
    return allCrew.filter((crew: any) => 
      crew.availability === "Available" || 
      crew.availability === "Standby" ||
      !crew.isOnboard
    );
  },

  async searchCrewByRank(rank: string, search?: string): Promise<any[]> {
    const db = getDb();
    
    let conditions = [
      eq(crewMembersV2.presentRank, rank),
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
      ilike(crewMembersV2.status, "active"),
      eq(crewMembersV2.isActive, true),
    ];

    const results = await db
      .selectDistinctOn([crewMembersV2.crewUuid], {
        crew: crewMembersV2,
        currentVesselUuid: crewAssignments.vesselUuid,
        currentSignOnDate: crewAssignments.signOnDate,
        reliefDue: crewAssignments.reliefDue,
      })
      .from(crewMembersV2)
      .leftJoin(
        crewAssignments,
        and(
          eq(crewAssignments.crewUuid, crewMembersV2.crewUuid),
          eq(crewAssignments.isCurrent, true)
        )
      )
      .where(and(...conditions));

    let mappedResults = results.map((row: any) => ({
      crewUuid: row.crew.crewUuid,
      empNo: row.crew.empNo,
      employeeId: row.crew.employeeId,
      firstName: row.crew.firstName,
      familyName: row.crew.familyName,
      fullName: [row.crew.firstName, row.crew.familyName].filter(Boolean).join(' ') || "Unknown",
      presentRank: row.crew.presentRank,
      status: row.crew.status,
      availability: row.crew.availability,
      nextAvailability: row.crew.nextAvailability,
      currentVesselUuid: row.currentVesselUuid,
      currentSignOnDate: row.currentSignOnDate,
      reliefDue: row.reliefDue,
      isOnboard: !!row.currentVesselUuid,
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      mappedResults = mappedResults.filter((crew: any) =>
        crew.firstName?.toLowerCase().includes(searchLower) ||
        crew.familyName?.toLowerCase().includes(searchLower) ||
        crew.fullName?.toLowerCase().includes(searchLower) ||
        crew.empNo?.toLowerCase().includes(searchLower) ||
        crew.employeeId?.toLowerCase().includes(searchLower)
      );
    }

    return mappedResults;
  },
};
