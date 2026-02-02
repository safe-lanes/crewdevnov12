import { vesselPlanningRepository, vesselPlanningAttachmentsRepository } from "../repositories";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { getDb } from "../../db";
import { crewAssignments, crewDocuments, crewVisas, crewLicenses, crewTrainingCourses, crewPreJoiningMedicals, crewSeaService, crewPersonalDetails, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, sql, desc } from "drizzle-orm";

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

/**
 * Calculate experience metrics from V2 crew_sea_service table
 * Same logic as V1's calculateExperienceFromSeaService function
 */
async function calculateExperienceMetricsV2(crewUuid: string | null, currentRank: string, signOnDate: string | null): Promise<{
  companyYears: number;
  rankYears: number;
  tankerTypeYears: number;
  allTankersYears: number;
  oowYears: number;
  timeOnBoardMonths: number;
}> {
  if (!crewUuid) {
    return { companyYears: 0, rankYears: 0, tankerTypeYears: 0, allTankersYears: 0, oowYears: 0, timeOnBoardMonths: 0 };
  }
  
  const db = getDb();
  const today = new Date();
  
  try {
    // Fetch all sea service records for this crew
    const seaServices = await db
      .select()
      .from(crewSeaService)
      .where(and(
        eq(crewSeaService.crewUuid, crewUuid),
        eq(crewSeaService.isDeleted, false)
      ));
    
    // Helper function to parse period in months
    const getServicePeriodMonths = (service: any): number => {
      const fromStr = service.fromDate;
      if (!fromStr) return 0;
      
      const from = new Date(fromStr);
      if (isNaN(from.getTime())) return 0;
      
      const toStr = service.toDate;
      let to: Date;
      
      if (toStr) {
        to = new Date(toStr);
        if (isNaN(to.getTime())) {
          // Use stored periodMonths as fallback
          return parseFloat(service.periodMonths) || 0;
        }
      } else {
        // Active contract - use today
        to = today;
      }
      
      const diffMs = to.getTime() - from.getTime();
      return diffMs / (1000 * 60 * 60 * 24 * 30.44); // Convert to months
    };
    
    // Helper to check if vessel type is tanker
    const isTankerVesselType = (vesselType: string | null): boolean => {
      if (!vesselType) return false;
      const tankerTypes = ['tanker', 'oil tanker', 'chemical tanker', 'gas tanker', 'lng', 'lpg', 'product tanker', 'crude oil tanker'];
      return tankerTypes.some(t => vesselType.toLowerCase().includes(t));
    };
    
    // Helper to check if rank is officer
    const isOfficerRank = (rank: string | null): boolean => {
      if (!rank) return false;
      const officerPatterns = ['master', 'chief officer', 'chief mate', '2nd officer', '3rd officer', 
        'chief engineer', '2nd engineer', '3rd engineer', '4th engineer', 'officer', 'oow', 'eto'];
      return officerPatterns.some(p => rank.toLowerCase().includes(p));
    };
    
    // Separate company (serviceType = 'E1') and external (serviceType = 'E2') sea service
    const companySeaService = seaServices.filter((s: typeof seaServices[0]) => s.serviceType === 'E1');
    const allSeaService = seaServices;
    
    // 1. Company (Yrs) - Calendar time from earliest E1 "from" date to today
    let companyYears = 0;
    if (companySeaService.length > 0) {
      const fromDates = companySeaService
        .map((s: typeof seaServices[0]) => s.fromDate)
        .filter((d: string | null): d is string => d !== null && d.trim() !== '')
        .map((d: string) => new Date(d))
        .filter((d: Date) => !isNaN(d.getTime()));
      
      if (fromDates.length > 0) {
        const earliestDate = new Date(Math.min(...fromDates.map((d: Date) => d.getTime())));
        const diffMs = today.getTime() - earliestDate.getTime();
        const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
        const roundedYears = Math.round(diffYears * 10) / 10;
        companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
      }
    }
    
    // 2. Rank (Yrs) - Sum of Period(M) where rank = current rank / 12
    let rankMonths = 0;
    if (currentRank) {
      const normalizedCurrentRank = currentRank.trim().toLowerCase();
      for (const service of allSeaService) {
        if (service.rank && service.rank.trim().toLowerCase() === normalizedCurrentRank) {
          rankMonths += getServicePeriodMonths(service);
        }
      }
    }
    const rankYears = Math.round((rankMonths / 12) * 10) / 10;
    
    // 3. Tanker Type (Yrs) - specific tanker type experience (simplified to all tanker for now)
    // TODO: Match against vessel's specific tanker type
    let tankerTypeMonths = 0;
    for (const service of allSeaService) {
      // Use vesselTypeUuid to look up vessel type - for now, check any tanker type
      if (isTankerVesselType(service.vesselTypeUuid)) {
        tankerTypeMonths += getServicePeriodMonths(service);
      }
    }
    const tankerTypeYears = Math.round((tankerTypeMonths / 12) * 10) / 10;
    
    // 4. All Types (Yrs) - Total tanker experience across all tanker types
    let allTankerMonths = 0;
    for (const service of allSeaService) {
      if (isTankerVesselType(service.vesselTypeUuid)) {
        allTankerMonths += getServicePeriodMonths(service);
      }
    }
    const allTankersYears = Math.round((allTankerMonths / 12) * 10) / 10;
    
    // 5. OOW (Yrs) - Officer of the Watch experience
    let oowMonths = 0;
    for (const service of allSeaService) {
      if (isOfficerRank(service.rank)) {
        oowMonths += getServicePeriodMonths(service);
      }
    }
    const oowYears = Math.round((oowMonths / 12) * 10) / 10;
    
    // 6. Time on Board (months) - from sign-on date to today
    let timeOnBoardMonths = 0;
    if (signOnDate) {
      const signOn = new Date(signOnDate);
      if (!isNaN(signOn.getTime())) {
        const diffMs = today.getTime() - signOn.getTime();
        const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
        timeOnBoardMonths = Math.round(diffMonths * 10) / 10;
        if (timeOnBoardMonths < 0) timeOnBoardMonths = 0;
      }
    }
    
    return {
      companyYears,
      rankYears,
      tankerTypeYears,
      allTankersYears,
      oowYears,
      timeOnBoardMonths
    };
  } catch (error) {
    console.error(`Error calculating experience metrics for crew ${crewUuid}:`, error);
    return { companyYears: 0, rankYears: 0, tankerTypeYears: 0, allTankersYears: 0, oowYears: 0, timeOnBoardMonths: 0 };
  }
}

/**
 * Get certification data from V2 crew_licenses table for Officer Matrix
 */
async function getCertificationsV2(crewUuid: string | null, department: 'deck' | 'engine'): Promise<{
  certComp: string;
  issuingCountry: string;
  tankerCert: string;
  splTankerTraining: string;
  radioQual: boolean;
}> {
  if (!crewUuid) {
    return { certComp: '', issuingCountry: '', tankerCert: '', splTankerTraining: '', radioQual: false };
  }
  
  const db = getDb();
  
  try {
    // Fetch all licenses for this crew
    const licenses = await db
      .select()
      .from(crewLicenses)
      .where(and(
        eq(crewLicenses.crewUuid, crewUuid),
        eq(crewLicenses.isDeleted, false)
      ));
    
    // Fetch training courses for tanker certifications
    const trainingCourses = await db
      .select()
      .from(crewTrainingCourses)
      .where(and(
        eq(crewTrainingCourses.crewUuid, crewUuid),
        eq(crewTrainingCourses.isDeleted, false)
      ));
    
    // Find highest COC (Certificate of Competency)
    const cocPatterns = department === 'deck' 
      ? ['master', 'chief mate', 'chief officer', 'officer of the watch', 'oow', 'second mate', 'third mate']
      : ['chief engineer', 'second engineer', '2nd engineer', 'third engineer', '3rd engineer', 'fourth engineer', '4th engineer', 'electro-technical officer', 'eto'];
    
    // Priority ranking for COCs (higher index = higher priority)
    const cocPriority = department === 'deck'
      ? ['third mate', 'second mate', 'oow', 'officer of the watch', 'chief officer', 'chief mate', 'master']
      : ['fourth engineer', '4th engineer', 'third engineer', '3rd engineer', 'second engineer', '2nd engineer', 'chief engineer', 'electro-technical officer', 'eto'];
    
    let highestCoc: any = null;
    let highestPriority = -1;
    
    for (const license of licenses) {
      const certName = (license.certificateDocument || '').toLowerCase();
      for (let i = 0; i < cocPriority.length; i++) {
        if (certName.includes(cocPriority[i]) && i > highestPriority) {
          highestPriority = i;
          highestCoc = license;
        }
      }
    }
    
    // Derive officerMatrixLabel from highest COC
    let certComp = '';
    if (highestCoc) {
      const certName = (highestCoc.certificateDocument || '').toLowerCase();
      if (certName.includes('master')) certComp = 'Master II/2';
      else if (certName.includes('chief mate') || certName.includes('chief officer')) certComp = 'Chief Mate II/2';
      else if (certName.includes('oow') || certName.includes('officer of the watch')) certComp = 'OOW II/1';
      else if (certName.includes('chief engineer')) certComp = 'Chief Engineer III/2';
      else if (certName.includes('second engineer') || certName.includes('2nd engineer')) certComp = '2nd Engineer III/2';
      else if (certName.includes('third engineer') || certName.includes('3rd engineer')) certComp = '3rd Engineer III/1';
      else if (certName.includes('electro') || certName.includes('eto')) certComp = 'ETO III/6';
    }
    
    // Check for GMDSS (radio qualification)
    const hasGmdss = licenses.some((l: typeof licenses[0]) => {
      const certName = (l.certificateDocument || l.abbr || '').toLowerCase();
      return certName.includes('gmdss') || certName.includes('goc') || certName.includes('general operator');
    });
    
    // Calculate tanker certifications from training courses
    const tankerCertPatterns = ['o(a)', 'c(a)', 'g(a)', 'oil tanker', 'chemical tanker', 'gas tanker'];
    const splTankerPatterns = ['o(b)', 'c(b)', 'g(b)', 'advanced oil', 'advanced chemical', 'advanced gas'];
    
    const tankerCerts: string[] = [];
    const splTankerCerts: string[] = [];
    
    for (const course of trainingCourses) {
      const courseName = (course.trainingCourse || course.abbr || '').toLowerCase();
      for (const pattern of tankerCertPatterns) {
        if (courseName.includes(pattern)) {
          if (pattern.includes('o')) tankerCerts.push('O');
          else if (pattern.includes('c')) tankerCerts.push('C');
          else if (pattern.includes('g')) tankerCerts.push('G');
        }
      }
      for (const pattern of splTankerPatterns) {
        if (courseName.includes(pattern)) {
          if (pattern.includes('o')) splTankerCerts.push('O(A)');
          else if (pattern.includes('c')) splTankerCerts.push('C(A)');
          else if (pattern.includes('g')) splTankerCerts.push('G(A)');
        }
      }
    }
    
    return {
      certComp,
      issuingCountry: highestCoc?.issuingCountryUuid || '',
      tankerCert: Array.from(new Set(tankerCerts)).join(', '),
      splTankerTraining: Array.from(new Set(splTankerCerts)).join(', '),
      radioQual: department === 'deck' && hasGmdss
    };
  } catch (error) {
    console.error(`Error getting certifications for crew ${crewUuid}:`, error);
    return { certComp: '', issuingCountry: '', tankerCert: '', splTankerTraining: '', radioQual: false };
  }
}

/**
 * Get English proficiency from V2 crew_personal_details table
 */
async function getEnglishProficiencyV2(crewUuid: string | null): Promise<string> {
  if (!crewUuid) return '';
  
  const db = getDb();
  
  try {
    const details = await db
      .select()
      .from(crewPersonalDetails)
      .where(and(
        eq(crewPersonalDetails.crewUuid, crewUuid),
        eq(crewPersonalDetails.isDeleted, false)
      ))
      .limit(1);
    
    return details[0]?.englishProficiency || '';
  } catch (error) {
    console.error(`Error getting English proficiency for crew ${crewUuid}:`, error);
    return '';
  }
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

  /**
   * Sign off crew from vessel - updates both vessel_planning_v2 and crew_assignments
   * This should be called instead of just update() when signing off crew
   */
  async signOffCrew(planUuid: string, data: {
    signOffDate: string;
    signOffReason?: string;
    signOffPortUuid?: string;
  }) {
    const db = getDb();
    
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }

    const crewUuid = planning.crewUuid;
    const vesselUuid = planning.vesselUuid;
    
    // Update crew_assignments if we have a crew member
    if (crewUuid && vesselUuid) {
      console.log(`📋 [VESSEL-PLANNING-V2] Updating crew_assignments for sign-off: crewUuid=${crewUuid}, signOffDate=${data.signOffDate}, reason=${data.signOffReason}`);
      
      await db
        .update(crewAssignments)
        .set({
          signOffDate: data.signOffDate,
          reason: data.signOffReason || null,
          isCurrent: false,
          updatedAt: sql`NOW()`,
        })
        .where(
          and(
            eq(crewAssignments.crewUuid, crewUuid),
            eq(crewAssignments.vesselUuid, vesselUuid),
            eq(crewAssignments.isCurrent, true)
          )
        );
    }

    // Update the vessel planning record
    return vesselPlanningRepository.update(planUuid, {
      signOffDate: data.signOffDate,
      signOffReason: data.signOffReason,
      signOffPortUuid: data.signOffPortUuid,
      reliefStatus: "Signed Off",
    });
  },

  async getAttachments(planUuid: string) {
    return vesselPlanningAttachmentsRepository.findByPlanUuid(planUuid);
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
      // Include contractPeriod and reliefDue so Current Assignment columns display in Crew Pool grid
      await tx
        .update(crewAssignments)
        .set({ 
          isCurrent: true,
          assignmentType: "OnBoard",
          signOnDate,
          contractPeriod: effectiveContractPeriod ? String(effectiveContractPeriod) : null,
          reliefDue: calculatedReliefDue,
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

  /**
   * Get Officer Matrix data for a crew member
   * Returns experience metrics, certifications, and English proficiency
   */
  async getOfficerMatrixData(crewUuid: string, currentRank: string, signOnDate: string | null, department: 'deck' | 'engine') {
    const [experienceMetrics, certifications, englishProficiency] = await Promise.all([
      calculateExperienceMetricsV2(crewUuid, currentRank, signOnDate),
      getCertificationsV2(crewUuid, department),
      getEnglishProficiencyV2(crewUuid)
    ]);

    return {
      ...experienceMetrics,
      ...certifications,
      englishProficiency
    };
  },
};
