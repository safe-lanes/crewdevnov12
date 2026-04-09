import { eq, and, isNull, ilike, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2, crewAssignments, crewSeaService, crewPersonalDetails, crewLicenses } from "../../../../shared/v2/crew-pool/schema";

interface CrewExperience {
  company: number;
  rank: number;
  tankers: number;
  oow: number;
  endorsements: string;
}

function calculateExperienceFromSeaService(seaServiceRecords: any[], presentRank: string): CrewExperience {
  let totalMonths = 0;
  let rankMonths = 0;
  let tankerMonths = 0;
  let oowMonths = 0;
  
  for (const record of seaServiceRecords) {
    const months = parseFloat(record.periodMonths) || 0;
    totalMonths += months;
    
    if (record.rank === presentRank) {
      rankMonths += months;
    }
    
    const categories = record.experienceCategories || [];
    if (categories.includes('Tanker') || categories.includes('Oil Tanker') || categories.includes('Chemical Tanker')) {
      tankerMonths += months;
    }
    
    if (record.rank?.includes('OOW') || record.rank?.includes('Officer of Watch')) {
      oowMonths += months;
    }
  }
  
  return {
    company: Math.round((totalMonths / 12) * 10) / 10,
    rank: Math.round((rankMonths / 12) * 10) / 10,
    tankers: Math.round((tankerMonths / 12) * 10) / 10,
    oow: Math.round((oowMonths / 12) * 10) / 10,
    endorsements: '',
  };
}

export const crewAvailabilityService = {
  async getCrewByRank(rank: string): Promise<any[]> {
    const db = getDb();
    
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
      .where(
        and(
          eq(crewMembersV2.presentRank, rank),
          eq(crewMembersV2.isDeleted, false),
          isNull(crewMembersV2.archivedAt),
          ilike(crewMembersV2.status, "active"),
          eq(crewMembersV2.isActive, true)
        )
      );

    const crewUuids = results.map((row: any) => row.crew.crewUuid);
    
    const seaServiceByCrewPromise = crewUuids.length > 0 
      ? db.select().from(crewSeaService).where(
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
    
    const [seaServiceRecords, personalDetailsRecords, licensesRecords] = await Promise.all([
      seaServiceByCrewPromise,
      personalDetailsByCrewPromise,
      licensesByCrewPromise,
    ]);
    
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
        fullName: row.crew.firstName && row.crew.familyName 
          ? `${row.crew.firstName} ${row.crew.familyName}`
          : row.crew.firstName || row.crew.familyName || "Unknown",
        presentRank: row.crew.presentRank,
        status: row.crew.status,
        availability: row.crew.availability,
        nextAvailability: row.crew.nextAvailability,
        nationalityUuid: row.crew.nationalityUuid,
        vesselTypeUuid: row.crew.vesselTypeUuid,
        currentVesselUuid: row.currentVesselUuid,
        currentSignOnDate: row.currentSignOnDate,
        reliefDue: row.reliefDue,
        isOnboard: !!row.currentVesselUuid,
        pool: personalDetails?.crewPool || null,
        manningAgent: personalDetails?.manningAgent || null,
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
      fullName: row.crew.firstName && row.crew.familyName 
        ? `${row.crew.firstName} ${row.crew.familyName}`
        : row.crew.firstName || row.crew.familyName || "Unknown",
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
