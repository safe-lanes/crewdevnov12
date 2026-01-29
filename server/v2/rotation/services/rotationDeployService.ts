import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { rotationEntriesV2, rotationArchiveV2 } from "../../../../shared/v2/rotation/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { crewMembersV2, crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { rotationEntriesRepository, rotationArchiveRepository } from "../repositories";
import { vesselPlanningRepository } from "../../vessel/repositories";
import { v4 as uuidv4 } from "uuid";

export const rotationDeployService = {
  async deployEntry(entryUuid: string, deployedByUuid: string): Promise<{ success: boolean; planUuid?: string; archiveUuid?: string; error?: string }> {
    const db = getDb();
    
    try {
      const entry = await rotationEntriesRepository.findByEntryUuid(entryUuid);
      if (!entry) {
        return { success: false, error: `Entry not found: ${entryUuid}` };
      }

      if (entry.proposalStatus === "Deployed") {
        return { success: false, error: "Entry already deployed" };
      }

      if (!entry.crewUuid) {
        return { success: false, error: "No crew assigned to this entry" };
      }

      const crewResults = await db
        .select()
        .from(crewMembersV2)
        .where(eq(crewMembersV2.crewUuid, entry.crewUuid));
      
      const crew = crewResults[0];
      if (!crew) {
        return { success: false, error: `Crew not found: ${entry.crewUuid}` };
      }

      const crewName = crew.firstName && crew.familyName 
        ? `${crew.firstName} ${crew.familyName}`
        : crew.firstName || crew.familyName || "Unknown";

      const deployedDate = new Date().toISOString().split("T")[0];

      await rotationEntriesRepository.update(entryUuid, {
        proposalStatus: "Deployed",
        deployedByUuid,
        deployedDate,
      });

      const existingPlan = await vesselPlanningRepository.findByVesselAndRank(
        entry.vesselUuid,
        entry.rankId || entry.rank
      );

      let planUuid: string;
      
      if (existingPlan) {
        await vesselPlanningRepository.update(existingPlan.planUuid, {
          relieverCrewUuid: entry.crewUuid,
          relieverSignOnDate: entry.signOnDate,
          joiningPortUuid: entry.joiningPortUuid,
          joiningStatus: "Planned",
          relieverContractPeriodMonths: entry.contractPeriod,
        });
        planUuid = existingPlan.planUuid;
      } else {
        const newPlan = await db
          .insert(vesselPlanningV2)
          .values({
            planUuid: uuidv4(),
            vesselUuid: entry.vesselUuid,
            rankId: entry.rankId || entry.rank,
            rank: entry.rank,
            relieverCrewUuid: entry.crewUuid,
            relieverSignOnDate: entry.signOnDate,
            joiningPortUuid: entry.joiningPortUuid,
            joiningStatus: "Planned",
            relieverContractPeriodMonths: entry.contractPeriod,
          })
          .returning();
        planUuid = newPlan[0].planUuid;
      }

      await rotationEntriesRepository.update(entryUuid, {
        deployedToPlanUuid: planUuid,
      });

      const archive = await rotationArchiveRepository.create({
        draftUuid: entry.draftUuid,
        entryUuid: entry.entryUuid,
        vesselUuid: entry.vesselUuid,
        rank: entry.rank,
        crewUuid: entry.crewUuid,
        crewName,
        signOnDate: entry.signOnDate,
        joiningPortUuid: entry.joiningPortUuid,
        contractPeriod: entry.contractPeriod,
        result: "Deployed",
        archivedByUuid: deployedByUuid,
        archivedDate: deployedDate,
        currentCrewUuid: entry.currentCrewUuid,
        currentCrewSignOnDate: entry.currentCrewSignOnDate,
        currentCrewContractEnd: entry.currentCrewContractEnd,
        currentCrewRangeStart: entry.currentCrewRangeStart,
        currentCrewRangeEnd: entry.currentCrewRangeEnd,
        deployedToPlanUuid: planUuid,
      });

      await db
        .insert(crewAssignments)
        .values({
          assignUuid: uuidv4(),
          crewUuid: entry.crewUuid,
          vesselUuid: entry.vesselUuid,
          isCurrent: false,
          signOnDate: entry.signOnDate,
          contractPeriod: entry.contractPeriod?.toString(),
          portOfJoiningUuid: entry.joiningPortUuid,
          assignmentType: "Planned",
        });

      return { 
        success: true, 
        planUuid, 
        archiveUuid: archive.archiveUuid 
      };
    } catch (error: any) {
      console.error("Deploy error:", error);
      return { success: false, error: error.message };
    }
  },

  async rejectEntry(entryUuid: string, rejectedByUuid: string, reason: string): Promise<{ success: boolean; archiveUuid?: string; error?: string }> {
    const db = getDb();
    
    try {
      const entry = await rotationEntriesRepository.findByEntryUuid(entryUuid);
      if (!entry) {
        return { success: false, error: `Entry not found: ${entryUuid}` };
      }

      const rejectedDate = new Date().toISOString().split("T")[0];

      await rotationEntriesRepository.update(entryUuid, {
        proposalStatus: "Rejected",
        rejectionReason: reason,
      });

      let crewName: string | undefined;
      if (entry.crewUuid) {
        const crewResults = await db
          .select()
          .from(crewMembersV2)
          .where(eq(crewMembersV2.crewUuid, entry.crewUuid));
        
        if (crewResults[0]) {
          const crew = crewResults[0];
          crewName = crew.firstName && crew.familyName 
            ? `${crew.firstName} ${crew.familyName}`
            : crew.firstName || crew.familyName || "Unknown";
        }
      }

      const archive = await rotationArchiveRepository.create({
        draftUuid: entry.draftUuid,
        entryUuid: entry.entryUuid,
        vesselUuid: entry.vesselUuid,
        rank: entry.rank,
        crewUuid: entry.crewUuid || "",
        crewName,
        signOnDate: entry.signOnDate,
        joiningPortUuid: entry.joiningPortUuid,
        contractPeriod: entry.contractPeriod,
        result: "Rejected",
        archivedByUuid: rejectedByUuid,
        archivedDate: rejectedDate,
        rejectionReason: reason,
        currentCrewUuid: entry.currentCrewUuid,
        currentCrewSignOnDate: entry.currentCrewSignOnDate,
        currentCrewContractEnd: entry.currentCrewContractEnd,
      });

      return { success: true, archiveUuid: archive.archiveUuid };
    } catch (error: any) {
      console.error("Reject error:", error);
      return { success: false, error: error.message };
    }
  },
};
