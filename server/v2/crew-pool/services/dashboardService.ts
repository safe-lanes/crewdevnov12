import { eq, and, or, isNull, sql, aliasedTable } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewMembersV2,
  crewNextOfKin,
  crewPersonalDetails,
  crewSeaService,
  crewLicenses,
  crewAssignments,
} from "../../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { masterVessels, masterNationalities, masterVesselTypes, masterCountries } from "../../../../shared/schema";
import { crewSeaServiceService } from "./crewSeaServiceService";
import { addMonths, format } from "date-fns";

export interface CrewDashboardStatus {
  status: "On Board" | "On Leave" | "Inactive";
  isActive: boolean;
  vessel: string | null;
  joinedDate: string | null;
  sailingDue: string | null;
  nextAvailability: string | null;
  presentAssignment: string | null;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  } | null;
}

export interface CrewDashboardExperience {
  company: number;
  rank: number;
  tankers: number;
  ocw: number;
  endorsements: string;
}

export interface ShipTypeExperienceItem {
  name: string;
  months: number;
  percentage: number;
}

export interface RankExperienceItem {
  rank: string;
  months: number;
  percentage: number;
}

export interface ServiceTimelineItem {
  vessel: string;
  vesselId?: string;
  startDate: string;
  endDate: string | null;
  contractEndDate: string | null;
  rangeEndDate: string | null;
  type: "onBoard" | "planned" | "completed";
  appraisalIds?: number[];
  handoverIds?: number[];
}

export interface ComplianceItem {
  category: string;
  status: "valid" | "expiring" | "expired" | "missing";
  details: string;
}

export interface CareerProgressionItem {
  position: string;
  date?: string;
  status: "completed" | "current" | "upcoming";
}

export interface AppraisalSummaryItem {
  year: number;
  score: number;
}

export interface SeaServiceRecord {
  id: string;
  vesselName: string;
  vesselType: string;
  deadweight: string;
  engineType: string;
  enginePower: string;
  fromDate: string;
  toDate: string;
  period: string;
  rank: string;
}

export interface CrewDashboardSummary {
  status: CrewDashboardStatus;
  experience: CrewDashboardExperience;
  shipTypes: {
    items: ShipTypeExperienceItem[];
    totalMonths: number;
    totalYears: number;
  };
  rankExperience: {
    items: RankExperienceItem[];
    totalMonths: number;
    totalYears: number;
  };
  rankExperienceByVesselType: Record<string, number>;
  serviceTimeline: ServiceTimelineItem[];
  compliance: ComplianceItem[];
  licenses: any[];
  seaService: SeaServiceRecord[];
  careerProgression: CareerProgressionItem[];
  appraisals: AppraisalSummaryItem[];
}

export const dashboardService = {
  async getDashboardSummary(crewUuid: string): Promise<CrewDashboardSummary | null> {
    const db = getDb();

    const crew = await this.getCrewMember(crewUuid);
    if (!crew) return null;

    const nextOfKin = await this.getNextOfKin(crewUuid);
    const personalDetails = await this.getPersonalDetails(crewUuid);
    const seaService = await this.getSeaService(crewUuid);
    const licenses = await this.getLicenses(crewUuid);
    const assignments = await this.getActiveAssignments(crewUuid);
    const vesselPlanning = await this.getVesselPlanningForCrew(crewUuid);

    const companySeaService = seaService.filter((s: any) => s.serviceType === "company");
    const externalSeaService = seaService.filter((s: any) => s.serviceType === "external");

    const currentRank = crew.presentRank || "";

    const experience = this.calculateExperience(
      companySeaService,
      externalSeaService,
      currentRank
    );
    const shipTypeData = this.calculateShipTypeExperience(
      companySeaService,
      externalSeaService
    );
    const rankData = this.calculateRankExperience(
      companySeaService,
      externalSeaService
    );
    const endorsementCode = this.deriveEndorsementCode(currentRank, licenses);

    const hasActiveAssignment = assignments.length > 0;
    const primaryAssignment = assignments.find((a: any) => a.isCurrent) || assignments[0];

    const isActive = crew.isActive !== false;
    const calculatedStatus: "On Board" | "On Leave" | "Inactive" = isActive
      ? hasActiveAssignment
        ? "On Board"
        : "On Leave"
      : "Inactive";

    const serviceTimeline = this.buildServiceTimeline(companySeaService, externalSeaService, vesselPlanning, crewUuid);

    return {
      status: {
        status: calculatedStatus,
        isActive,
        vessel: hasActiveAssignment ? primaryAssignment?.vesselName : null,
        joinedDate: hasActiveAssignment
          ? this.formatDate(primaryAssignment?.signOnDate)
          : null,
        sailingDue: hasActiveAssignment
          ? this.formatDate(primaryAssignment?.reliefDue)
          : null,
        nextAvailability: this.formatDate(crew.nextAvailability || personalDetails?.nextAvailability),
        presentAssignment: primaryAssignment?.vesselImo || primaryAssignment?.vesselName || null,
        emergencyContact: nextOfKin
          ? {
              name: `${nextOfKin.firstName || ""}${
                nextOfKin.familyName ? " " + nextOfKin.familyName : ""
              }`.trim(),
              relation: nextOfKin.relationship || "",
              phone: nextOfKin.telephone || "",
            }
          : null,
      },
      experience: {
        company: experience.company,
        rank: experience.rank,
        tankers: experience.tankers,
        ocw: experience.oow,
        endorsements: endorsementCode,
      },
      shipTypes: {
        items: shipTypeData.items,
        totalMonths: shipTypeData.totalMonths,
        totalYears: Math.round((shipTypeData.totalMonths / 12) * 10) / 10,
      },
      rankExperience: {
        items: rankData.items,
        totalMonths: rankData.totalMonths,
        totalYears: Math.round((rankData.totalMonths / 12) * 10) / 10,
      },
      rankExperienceByVesselType: this.calculateRankExperienceByVesselType(
        companySeaService,
        externalSeaService,
        currentRank
      ),
      serviceTimeline,
      compliance: this.getComplianceStatus(crew, licenses),
      licenses: licenses,
      seaService: companySeaService.map((s: any) => {
        const etpParts = s.engineTypePower ? s.engineTypePower.split('/').map((p: string) => p.trim()) : ['', ''];
        return {
          id: s.seaUuid,
          vesselName: s.vesselName || '',
          vesselType: s.vesselTypeName || '',
          deadweight: s.deadweight || '',
          engineType: etpParts[0] || '',
          enginePower: etpParts[1] || '',
          fromDate: s.fromDate ? this.formatDate(s.fromDate) : '',
          toDate: s.toDate ? this.formatDate(s.toDate) : '',
          period: s.periodMonths != null ? String(s.periodMonths) : '',
          rank: s.rank || '',
        };
      }),
      careerProgression: [],
      appraisals: [],
    };
  },

  async getCrewMember(crewUuid: string) {
    const db = getDb();
    const result = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        empNo: crewMembersV2.empNo,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
        presentRank: crewMembersV2.presentRank,
        isActive: crewMembersV2.isActive,
        status: crewMembersV2.status,
        nextAvailability: crewMembersV2.nextAvailability,
        nationalityName: masterNationalities.nationality,
      })
      .from(crewMembersV2)
      .leftJoin(
        masterNationalities,
        eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid)
      )
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .limit(1);

    return result[0] || null;
  },

  async getNextOfKin(crewUuid: string) {
    const db = getDb();
    const result = await db
      .select()
      .from(crewNextOfKin)
      .where(
        and(
          eq(crewNextOfKin.crewUuid, crewUuid),
          eq(crewNextOfKin.isDeleted, false)
        )
      )
      .limit(1);

    return result[0] || null;
  },

  async getPersonalDetails(crewUuid: string) {
    const db = getDb();
    const result = await db
      .select()
      .from(crewPersonalDetails)
      .where(
        and(
          eq(crewPersonalDetails.crewUuid, crewUuid),
          eq(crewPersonalDetails.isDeleted, false)
        )
      )
      .limit(1);

    return result[0] || null;
  },

  async getSeaService(crewUuid: string) {
    const db = getDb();
    const mvtByUuid = masterVesselTypes;
    const mvtByName = aliasedTable(masterVesselTypes, "mvt_by_name");

    const result = await db
      .select({
        seaUuid: crewSeaService.seaUuid,
        serviceType: crewSeaService.serviceType,
        vesselName: crewSeaService.vesselName,
        vesselUuid: crewSeaService.vesselUuid,
        vesselTypeUuid: crewSeaService.vesselTypeUuid,
        vesselTypeName: sql<string>`COALESCE(${mvtByUuid.vesselType}, ${mvtByName.vesselType})`,
        isTanker: sql<boolean>`COALESCE(${mvtByUuid.tanker}, ${mvtByName.tanker})`,
        isOilTanker: sql<boolean>`COALESCE(${mvtByUuid.oilTanker}, ${mvtByName.oilTanker})`,
        isGasTanker: sql<boolean>`COALESCE(${mvtByUuid.gasTanker}, ${mvtByName.gasTanker})`,
        isChemicalTanker: sql<boolean>`COALESCE(${mvtByUuid.chemicalTanker}, ${mvtByName.chemicalTanker})`,
        rank: crewSeaService.rank,
        fromDate: crewSeaService.fromDate,
        toDate: crewSeaService.toDate,
        periodMonths: crewSeaService.periodMonths,
        deadweight: crewSeaService.deadweight,
        engineTypePower: crewSeaService.engineTypePower,
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
          eq(crewSeaService.crewUuid, crewUuid),
          eq(crewSeaService.isDeleted, false)
        )
      )
      .orderBy(crewSeaService.fromDate);

    return result;
  },

  async getLicenses(crewUuid: string) {
    const db = getDb();
    const result = await db
      .select({
        licUuid: crewLicenses.licUuid,
        licenseId: crewLicenses.licenseId,
        certificateDocument: crewLicenses.certificateDocument,
        abbr: crewLicenses.abbr,
        expiry: crewLicenses.expiry,
        issuingCountryName: masterCountries.countryName,
      })
      .from(crewLicenses)
      .leftJoin(
        masterCountries,
        eq(crewLicenses.issuingCountryUuid, masterCountries.countryUuid)
      )
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false),
          isNull(crewLicenses.archivedAt)
        )
      )
      .orderBy(crewLicenses.expiry);

    return result;
  },

  async getActiveAssignments(crewUuid: string) {
    const db = getDb();
    const result = await db
      .select({
        assignUuid: crewAssignments.assignUuid,
        vesselUuid: crewAssignments.vesselUuid,
        vesselName: masterVessels.vessel,
        vesselImo: masterVessels.imoNumber,
        isCurrent: crewAssignments.isCurrent,
        signOnDate: crewAssignments.signOnDate,
        signOffDate: crewAssignments.signOffDate,
        reliefDue: crewAssignments.reliefDue,
      })
      .from(crewAssignments)
      .leftJoin(
        masterVessels,
        eq(crewAssignments.vesselUuid, masterVessels.vesselUuid)
      )
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isDeleted, false),
          eq(crewAssignments.isCurrent, true),
          isNull(crewAssignments.signOffDate)
        )
      )
      .orderBy(crewAssignments.signOnDate);

    return result;
  },

  async getVesselPlanningForCrew(crewUuid: string) {
    const db = getDb();
    const result = await db
      .select({
        planUuid: vesselPlanningV2.planUuid,
        vesselUuid: vesselPlanningV2.vesselUuid,
        vesselName: masterVessels.vessel,
        crewUuid: vesselPlanningV2.crewUuid,
        relieverCrewUuid: vesselPlanningV2.relieverCrewUuid,
        signOnDate: vesselPlanningV2.signOnDate,
        signOffDate: vesselPlanningV2.signOffDate,
        reliefDue: vesselPlanningV2.reliefDue,
        relieverSignOnDate: vesselPlanningV2.relieverSignOnDate,
        contractPeriodMonths: vesselPlanningV2.contractPeriodMonths,
        contractEndRangeStartMonths: vesselPlanningV2.contractEndRangeStartMonths,
        contractEndRangeEndMonths: vesselPlanningV2.contractEndRangeEndMonths,
        relieverContractPeriodMonths: vesselPlanningV2.relieverContractPeriodMonths,
        relieverContractEndRangeStartMonths: vesselPlanningV2.relieverContractEndRangeStartMonths,
        relieverContractEndRangeEndMonths: vesselPlanningV2.relieverContractEndRangeEndMonths,
        joiningStatus: vesselPlanningV2.joiningStatus,
      })
      .from(vesselPlanningV2)
      .leftJoin(
        masterVessels,
        eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid)
      )
      .where(
        and(
          or(
            and(
              eq(vesselPlanningV2.crewUuid, crewUuid),
              eq(vesselPlanningV2.isArchived, false)
            ),
            and(
              eq(vesselPlanningV2.relieverCrewUuid, crewUuid),
              eq(vesselPlanningV2.isRelieverArchived, false)
            )
          ),
          eq(vesselPlanningV2.isDeleted, false)
        )
      )
      .orderBy(vesselPlanningV2.signOnDate);

    return result;
  },

  calculateExperience(
    companyService: any[],
    externalService: any[],
    currentRank: string
  ) {
    let rankMonths = 0;
    let tankerMonths = 0;
    let oowMonths = 0;

    const OOW_RANKS = new Set([
      "chief officer", "c/o", "first mate", "1st mate", "first officer", "1st officer",
      "2nd officer", "second officer", "2/o",
      "3rd officer", "third officer", "3/o",
      "2nd engineer", "second engineer", "2/e",
      "3rd engineer", "third engineer", "3/e",
      "4th engineer", "fourth engineer", "4/e",
      "junior officer", "jr. officer", "jr officer",
    ]);

    const allService = [...companyService, ...externalService];

    // V1 matching: Company (Yrs) = Calendar time from earliest company sea service "from" date to today
    // This is tenure-based, not accumulated months
    let companyYears = 0;
    if (companyService.length > 0) {
      const fromDates = companyService
        .map((s) => s.fromDate)
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
        // Ensure any positive company tenure shows at least 0.1 years
        const roundedYears = Math.round(diffYears * 10) / 10;
        companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
      }
    }

    for (const record of allService) {
      const months =
        parseFloat(record.periodMonths || "0") ||
        crewSeaServiceService.calculatePeriodMonths(record.fromDate, record.toDate);

      if (record.rank === currentRank) {
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

    // Convert months to years (matching V1 behavior) with one decimal place
    return {
      company: companyYears,
      rank: Math.round((rankMonths / 12) * 10) / 10,
      tankers: Math.round((tankerMonths / 12) * 10) / 10,
      oow: Math.round((oowMonths / 12) * 10) / 10,
    };
  },

  calculateShipTypeExperience(companyService: any[], externalService: any[]) {
    const allService = [...companyService, ...externalService];
    const shipTypeMap = new Map<string, number>();
    let totalMonths = 0;

    for (const record of allService) {
      const months =
        parseFloat(record.periodMonths || "0") ||
        crewSeaServiceService.calculatePeriodMonths(record.fromDate, record.toDate);
      const vesselType = record.vesselTypeName || "Unknown";

      shipTypeMap.set(vesselType, (shipTypeMap.get(vesselType) || 0) + months);
      totalMonths += months;
    }

    const items = Array.from(shipTypeMap.entries())
      .map(([name, months]) => ({
        name,
        label: name,
        months: Math.round(months),
        years: Math.round(months / 12 * 10) / 10,
        percentage: totalMonths > 0 ? Math.round((months / totalMonths) * 100) : 0,
      }))
      .sort((a, b) => b.months - a.months);

    const totalYears = Math.round(totalMonths / 12 * 10) / 10;
    return { items, totalMonths: Math.round(totalMonths), totalYears };
  },

  calculateRankExperience(companyService: any[], externalService: any[]) {
    const allService = [...companyService, ...externalService];
    const rankMap = new Map<string, number>();
    let totalMonths = 0;

    for (const record of allService) {
      const months =
        parseFloat(record.periodMonths || "0") ||
        crewSeaServiceService.calculatePeriodMonths(record.fromDate, record.toDate);
      const rank = record.rank || "Unknown";

      rankMap.set(rank, (rankMap.get(rank) || 0) + months);
      totalMonths += months;
    }

    const items = Array.from(rankMap.entries())
      .map(([rank, months]) => ({
        rank,
        label: rank,
        months: Math.round(months),
        years: Math.round(months / 12 * 10) / 10,
        percentage: totalMonths > 0 ? Math.round((months / totalMonths) * 100) : 0,
      }))
      .sort((a, b) => b.months - a.months);

    const totalYears = Math.round(totalMonths / 12 * 10) / 10;
    return { items, totalMonths: Math.round(totalMonths), totalYears };
  },

  calculateRankExperienceByVesselType(
    companyService: any[],
    externalService: any[],
    currentRank: string
  ): Record<string, number> {
    const allService = [...companyService, ...externalService];
    const vesselTypeMap: Record<string, number> = {};

    for (const record of allService) {
      if (record.rank !== currentRank) continue;

      const months =
        parseFloat(record.periodMonths || "0") ||
        crewSeaServiceService.calculatePeriodMonths(record.fromDate, record.toDate);
      const vesselType = record.vesselTypeName || "Unknown";

      vesselTypeMap[vesselType] = (vesselTypeMap[vesselType] || 0) + Math.round(months);
    }

    return vesselTypeMap;
  },

  deriveEndorsementCode(currentRank: string, licenses: any[]): string {
    const endorsements: string[] = [];

    for (const license of licenses) {
      const cert = (license.certificateDocument || "").toLowerCase();
      const abbr = (license.abbr || "").toUpperCase();

      if (cert.includes("stcw") || abbr.includes("STCW")) {
        endorsements.push("STCW");
      }
      if (cert.includes("gmdss") || abbr.includes("GMDSS")) {
        endorsements.push("GMDSS");
      }
      if (cert.includes("coc") || abbr.includes("COC")) {
        endorsements.push("COC");
      }
      if (cert.includes("tanker") || abbr.includes("BTOC") || abbr.includes("ATOT")) {
        endorsements.push("Tanker");
      }
      if (cert.includes("dce") || abbr.includes("DC_") || abbr.includes("DCE")) {
        if (cert.includes("oil") || abbr.includes("DC_O")) {
          endorsements.push("DCE Oil");
        }
        if (cert.includes("chem") || abbr.includes("DC_C")) {
          endorsements.push("DCE Chemical");
        }
        if (cert.includes("gas") || abbr.includes("DC_G")) {
          endorsements.push("DCE Gas");
        }
        if (!cert.includes("oil") && !cert.includes("chem") && !cert.includes("gas") && !abbr.includes("DC_O") && !abbr.includes("DC_C") && !abbr.includes("DC_G")) {
          endorsements.push("DCE");
        }
      }
      if (cert.includes("cop") || abbr.includes("COP")) {
        endorsements.push("COP");
      }
    }

    const unique = Array.from(new Set(endorsements));
    return unique.length > 0 ? unique.join(", ") : "";
  },

  buildServiceTimeline(companyService: any[], externalService: any[] = [], vesselPlanning: any[] = [], crewUuid?: string): ServiceTimelineItem[] {
    const allService = [...companyService, ...externalService];
    const today = new Date();
    
    const seaServiceItems: ServiceTimelineItem[] = allService
      .filter((s: any) => s.fromDate)
      .map((s: any) => {
        const startDate = new Date(s.fromDate);
        const endDate = s.toDate ? new Date(s.toDate) : null;
        
        let type: "onBoard" | "planned" | "completed" = "completed";
        if (!endDate || endDate > today) {
          if (startDate > today) {
            type = "planned";
          } else {
            type = "onBoard";
          }
        }
        
        return {
          vessel: s.vesselName || "Unknown",
          vesselId: s.vesselUuid || s.vesselCode || s.vesselTypeUuid || undefined,
          startDate: s.fromDate,
          endDate: s.toDate || null,
          contractEndDate: s.contractEndDate || s.toDate || null,
          rangeEndDate: s.rangeEndDate || null,
          type,
        };
      });

    const planningItems = vesselPlanning
      .filter((p: any) => {
        const isReliever = crewUuid && p.relieverCrewUuid === crewUuid && p.crewUuid !== crewUuid;
        const effectiveSignOn = isReliever ? p.relieverSignOnDate : p.signOnDate;
        return !!effectiveSignOn;
      })
      .map((p: any) => {
        const isReliever = crewUuid && p.relieverCrewUuid === crewUuid && p.crewUuid !== crewUuid;
        const effectiveSignOn = isReliever ? p.relieverSignOnDate : p.signOnDate;
        const effectiveContractMonths = isReliever ? p.relieverContractPeriodMonths : p.contractPeriodMonths;
        const effectiveRangeEndMonths = isReliever ? p.relieverContractEndRangeEndMonths : p.contractEndRangeEndMonths;

        const signOnDate = new Date(effectiveSignOn);
        if (isNaN(signOnDate.getTime())) return null;

        const effectiveSignOff = isReliever ? null : (p.signOffDate || null);
        const signOffDate = effectiveSignOff ? new Date(effectiveSignOff) : null;

        let contractEndDate: string | null = null;
        if (effectiveContractMonths && effectiveSignOn) {
          contractEndDate = format(addMonths(signOnDate, effectiveContractMonths), 'yyyy-MM-dd');
        } else if (p.reliefDue && !isReliever) {
          contractEndDate = p.reliefDue;
        }

        let rangeEndDate: string | null = null;
        if (effectiveRangeEndMonths && effectiveSignOn) {
          rangeEndDate = format(addMonths(signOnDate, effectiveRangeEndMonths), 'yyyy-MM-dd');
        }

        let type: "onBoard" | "planned" | "completed" = "completed";
        if (!signOffDate || signOffDate > today) {
          if (signOnDate > today) {
            type = "planned";
          } else if (p.joiningStatus && p.joiningStatus !== "Signed On") {
            type = "planned";
          } else {
            type = "onBoard";
          }
        }

        return {
          vessel: p.vesselName || "Unknown",
          vesselId: p.vesselUuid || undefined,
          startDate: effectiveSignOn,
          endDate: effectiveSignOff,
          contractEndDate,
          rangeEndDate,
          type,
        };
      })
      .filter((item): item is ServiceTimelineItem => item !== null);

    const merged: ServiceTimelineItem[] = [...seaServiceItems];
    for (const planItem of planningItems) {
      const matchIdx = merged.findIndex((seaItem) => {
        if (!planItem.vesselId || !seaItem.vesselId) return false;
        if (seaItem.vesselId !== planItem.vesselId) return false;
        const seaStart = new Date(seaItem.startDate).getTime();
        const planStart = new Date(planItem.startDate).getTime();
        const seaEnd = seaItem.endDate ? new Date(seaItem.endDate).getTime() : Infinity;
        const planEnd = planItem.endDate ? new Date(planItem.endDate).getTime() : Infinity;
        return seaStart <= planEnd && planStart <= seaEnd;
      });
      if (matchIdx < 0) {
        merged.push(planItem);
      } else {
        if (planItem.contractEndDate) {
          merged[matchIdx].contractEndDate = planItem.contractEndDate;
        }
        if (planItem.rangeEndDate) {
          merged[matchIdx].rangeEndDate = planItem.rangeEndDate;
        }
      }
    }

    return merged.sort((a: ServiceTimelineItem, b: ServiceTimelineItem) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateB.getTime() - dateA.getTime();
    });
  },

  getComplianceStatus(crew: any, licenses: any[]): ComplianceItem[] {
    const compliance: ComplianceItem[] = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const cocLicense = licenses.find(
      (l: any) =>
        (l.certificateDocument || "").toLowerCase().includes("coc") ||
        (l.abbr || "").toUpperCase().includes("COC")
    );

    if (cocLicense) {
      const expiryDate = cocLicense.expiry ? new Date(cocLicense.expiry) : null;
      if (!expiryDate) {
        compliance.push({
          category: "Certificate of Competency",
          status: "valid",
          details: "No expiry date specified",
        });
      } else if (expiryDate < now) {
        compliance.push({
          category: "Certificate of Competency",
          status: "expired",
          details: `Expired on ${this.formatDate(cocLicense.expiry)}`,
        });
      } else if (expiryDate < thirtyDaysFromNow) {
        compliance.push({
          category: "Certificate of Competency",
          status: "expiring",
          details: `Expires on ${this.formatDate(cocLicense.expiry)}`,
        });
      } else {
        compliance.push({
          category: "Certificate of Competency",
          status: "valid",
          details: `Valid until ${this.formatDate(cocLicense.expiry)}`,
        });
      }
    } else {
      compliance.push({
        category: "Certificate of Competency",
        status: "missing",
        details: "No COC on file",
      });
    }

    const stcwLicenses = licenses.filter(
      (l: any) =>
        (l.certificateDocument || "").toLowerCase().includes("stcw") ||
        (l.abbr || "").toUpperCase().includes("STCW")
    );

    if (stcwLicenses.length > 0) {
      const expiredStcw = stcwLicenses.filter((l: any) => {
        const exp = l.expiry ? new Date(l.expiry) : null;
        return exp && exp < now;
      });

      if (expiredStcw.length > 0) {
        compliance.push({
          category: "STCW Certificates",
          status: "expired",
          details: `${expiredStcw.length} expired certificate(s)`,
        });
      } else {
        compliance.push({
          category: "STCW Certificates",
          status: "valid",
          details: `${stcwLicenses.length} certificate(s) on file`,
        });
      }
    } else {
      compliance.push({
        category: "STCW Certificates",
        status: "missing",
        details: "No STCW certificates on file",
      });
    }

    return compliance;
  },

  formatDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, "0");
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  },
};
