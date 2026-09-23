import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { rotationEntriesV2, rotationArchiveV2 } from "../../../../shared/v2/rotation/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { crewMembersV2, crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { rotationEntriesRepository, rotationArchiveRepository } from "../repositories";
import { vesselPlanningRepository } from "../../vessel/repositories";
import { v4 as uuidv4 } from "uuid";

function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;
  
  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;
  
  return result;
}

export const rotationDeployService = {
  async deployEntry(entryUuid: string, deployedByUuid: string, auditUserUuid?: string): Promise<{ success: boolean; planUuid?: string; archiveUuid?: string; error?: string }> {
    const db = getDb();
    const effectiveAuditUser = auditUserUuid || deployedByUuid;
    
    try {
      const deployedDate = new Date().toISOString().split("T")[0];
      return await db.transaction(async (tx: any) => {
        const [entry] = await tx
          .select()
          .from(rotationEntriesV2)
          .where(
            and(
              eq(rotationEntriesV2.entryUuid, entryUuid),
              eq(rotationEntriesV2.isDeleted, false),
            ),
          )
          .for("update");
        if (!entry) {
          return { success: false, error: `Entry not found: ${entryUuid}` };
        }
        if (entry.proposalStatus === "Deployed") {
          return { success: false, error: "Entry already deployed" };
        }
        if (!entry.crewUuid) {
          return { success: false, error: "No crew assigned to this entry" };
        }

        const [crew] = await tx
          .select()
          .from(crewMembersV2)
          .where(eq(crewMembersV2.crewUuid, entry.crewUuid));
        if (!crew) {
          return { success: false, error: `Crew not found: ${entry.crewUuid}` };
        }
        const crewName = crew.firstName && crew.familyName
          ? `${crew.firstName} ${crew.familyName}`
          : crew.firstName || crew.familyName || "Unknown";

        const [existingPlan] = await tx
          .select()
          .from(vesselPlanningV2)
          .where(
            and(
              eq(vesselPlanningV2.vesselUuid, entry.vesselUuid),
              eq(vesselPlanningV2.rank, entry.rank),
              eq(vesselPlanningV2.crewStatus, "primary"),
              eq(vesselPlanningV2.isDeleted, false),
              eq(vesselPlanningV2.isArchived, false),
            ),
          )
          .limit(1)
          .for("update");

        if (existingPlan?.relieverCrewUuid) {
          return {
            success: false,
            error: "Reliever already exists. The existing reliever must either take over or be unassigned from vessel before deploying a new crew.",
          };
        }

        const [existingSecondary] = await tx
          .select()
          .from(vesselPlanningV2)
          .where(
            and(
              eq(vesselPlanningV2.vesselUuid, entry.vesselUuid),
              eq(vesselPlanningV2.rank, entry.rank),
              eq(vesselPlanningV2.crewStatus, "secondary"),
              eq(vesselPlanningV2.isDeleted, false),
              eq(vesselPlanningV2.isArchived, false),
            ),
          )
          .limit(1)
          .for("update");
        if (existingSecondary) {
          return {
            success: false,
            error: "Secondary crew already exists. The secondary must take over before deploying a new crew.",
          };
        }

        let planUuid: string;
        if (existingPlan) {
          const planning = await vesselPlanningRepository.update(
            existingPlan.planUuid,
            {
              relieverCrewUuid: entry.crewUuid,
              relieverSignOnDate: entry.signOnDate,
              joiningPortUuid: entry.joiningPortUuid,
              joiningStatus: "Planned",
              plannedConfirmedDate: entry.signOnDate,
              travelStartDate: null,
              relieverContractPeriodMonths: entry.contractPeriod,
              updatedByUuid: effectiveAuditUser,
            },
            tx,
          );
          if (!planning) {
            throw new Error(`Planning record not found: ${existingPlan.planUuid}`);
          }
          planUuid = existingPlan.planUuid;
        } else {
          const [newPlan] = await tx
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
              plannedConfirmedDate: entry.signOnDate,
              travelStartDate: null,
              relieverContractPeriodMonths: entry.contractPeriod,
              createdByUuid: effectiveAuditUser,
              updatedByUuid: effectiveAuditUser,
            })
            .returning();
          planUuid = newPlan.planUuid;
        }

        await tx
          .update(rotationEntriesV2)
          .set({
            proposalStatus: "Deployed",
            deployedByUuid,
            deployedDate,
            deployedToPlanUuid: planUuid,
            updatedAt: new Date(),
            updatedByUuid: effectiveAuditUser,
          })
          .where(eq(rotationEntriesV2.entryUuid, entryUuid));

        const [archive] = await tx
          .insert(rotationArchiveV2)
          .values({
            archiveUuid: uuidv4(),
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
            createdByUuid: effectiveAuditUser,
          })
          .returning();

        // Do not deactivate OnBoard assignments: the crew remains on board until sign-off.
        await tx
          .update(crewAssignments)
          .set({
            isCurrent: false,
            updatedByUuid: effectiveAuditUser,
          })
          .where(
            and(
              eq(crewAssignments.crewUuid, entry.crewUuid),
              eq(crewAssignments.isCurrent, true),
              eq(crewAssignments.assignmentType, "Planned"),
            ),
          );

        await tx
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
            createdByUuid: effectiveAuditUser,
            updatedByUuid: effectiveAuditUser,
          });

        return {
          success: true,
          planUuid,
          archiveUuid: archive.archiveUuid,
        };
      });
    } catch (error: any) {
      console.error("Deploy error:", error);
      return { success: false, error: error.message };
    }
  },

  async rejectEntry(entryUuid: string, rejectedByUuid: string, reason: string, auditUserUuid?: string): Promise<{ success: boolean; archiveUuid?: string; error?: string }> {
    const db = getDb();
    const effectiveAuditUser = auditUserUuid || rejectedByUuid;
    
    try {
      const entry = await rotationEntriesRepository.findByEntryUuid(entryUuid);
      if (!entry) {
        return { success: false, error: `Entry not found: ${entryUuid}` };
      }

      const rejectedDate = new Date().toISOString().split("T")[0];

      await rotationEntriesRepository.update(entryUuid, {
        proposalStatus: "Rejected",
        rejectionReason: reason,
        updatedByUuid: effectiveAuditUser,
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
        createdByUuid: effectiveAuditUser,
      });

      return { success: true, archiveUuid: archive.archiveUuid };
    } catch (error: any) {
      console.error("Reject error:", error);
      return { success: false, error: error.message };
    }
  },
};
