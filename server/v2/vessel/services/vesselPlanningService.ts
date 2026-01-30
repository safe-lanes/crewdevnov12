import { vesselPlanningRepository, vesselPlanningAttachmentsRepository } from "../repositories";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { getDb } from "../../db";
import { crewAssignments, crewDocuments, crewVisas, crewLicenses, crewTrainingCourses, crewPreJoiningMedicals } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Calculate document and medical expiry counts for a crew member
 * Same logic as V1's analyzeDocumentExpiry function
 */
async function calculateExpiryCountsForCrew(crewUuid: string | null): Promise<{ docExpiringCount: string; medicalExpiring: string }> {
  if (!crewUuid) {
    return { docExpiringCount: '0/0', medicalExpiring: '-' };
  }
  
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoMonthsFromNow = new Date(today);
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
  
  let expiredDocs = 0;
  let expiringDocs = 0;
  let medicalExpiring = '-';
  
  try {
    // Helper to analyze expiry for any document type
    const analyzeExpiry = (expiry: string | null) => {
      if (!expiry) return;
      const expiryDate = new Date(expiry);
      if (isNaN(expiryDate.getTime())) return;
      expiryDate.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        expiredDocs++;
      } else if (expiryDate <= twoMonthsFromNow) {
        expiringDocs++;
      }
    };
    
    // Fetch and analyze documents (Travel Docs)
    const docs = await db
      .select()
      .from(crewDocuments)
      .where(and(
        eq(crewDocuments.crewUuid, crewUuid),
        eq(crewDocuments.isDeleted, false)
      ));
    for (const doc of docs) {
      analyzeExpiry(doc.expiry);
    }
    
    // Fetch and analyze visas
    const visas = await db
      .select()
      .from(crewVisas)
      .where(and(
        eq(crewVisas.crewUuid, crewUuid),
        eq(crewVisas.isDeleted, false)
      ));
    for (const visa of visas) {
      analyzeExpiry(visa.expiry);
    }
    
    // Fetch and analyze licenses
    const licenses = await db
      .select()
      .from(crewLicenses)
      .where(and(
        eq(crewLicenses.crewUuid, crewUuid),
        eq(crewLicenses.isDeleted, false)
      ));
    for (const lic of licenses) {
      analyzeExpiry(lic.expiry);
    }
    
    // Fetch and analyze training courses
    const training = await db
      .select()
      .from(crewTrainingCourses)
      .where(and(
        eq(crewTrainingCourses.crewUuid, crewUuid),
        eq(crewTrainingCourses.isDeleted, false)
      ));
    for (const t of training) {
      analyzeExpiry(t.expiry);
    }
    
    // Fetch medicals for this crew
    const medicals = await db
      .select()
      .from(crewPreJoiningMedicals)
      .where(and(
        eq(crewPreJoiningMedicals.crewUuid, crewUuid),
        eq(crewPreJoiningMedicals.isDeleted, false)
      ));
    
    // Analyze medical expiry - check most recent medical
    if (medicals.length > 0) {
      // Sort by examination date descending to get most recent
      const sortedMedicals = [...medicals].sort((a: typeof medicals[0], b: typeof medicals[0]) => {
        const dateA = a.examinationDate ? new Date(a.examinationDate).getTime() : 0;
        const dateB = b.examinationDate ? new Date(b.examinationDate).getTime() : 0;
        return dateB - dateA;
      });
      
      const latestMedical = sortedMedicals[0];
      if (latestMedical.expiryDate) {
        const medExpiry = new Date(latestMedical.expiryDate);
        medExpiry.setHours(0, 0, 0, 0);
        
        // Return the actual date in DD-MMM-YYYY format (e.g., 01-Jan-2026)
        // Frontend will compute expiry status from this date
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(medExpiry.getDate()).padStart(2, '0');
        const month = months[medExpiry.getMonth()];
        const year = medExpiry.getFullYear();
        
        medicalExpiring = `${day}-${month}-${year}`;
      }
    }
  } catch (error) {
    console.error(`Error calculating expiry counts for crew ${crewUuid}:`, error);
  }
  
  return {
    docExpiringCount: `${expiringDocs}/${expiredDocs}`,
    medicalExpiring
  };
}

export const vesselPlanningService = {
  async getByVesselUuid(vesselUuid: string) {
    const planningRecords = await vesselPlanningRepository.findByVesselUuid(vesselUuid);
    
    // Enrich each planning record with document/medical expiry counts
    const enrichedRecords = await Promise.all(
      planningRecords.map(async (record: any) => {
        const { docExpiringCount, medicalExpiring } = await calculateExpiryCountsForCrew(record.crewUuid);
        return {
          ...record,
          docExpiringCount,
          medicalExpiring
        };
      })
    );
    
    return enrichedRecords;
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
    const result = await db.transaction(async (tx: typeof db) => {
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
