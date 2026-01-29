import { vesselPlanningRepository, vesselPlanningAttachmentsRepository } from "../repositories";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { getDb } from "../../db";
import { crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, sql } from "drizzle-orm";

export const vesselPlanningService = {
  async getByVesselUuid(vesselUuid: string) {
    return vesselPlanningRepository.findByVesselUuid(vesselUuid);
  },

  async getByPlanUuid(planUuid: string) {
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    const attachments = await vesselPlanningAttachmentsRepository.findByPlanUuid(planUuid);
    return { ...planning, attachments };
  },

  async create(data: Omit<InsertVesselPlanningV2, "planUuid">) {
    return vesselPlanningRepository.create(data);
  },

  async update(planUuid: string, data: Partial<InsertVesselPlanningV2>) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    return vesselPlanningRepository.update(planUuid, data);
  },

  async archive(planUuid: string, archivedByUuid?: string) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    return vesselPlanningRepository.archive(planUuid, archivedByUuid);
  },

  async addAttachment(planUuid: string, data: Omit<InsertVesselPlanningAttachmentsV2, "attUuid" | "planUuid">) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    return vesselPlanningAttachmentsRepository.create({ ...data, planUuid });
  },

  async deleteAttachment(attUuid: string) {
    return vesselPlanningAttachmentsRepository.softDelete(attUuid);
  },

  async updateReliever(planUuid: string, relieverData: {
    relieverCrewUuid: string;
    relieverSignOnDate?: string;
    joiningPortUuid?: string;
    joiningStatus?: string;
  }) {
    return vesselPlanningRepository.update(planUuid, relieverData);
  },

  async findByVesselAndRank(vesselUuid: string, rankId: string) {
    return vesselPlanningRepository.findByVesselAndRank(vesselUuid, rankId);
  },

  /**
   * Handle reliever sign-on: moves crew from Reliever Status to On Board Status
   * When joiningStatus changes to "Signed On":
   * 1. Move relieverCrewUuid to crewUuid (reliever becomes on-board crew)
   * 2. Set signOnDate from relieverSignOnDate
   * 3. Clear reliever fields  
   * 4. Set crewStatus to "primary" for on-board display
   * 5. Update crew_assignments to set isCurrent: true, assignmentType: "OnBoard"
   * 
   * All operations are wrapped in a transaction for consistency.
   */
  async signOnReliever(planUuid: string, data: {
    signOnDate?: string;
    signOnPort?: string;
    contractPeriodMonths?: number;
  }) {
    const db = getDb();
    
    // Get current planning record first (outside transaction for validation)
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }

    if (!planning.relieverCrewUuid) {
      throw new Error("No reliever crew assigned to sign on");
    }

    const relieverCrewUuid = planning.relieverCrewUuid;
    const vesselUuid = planning.vesselUuid;
    const signOnDate = data.signOnDate || planning.relieverSignOnDate || new Date().toISOString().split("T")[0];
    const effectiveContractPeriod = data.contractPeriodMonths || planning.relieverContractPeriodMonths;
    
    // AUTO-CALCULATE RELIEF DUE: signOnDate + contractPeriodMonths (matching V1 logic)
    let calculatedReliefDue: string | null = null;
    if (signOnDate && effectiveContractPeriod) {
      try {
        const signOnDateObj = new Date(signOnDate);
        signOnDateObj.setMonth(signOnDateObj.getMonth() + effectiveContractPeriod);
        calculatedReliefDue = signOnDateObj.toISOString().split('T')[0];
        console.log(`📅 [VESSEL-PLANNING-V2] Auto-calculated reliefDue: ${calculatedReliefDue} (signOnDate: ${signOnDate} + ${effectiveContractPeriod} months)`);
      } catch (calcError) {
        console.warn(`⚠️ [VESSEL-PLANNING-V2] Failed to auto-calculate reliefDue:`, calcError);
      }
    }

    // Execute all operations in a transaction for consistency
    const result = await db.transaction(async (tx) => {
      // 1. Archive old primary crew if exists
      if (planning.crewUuid) {
        await tx
          .update(crewAssignments)
          .set({ 
            isCurrent: false,
            signOffDate: signOnDate,
          })
          .where(
            and(
              eq(crewAssignments.crewUuid, planning.crewUuid),
              eq(crewAssignments.vesselUuid, vesselUuid),
              eq(crewAssignments.isCurrent, true)
            )
          );
      }

      // 2. Update vessel planning: move reliever to primary crew
      const [updated] = await tx
        .update(vesselPlanningV2)
        .set({
          // Move reliever to on-board crew
          crewUuid: relieverCrewUuid,
          crewStatus: "primary", // Explicitly set to primary for on-board
          signOnDate,
          contractPeriodMonths: effectiveContractPeriod,
          reliefDue: calculatedReliefDue, // Auto-calculated from signOnDate + contractPeriodMonths
          // Clear reliever fields
          relieverCrewUuid: null,
          relieverSignOnDate: null,
          relieverContractPeriodMonths: null,
          relieverContractEndRangeStartMonths: null,
          relieverContractEndRangeEndMonths: null,
          // Update status
          joiningStatus: "Signed On",
          joiningPortUuid: data.signOnPort || planning.joiningPortUuid,
          deploymentChecklistCompleted: false,
          applicableDocsChecked: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(vesselPlanningV2.planUuid, planUuid))
        .returning();

      // 3. Update crew_assignments: target only the specific "Planned" assignment
      // Filter by isCurrent=false and assignmentType="Planned" to avoid updating old/wrong records
      await tx
        .update(crewAssignments)
        .set({ 
          isCurrent: true,
          assignmentType: "OnBoard",
          signOnDate,
        })
        .where(
          and(
            eq(crewAssignments.crewUuid, relieverCrewUuid),
            eq(crewAssignments.vesselUuid, vesselUuid),
            eq(crewAssignments.isCurrent, false),
            eq(crewAssignments.assignmentType, "Planned")
          )
        );

      return updated;
    });

    return result;
  },

  /**
   * Update reliever status without signing on
   * For status changes: Planned -> Confirmed -> In Transit
   */
  async updateRelieverStatus(planUuid: string, joiningStatus: string, updateData?: {
    relieverSignOnDate?: string;
    joiningPortUuid?: string;
    relieverContractPeriodMonths?: number;
  }) {
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }

    return vesselPlanningRepository.update(planUuid, {
      joiningStatus,
      ...updateData,
    });
  },
};
