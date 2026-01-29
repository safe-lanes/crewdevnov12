import { eq, and, isNull, ilike, or } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2, crewAssignments } from "../../../../shared/v2/crew-pool/schema";

export const crewAvailabilityService = {
  async getCrewByRank(rank: string): Promise<any[]> {
    const db = getDb();
    
    const results = await db
      .select({
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
          eq(crewMembersV2.status, "Active")
        )
      );

    return results.map((row: any) => ({
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
    }));
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
    ];

    const results = await db
      .select({
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
