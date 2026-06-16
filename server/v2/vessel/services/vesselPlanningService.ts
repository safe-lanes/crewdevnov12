import { vesselPlanningRepository, vesselPlanningAttachmentsRepository } from "../repositories";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { getDb } from "../../db";
import { crewAssignments, crewDocuments, crewVisas, crewLicenses, crewTrainingCourses, crewPreJoiningMedicals, crewSeaService, crewPersonalDetails, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterPorts, masterVessels, masterVesselTypes, masterNationalities, masterCountries } from "../../../../shared/schema";
import { admCompanyTrainingsV2, admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import { eq, and, sql, desc, or, isNull, aliasedTable, inArray } from "drizzle-orm";
import { resolveVesselTypeUuid } from "../../crew-pool/services/masterDataResolver";

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

/**
 * Resolve a port value to its UUID
 * Accepts either a UUID or port name, returns the port_uuid
 * This handles legacy data that may contain port names instead of UUIDs
 * 
 * Performance optimization: If the input matches UUID format, return it directly
 * without database validation. Port UUIDs come from port selectors that only
 * return valid UUIDs, and the main issue (port names being stored) is handled
 * by the name lookup fallback. Invalid UUIDs will fail at JOIN time (acceptable).
 */
async function resolvePortToUuid(portValue: string | null | undefined): Promise<string | null> {
  if (!portValue) return null;
  
  // Check if it looks like a UUID - if so, trust it and return immediately
  // This avoids an unnecessary database query for valid UUIDs
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(portValue)) {
    return portValue;
  }
  
  // Not a UUID format - try to find by port name (case-insensitive)
  const db = getDb();
  const byName = await db
    .select({ portUuid: masterPorts.portUuid })
    .from(masterPorts)
    .where(sql`UPPER(${masterPorts.name}) = UPPER(${portValue.trim()})`)
    .limit(1);
  
  if (byName.length > 0) {
    return byName[0].portUuid;
  }
  
  // If nothing found, return null to avoid inserting invalid data
  console.warn(`Could not resolve port value to UUID: ${portValue}`);
  return null;
}

/**
 * Get all planning records for conflict detection in rotation planning
 */
export async function getAllForConflictDetection() {
  return vesselPlanningRepository.findAllForConflictDetection();
}

interface DocExpiryDetail {
  category: 'Travel Docs' | 'Visas' | 'License & DCE' | 'Training';
  name: string;
  expiry: string;
  status: 'expired' | 'expiring';
}

/**
 * Calculate document and medical expiry counts for a crew member
 * Same logic as V1's analyzeDocumentExpiry function
 */
async function calculateExpiryCountsForCrew(crewUuid: string | null): Promise<{ docExpiringCount: string; medicalExpiring: string; docExpiryDetails: DocExpiryDetail[] }> {
  if (!crewUuid) {
    return { docExpiringCount: '0/0', medicalExpiring: '-', docExpiryDetails: [] };
  }
  
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoMonthsFromNow = new Date(today);
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
  
  let expiredDocs = 0;
  let expiringDocs = 0;
  let medicalExpiring = '-';
  const docExpiryDetails: DocExpiryDetail[] = [];

  const formatExpiryDate = (date: Date): string => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = monthNames[date.getMonth()];
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };
  
  try {
    const analyzeExpiry = (expiry: string | null, category: DocExpiryDetail['category'], name: string) => {
      if (!expiry) return;
      const expiryDate = new Date(expiry);
      if (isNaN(expiryDate.getTime())) return;
      expiryDate.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        expiredDocs++;
        docExpiryDetails.push({ category, name: name || 'Unknown', expiry: formatExpiryDate(expiryDate), status: 'expired' });
      } else if (expiryDate <= twoMonthsFromNow) {
        expiringDocs++;
        docExpiryDetails.push({ category, name: name || 'Unknown', expiry: formatExpiryDate(expiryDate), status: 'expiring' });
      }
    };
    
    const docs = await db
      .select()
      .from(crewDocuments)
      .where(and(
        eq(crewDocuments.crewUuid, crewUuid),
        eq(crewDocuments.isDeleted, false)
      ));
    for (const doc of docs) {
      analyzeExpiry(doc.expiry, 'Travel Docs', doc.documentName || '');
    }
    
    const visas = await db
      .select()
      .from(crewVisas)
      .where(and(
        eq(crewVisas.crewUuid, crewUuid),
        eq(crewVisas.isDeleted, false)
      ));
    for (const visa of visas) {
      analyzeExpiry(visa.expiry, 'Visas', visa.visaType || visa.country || '');
    }
    
    const licenses = await db
      .select()
      .from(crewLicenses)
      .where(and(
        eq(crewLicenses.crewUuid, crewUuid),
        eq(crewLicenses.isDeleted, false)
      ));
    for (const lic of licenses) {
      analyzeExpiry(lic.expiry, 'License & DCE', lic.certificateDocument || '');
    }
    
    const training = await db
      .select()
      .from(crewTrainingCourses)
      .where(and(
        eq(crewTrainingCourses.crewUuid, crewUuid),
        eq(crewTrainingCourses.isDeleted, false)
      ));
    for (const t of training) {
      analyzeExpiry(t.expiry, 'Training', t.trainingCourse || '');
    }
    
    const medicals = await db
      .select()
      .from(crewPreJoiningMedicals)
      .where(and(
        eq(crewPreJoiningMedicals.crewUuid, crewUuid),
        eq(crewPreJoiningMedicals.isDeleted, false)
      ));
    
    if (medicals.length > 0) {
      const sortedMedicals = [...medicals].sort((a: typeof medicals[0], b: typeof medicals[0]) => {
        const dateA = a.examinationDate ? new Date(a.examinationDate).getTime() : 0;
        const dateB = b.examinationDate ? new Date(b.examinationDate).getTime() : 0;
        return dateB - dateA;
      });
      
      const latestMedical = sortedMedicals[0];
      if (latestMedical.expiryDate) {
        const medExpiry = new Date(latestMedical.expiryDate);
        medExpiry.setHours(0, 0, 0, 0);
        medicalExpiring = formatExpiryDate(medExpiry);
      }
    }
  } catch (error) {
    console.error(`Error calculating expiry counts for crew ${crewUuid}:`, error);
  }
  
  return {
    docExpiringCount: `${expiringDocs}/${expiredDocs}`,
    medicalExpiring,
    docExpiryDetails
  };
}

/**
 * Tanker category for the assigned vessel. Used to determine which sea-service
 * rows count toward the Officer Matrix "Tanker Type" column.
 */
export type TankerCategory = {
  isOil: boolean;
  isGas: boolean;
  isChemical: boolean;
  isAnyTanker: boolean;
} | null;

/**
 * Resolve the tanker category flags for a given vessel by joining
 * master_vessels -> master_vessel_types. Returns null when the vessel has no
 * tanker affiliation (or vessel/type not found).
 */
export async function getVesselTankerCategory(vesselUuid: string | null | undefined): Promise<TankerCategory> {
  if (!vesselUuid) return null;
  const db = getDb();

  const [vessel] = await db
    .select({ vesselType: masterVessels.vesselType })
    .from(masterVessels)
    .where(eq(masterVessels.vesselUuid, vesselUuid))
    .limit(1);
  if (!vessel?.vesselType) return null;

  const [vt] = await db
    .select({
      isTanker: masterVesselTypes.tanker,
      isOil: masterVesselTypes.oilTanker,
      isGas: masterVesselTypes.gasTanker,
      isChemical: masterVesselTypes.chemicalTanker,
      vesselType: masterVesselTypes.vesselType,
    })
    .from(masterVesselTypes)
    .where(
      and(
        eq(masterVesselTypes.vesselType, vessel.vesselType),
        eq(masterVesselTypes.isDeleted, false),
        eq(masterVesselTypes.isActive, true)
      )
    )
    .limit(1);

  let isOil = !!vt?.isOil;
  let isGas = !!vt?.isGas;
  let isChemical = !!vt?.isChemical;
  let isAnyTanker = !!vt?.isTanker || isOil || isGas || isChemical;

  // Keyword fallback if master flags missing — use the vessel's stored type name.
  if (!isAnyTanker) {
    const name = (vt?.vesselType || vessel.vesselType || '').toLowerCase();
    if (name.includes('lpg') || name.includes('lng') || name.includes('gas')) isGas = true;
    if (name.includes('oil') || name.includes('crude') || name.includes('product')) isOil = true;
    if (name.includes('chemical')) isChemical = true;
    if (name.includes('tanker') || isOil || isGas || isChemical) isAnyTanker = true;
  }

  if (!isAnyTanker) return null;
  return { isOil, isGas, isChemical, isAnyTanker };
}

/**
 * Returns true if a sea-service row matches the assigned vessel's tanker
 * category. Uses master flags first, then a constrained keyword fallback on
 * the vessel-type name.
 */
export function seaServiceMatchesTankerCategory(
  service: {
    isTanker?: boolean | null;
    isOilTanker?: boolean | null;
    isGasTanker?: boolean | null;
    isChemicalTanker?: boolean | null;
    vesselTypeName?: string | null;
    vesselTypeUuid?: string | null;
  },
  category: TankerCategory
): boolean {
  if (!category) return false;

  if (category.isOil && service.isOilTanker === true) return true;
  if (category.isGas && service.isGasTanker === true) return true;
  if (category.isChemical && service.isChemicalTanker === true) return true;

  // Generic tanker (no specific category set on either side)
  const serviceHasAnyFlag =
    service.isOilTanker === true || service.isGasTanker === true || service.isChemicalTanker === true;
  if (
    !serviceHasAnyFlag &&
    !category.isOil &&
    !category.isGas &&
    !category.isChemical &&
    category.isAnyTanker &&
    service.isTanker === true
  ) {
    return true;
  }

  // Keyword fallback when specific category flags are missing on the service
  // (it may be marked as a generic tanker only, with the actual category
  // encoded in the vessel-type name).
  if (!serviceHasAnyFlag) {
    const name = (service.vesselTypeName || service.vesselTypeUuid || '').toLowerCase();
    if (!name) return false;
    if (category.isGas && (name.includes('lpg') || name.includes('lng') || name.includes('gas'))) return true;
    if (category.isOil && (name.includes('oil') || name.includes('crude') || name.includes('product'))) return true;
    if (category.isChemical && name.includes('chemical')) return true;
  }

  return false;
}

/**
 * Returns true if a sea-service row counts as ANY tanker (oil, gas/LPG/LNG,
 * chemical, or generic tanker). Uses master flags first, then a broad
 * keyword fallback on the vessel-type name. Shared by Officer Matrix
 * "All Types" and Compliance "Years on All Tankers" so they cannot drift.
 */
export function seaServiceIsAnyTanker(service: {
  isTanker?: boolean | null;
  isOilTanker?: boolean | null;
  isGasTanker?: boolean | null;
  isChemicalTanker?: boolean | null;
  vesselTypeName?: string | null;
}): boolean {
  if (
    service.isTanker === true ||
    service.isOilTanker === true ||
    service.isGasTanker === true ||
    service.isChemicalTanker === true
  ) {
    return true;
  }

  const name = (service.vesselTypeName || '').toLowerCase();
  if (!name) return false;
  return (
    name.includes('tanker') ||
    name.includes('oil') ||
    name.includes('crude') ||
    name.includes('product') ||
    name.includes('gas') ||
    name.includes('lpg') ||
    name.includes('lng') ||
    name.includes('chemical')
  );
}

/**
 * Calculate experience metrics from V2 crew_sea_service table
 * Same logic as V1's calculateExperienceFromSeaService function
 */
async function calculateExperienceMetricsV2(
  crewUuid: string | null,
  currentRank: string,
  signOnDate: string | null,
  tankerCategory: TankerCategory
): Promise<{
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
    const mvtByUuid = masterVesselTypes;
    const mvtByName = aliasedTable(masterVesselTypes, "mvt_by_name");

    const seaServices = await db
      .select({
        seaUuid: crewSeaService.seaUuid,
        serviceType: crewSeaService.serviceType,
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
      .where(and(
        eq(crewSeaService.crewUuid, crewUuid),
        eq(crewSeaService.isDeleted, false)
      ));
    
    type SeaServiceRow = typeof seaServices[number];

    const getServicePeriodMonths = (service: SeaServiceRow): number => {
      // Stored-first (matches Crew Pool dashboard, Rotation availability, and
      // Compliance Engine): use the persisted periodMonths value whenever it
      // parses to a finite, non-negative number. The form's Period(M) column
      // is read-only auto-calculated, so this is the same 1-decimal value the
      // user sees in the sea-service grid.
      const stored = parseFloat(service.periodMonths || '');
      if (Number.isFinite(stored) && stored >= 0) {
        return stored;
      }

      // Fallback (legacy rows with missing/blank/unparseable periodMonths):
      // recompute from dates. Defensive returns of 0 are limited to the same
      // cases the prior implementation handled: missing/invalid fromDate, or
      // a present-but-invalid toDate. Active contracts (no toDate at all)
      // continue to count up to today.
      const fromStr = service.fromDate;
      if (!fromStr) return 0;

      const from = new Date(fromStr);
      if (isNaN(from.getTime())) return 0;

      const toStr = service.toDate;
      let to: Date;

      if (toStr) {
        to = new Date(toStr);
        if (isNaN(to.getTime())) return 0;
      } else {
        to = today;
      }

      const diffMs = to.getTime() - from.getTime();
      return diffMs / (1000 * 60 * 60 * 24 * 30.44);
    };
    
    const OOW_RANKS = new Set([
      "chief officer", "c/o", "first mate", "1st mate", "first officer", "1st officer",
      "2nd officer", "second officer", "2/o",
      "3rd officer", "third officer", "3/o",
      "2nd engineer", "second engineer", "2/e",
      "3rd engineer", "third engineer", "3/e",
      "4th engineer", "fourth engineer", "4/e",
      "junior officer", "jr. officer", "jr officer",
    ]);
    
    const companySeaService = seaServices.filter((s) => s.serviceType === 'company');
    const allSeaService = seaServices;
    
    let companyYears = 0;
    if (companySeaService.length > 0) {
      const fromDates = companySeaService
        .map((s) => s.fromDate)
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
    
    let rankMonths = 0;
    let tankerTypeMonths = 0;
    let allTankerMonths = 0;
    let oowMonths = 0;

    for (const service of allSeaService) {
      const months = getServicePeriodMonths(service);

      if (currentRank && service.rank && service.rank.trim().toLowerCase() === currentRank.trim().toLowerCase()) {
        rankMonths += months;
      }

      if (seaServiceIsAnyTanker(service)) {
        allTankerMonths += months;
      }

      // "Tanker Type" months: only sea services on the SAME tanker category as
      // the assigned vessel.
      if (tankerCategory && seaServiceMatchesTankerCategory(service, tankerCategory)) {
        tankerTypeMonths += months;
      }

      const rank = (service.rank || "").toLowerCase().trim();
      if (OOW_RANKS.has(rank)) {
        oowMonths += months;
      }
    }

    const rankYears = Math.round((rankMonths / 12) * 10) / 10;
    const tankerTypeYears = Math.round((tankerTypeMonths / 12) * 10) / 10;
    const allTankersYears = Math.round((allTankerMonths / 12) * 10) / 10;
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
/**
 * Officer Matrix COC priority lists (low → high).
 * Highest matching substring wins. Department-scoped so engine COCs are not
 * compared against deck COCs.
 *
 * EXISTING entries (kept in their original relative order — do not reshuffle):
 *   Deck:   third mate, second mate, oow, officer of the watch, chief officer,
 *           chief mate, master.
 *   Engine: fourth engineer, 4th engineer, third engineer, 3rd engineer,
 *           second engineer, 2nd engineer, chief engineer,
 *           electro-technical officer, eto.
 *
 * NEW entries added for ranks previously not matched. Each new pattern only
 * fires on substrings that no currently-recognized cert text contains, so the
 * existing label output for already-matched ranks is preserved.
 */
const COC_PRIORITY_DECK: ReadonlyArray<string> = [
  'third officer',          // NEW — 3rd Officer tier
  'third mate',
  '3rd officer',            // NEW
  '3/o',                    // NEW
  'second officer',         // NEW — 2nd Officer tier
  'second mate',
  '2nd officer',            // NEW
  '2/o',                    // NEW
  'oicnw',                  // NEW — deck OOW alias
  'oic nav watch',          // NEW
  'oow',
  'officer of the watch',
  'chief officer',
  'chief mate',
  'master',
];

const COC_PRIORITY_ENGINE: ReadonlyArray<string> = [
  'fifth engineer',         // NEW — 5th Engineer tier
  '5th engineer',           // NEW
  '5/e',                    // NEW
  'gas engineer',           // NEW — specialty (low priority)
  'fourth engineer',
  '4th engineer',
  '4/e',                    // NEW
  'oicew',                  // NEW — engine OOW (~3rd Eng III/1)
  'oic eng watch',          // NEW
  'eoow',                   // NEW
  'third engineer',
  '3rd engineer',
  '3/e',                    // NEW
  'second engineer',
  '2nd engineer',
  '2/e',                    // NEW
  'chief engineer',
  'electrical officer',     // NEW — distinct from ETO (Electrical Officer III/6)
  'electro-technical officer',
  'eto',
];

export function matchHighestCoc<T extends { certificateDocument: string | null; issuingAuthority?: string | null }>(
  licenses: ReadonlyArray<T>,
  department: 'deck' | 'engine',
): T | null {
  const priority = department === 'deck' ? COC_PRIORITY_DECK : COC_PRIORITY_ENGINE;
  let highest: T | null = null;
  let highestIdx = -1;
  for (const license of licenses) {
    const certName = (license.certificateDocument || '').toLowerCase();
    if (!certName) continue;
    for (let i = 0; i < priority.length; i++) {
      if (i > highestIdx && certName.includes(priority[i])) {
        highestIdx = i;
        highest = license;
      }
    }
  }
  return highest;
}

export function deriveCertCompLabel(
  certificateDocument: string,
  department: 'deck' | 'engine',
): string {
  const certName = (certificateDocument || '').toLowerCase();
  if (!certName) return '';

  // Engine-specific OOW variants must be checked BEFORE the generic deck 'oow'
  // branch below, since "eoow" contains the substring "oow" and would otherwise
  // be mislabelled as a deck OOW. This is the only departure from strict
  // append-only ordering and does not affect any cert text recognized today
  // (eoow / oicew / "oic eng watch" were not matched by the previous matcher).
  if (department === 'engine') {
    if (
      certName.includes('eoow') ||
      certName.includes('oicew') ||
      certName.includes('oic eng watch')
    ) {
      return 'OOW Eng III/1';
    }
  }

  // --- EXISTING branches (do not modify; preserve today's labels exactly) ---
  if (certName.includes('master')) return 'Master II/2';
  if (certName.includes('chief mate') || certName.includes('chief officer')) return 'Chief Mate II/2';
  if (certName.includes('oow') || certName.includes('officer of the watch')) return 'OOW II/1';
  if (certName.includes('chief engineer')) return 'Chief Engineer III/2';
  if (certName.includes('second engineer') || certName.includes('2nd engineer')) return '2nd Engineer III/2';
  if (certName.includes('third engineer') || certName.includes('3rd engineer')) return '3rd Engineer III/1';
  if (certName.includes('electro') || certName.includes('eto')) return 'ETO III/6';

  // --- NEW branches (appended; only fire on substrings the existing branches
  //     above do not catch, so no currently-matched cert is reclassified) ---
  if (
    certName.includes('fourth engineer') ||
    certName.includes('4th engineer') ||
    certName.includes('4/e')
  ) {
    return '4th Engineer III/1';
  }
  if (
    certName.includes('fifth engineer') ||
    certName.includes('5th engineer') ||
    certName.includes('5/e')
  ) {
    return '5th Engineer III/1';
  }
  if (
    certName.includes('second officer') ||
    certName.includes('second mate') ||
    certName.includes('2nd officer') ||
    certName.includes('2/o')
  ) {
    return '2nd Officer II/1';
  }
  if (
    certName.includes('third officer') ||
    certName.includes('third mate') ||
    certName.includes('3rd officer') ||
    certName.includes('3/o')
  ) {
    return '3rd Officer II/1';
  }
  if (certName.includes('oicnw') || certName.includes('oic nav watch')) {
    return 'OOW II/1';
  }
  if (certName.includes('electrical officer')) {
    return 'Electrical Officer III/6';
  }
  if (certName.includes('gas engineer')) {
    return 'Gas Engineer III/1';
  }
  return '';
}

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
    const licenses = await db
      .select({
        licUuid: crewLicenses.licUuid,
        licenseId: crewLicenses.licenseId,
        certificateDocument: crewLicenses.certificateDocument,
        abbr: crewLicenses.abbr,
        expiry: crewLicenses.expiry,
        issuingAuthority: crewLicenses.issuingAuthority,
      })
      .from(crewLicenses)
      .where(and(
        eq(crewLicenses.crewUuid, crewUuid),
        eq(crewLicenses.isDeleted, false),
        isNull(crewLicenses.archivedAt)
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
    const highestCoc = matchHighestCoc(licenses, department);

    // Derive officerMatrixLabel from highest COC
    const certComp = highestCoc
      ? deriveCertCompLabel(highestCoc.certificateDocument || '', department)
      : '';
    
    // Check for GMDSS (radio qualification)
    const hasGmdss = licenses.some((l: typeof licenses[0]) => {
      const certName = (l.certificateDocument || l.abbr || '').toLowerCase();
      return certName.includes('gmdss') || certName.includes('goc') || certName.includes('general operator');
    });
    
    const TANKER_TRAINING_IDS = {
      OIL_BASIC: 'SC001',
      GAS_BASIC: 'SC002',
      OIL_ADVANCED: 'SC003',
      CHEMICAL_ADVANCED: 'SC004',
      GAS_ADVANCED: 'SC005',
      CHEMICAL_BASIC: 'SC008',
    };

    const courseIdToCompanyId = new Map<string, string>();
    const companyTrainings = await db
      .select({ id: admCompanyTrainingsV2.id, companyId: admCompanyTrainingsV2.companyId })
      .from(admCompanyTrainingsV2);
    for (const ct of companyTrainings) {
      if (ct.id && ct.companyId) {
        courseIdToCompanyId.set(String(ct.id), ct.companyId);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validTrainings = {
      oil: { basic: false, advanced: false },
      gas: { basic: false, advanced: false },
      chemical: { basic: false, advanced: false },
    };

    for (const course of trainingCourses) {
      const resolvedCompanyId = course.courseId
        ? (courseIdToCompanyId.get(course.courseId) || course.courseId)
        : null;
      if (!resolvedCompanyId) continue;

      let isValid = true;
      if (course.expiry) {
        try {
          const expiryDate = new Date(course.expiry);
          isValid = expiryDate >= today;
        } catch {
          isValid = true;
        }
      }
      if (!isValid) continue;

      switch (resolvedCompanyId) {
        case TANKER_TRAINING_IDS.OIL_BASIC: validTrainings.oil.basic = true; break;
        case TANKER_TRAINING_IDS.OIL_ADVANCED: validTrainings.oil.advanced = true; break;
        case TANKER_TRAINING_IDS.GAS_BASIC: validTrainings.gas.basic = true; break;
        case TANKER_TRAINING_IDS.GAS_ADVANCED: validTrainings.gas.advanced = true; break;
        case TANKER_TRAINING_IDS.CHEMICAL_BASIC: validTrainings.chemical.basic = true; break;
        case TANKER_TRAINING_IDS.CHEMICAL_ADVANCED: validTrainings.chemical.advanced = true; break;
      }
    }

    const tankerCertParts: string[] = [];
    const splTrainingParts: string[] = [];
    if (validTrainings.oil.advanced || validTrainings.oil.basic) {
      tankerCertParts.push('O');
      splTrainingParts.push(validTrainings.oil.advanced ? 'O(A)' : 'O(B)');
    }
    if (validTrainings.chemical.advanced || validTrainings.chemical.basic) {
      tankerCertParts.push('C');
      splTrainingParts.push(validTrainings.chemical.advanced ? 'C(A)' : 'C(B)');
    }
    if (validTrainings.gas.advanced || validTrainings.gas.basic) {
      tankerCertParts.push('G');
      splTrainingParts.push(validTrainings.gas.advanced ? 'G(A)' : 'G(B)');
    }

    return {
      certComp,
      issuingCountry: highestCoc?.issuingAuthority || '',
      tankerCert: tankerCertParts.join(', '),
      splTankerTraining: splTrainingParts.join(', '),
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
        const { docExpiringCount, medicalExpiring, docExpiryDetails } = await calculateExpiryCountsForCrew(record.crewUuid);
        return {
          ...record,
          docExpiringCount,
          medicalExpiring,
          docExpiryDetails
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

  async create(data: Omit<InsertVesselPlanningV2, "planUuid"> & { auditUserUuid?: string }) {
    // Apply audit user fields
    const auditedData = applyAuditUser(data, true);
    
    // Resolve port values to UUIDs (handles both UUID and port name inputs)
    const resolvedData = { ...auditedData };
    if (auditedData.joiningPortUuid) {
      resolvedData.joiningPortUuid = await resolvePortToUuid(auditedData.joiningPortUuid) || undefined;
    }
    if (auditedData.signOffPortUuid) {
      resolvedData.signOffPortUuid = await resolvePortToUuid(auditedData.signOffPortUuid) || undefined;
    }
    return vesselPlanningRepository.create(resolvedData);
  },

 async update(planUuid: string, data: Partial<InsertVesselPlanningV2> & { auditUserUuid?: string }) {
  const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
  if (!existing) {
    throw new Error(`Planning record not found: ${planUuid}`);
  }

  const auditedData = applyAuditUser(data, false);

  const resolvedData = { ...auditedData };
  if (auditedData.joiningPortUuid) {
    resolvedData.joiningPortUuid = await resolvePortToUuid(auditedData.joiningPortUuid) || undefined;
  }
  if (auditedData.signOffPortUuid) {
    resolvedData.signOffPortUuid = await resolvePortToUuid(auditedData.signOffPortUuid) || undefined;
  }

  if (resolvedData.relieverCrewUuid === null && existing.isArchived && existing.relieverCrewUuid) {
    (resolvedData as any).isRelieverArchived = true;
  }

  const updated = await vesselPlanningRepository.update(planUuid, resolvedData);

  // --- NEW: keep crew_assignments in sync so the Crew Pool dashboard shows correct Relief Due ---
  const db = getDb();

  // resolve effective values (use incoming change, else fall back to existing planning row)
  const effectiveCrewUuid = (resolvedData as any).crewUuid ?? existing.crewUuid;
  const reliefDueChanged = "reliefDue" in resolvedData;
  const contractChanged = "contractPeriodMonths" in resolvedData;

  if (effectiveCrewUuid && (reliefDueChanged || contractChanged)) {
    const effectiveReliefDue = reliefDueChanged ? (resolvedData as any).reliefDue : existing.reliefDue;
    const effectiveContract = contractChanged
      ? (resolvedData as any).contractPeriodMonths
      : existing.contractPeriodMonths;

    await db
      .update(crewAssignments)
      .set({
        reliefDue: effectiveReliefDue ?? null,
        contractPeriod: effectiveContract != null ? String(effectiveContract) : null,
        updatedByUuid: data.auditUserUuid || null,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(crewAssignments.crewUuid, effectiveCrewUuid),
          eq(crewAssignments.vesselUuid, existing.vesselUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.assignmentType, "OnBoard"),
        ),
      );
  }
  return updated;
},

  async archive(planUuid: string, archivedByUuid?: string, auditUserUuid?: string) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    const effectiveAuditUser = auditUserUuid || archivedByUuid;
    if (effectiveAuditUser) {
      await vesselPlanningRepository.update(planUuid, { updatedByUuid: effectiveAuditUser });
    }
    return vesselPlanningRepository.archive(planUuid, archivedByUuid);
  },

  /**
   * Sign off crew from vessel - updates vessel_planning_v2, crew_assignments,
   * archives the primary, and auto-promotes any secondary to primary.
   * All steps run inside a single database transaction.
   */
  async signOffCrew(planUuid: string, data: {
    signOffDate: string;
    signOffReason?: string;
    signOffPortUuid?: string;
    auditUserUuid?: string;
  }) {
    const db = getDb();
    
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }

    const isPrimary = planning.crewStatus === 'primary';
    const crewUuid = planning.crewUuid;
    const vesselUuid = planning.vesselUuid;
    const rankId = planning.rankId;

    const resolvedPortUuid = data.signOffPortUuid 
      ? await resolvePortToUuid(data.signOffPortUuid) 
      : undefined;

    const secondaryCrew = (isPrimary && vesselUuid && rankId)
      ? await vesselPlanningRepository.findSecondaryByVesselAndRank(vesselUuid, rankId, planUuid, planning.rank ?? undefined)
      : null;

    await db.transaction(async (tx) => {
      if (crewUuid && vesselUuid) {
        console.log(`📋 [VESSEL-PLANNING-V2] Sign-off (tx): crewUuid=${crewUuid}, crewStatus=${planning.crewStatus}, signOffDate=${data.signOffDate}`);
        
        await tx
          .update(crewAssignments)
          .set({
            signOffDate: data.signOffDate,
            reason: data.signOffReason || null,
            isCurrent: false,
            updatedAt: sql`NOW()`,
            updatedByUuid: data.auditUserUuid || null,
          })
          .where(
            and(
              eq(crewAssignments.crewUuid, crewUuid),
              eq(crewAssignments.vesselUuid, vesselUuid),
              eq(crewAssignments.isCurrent, true)
            )
          );
      }

      console.log(`📋 [VESSEL-PLANNING-V2] Sign-off + archive ${planning.crewStatus} (tx): planUuid=${planUuid}`);
      await tx
        .update(vesselPlanningV2)
        .set({
          signOffDate: data.signOffDate,
          signOffReason: data.signOffReason,
          signOffPortUuid: resolvedPortUuid,
          reliefStatus: "Signed Off",
          takeOverDate: null,
          takeOverConfirmation: false,
          isArchived: true,
          archivedDate: new Date().toISOString().split("T")[0],
          updatedByUuid: data.auditUserUuid || null,
          updatedAt: new Date(),
        })
        .where(eq(vesselPlanningV2.planUuid, planUuid));

      if (secondaryCrew) {
        console.log(`📋 [VESSEL-PLANNING-V2] Promoting secondary to primary (tx): planUuid=${secondaryCrew.planUuid}`);
        await tx
          .update(vesselPlanningV2)
          .set({
            crewStatus: 'primary',
            updatedByUuid: data.auditUserUuid || null,
            updatedAt: new Date(),
          })
          .where(eq(vesselPlanningV2.planUuid, secondaryCrew.planUuid));
      }
    });

    // E1 Sea Service sync: update toDate on sign-off
    if (crewUuid && vesselUuid) {
      try {
        const db2 = getDb();
        await db2
          .update(crewSeaService)
          .set({
            toDate: data.signOffDate,
            updatedAt: new Date(),
            updatedByUuid: data.auditUserUuid || null,
          })
          .where(
            and(
              eq(crewSeaService.crewUuid, crewUuid),
              eq(crewSeaService.vesselUuid, vesselUuid),
              eq(crewSeaService.serviceType, 'company'),
              eq(crewSeaService.isDeleted, false),
              isNull(crewSeaService.toDate)
            )
          );
        console.log(`✅ [VESSEL-PLANNING-V2] E1 sea service toDate updated for crew ${crewUuid} on vessel ${vesselUuid}`);
      } catch (e1Err) {
        console.warn(`⚠️ [VESSEL-PLANNING-V2] E1 sign-off sync skipped:`, e1Err);
      }
    }

    return vesselPlanningRepository.findByPlanUuid(planUuid);
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
    auditUserUuid?: string;
  }) {
    // Resolve port value to UUID if provided
    const resolvedData: any = { ...relieverData };
    if (relieverData.joiningPortUuid) {
      resolvedData.joiningPortUuid = await resolvePortToUuid(relieverData.joiningPortUuid) || undefined;
    }
    if (relieverData.auditUserUuid) {
      resolvedData.updatedByUuid = relieverData.auditUserUuid;
      delete resolvedData.auditUserUuid;
    }
    return vesselPlanningRepository.update(planUuid, resolvedData);
  },

  async findByVesselAndRank(vesselUuid: string, rankId: string, rank?: string) {
    return vesselPlanningRepository.findByVesselAndRank(vesselUuid, rankId, rank);
  },

  /**
   * Handle reliever sign-on (matching V1 workflow):
   * 
   * CASE A: Primary crew EXISTS → create NEW secondary planning record for reliever.
   *   Both (P) and (S) appear stacked in On Board section.
   *   Primary is NOT archived — that only happens on explicit sign-off.
   *   Secondary becomes primary only via Take Over Confirmation.
   *
   * CASE B: Position is VACANT (no primary crew) → promote reliever directly to primary.
   *   Reliever fields are cleared, reliever becomes on-board primary crew.
   *
   * All operations are wrapped in a transaction for consistency.
   */
  async signOnReliever(planUuid: string, data: {
    signOnDate?: string;
    signOnPort?: string;
    contractPeriodMonths?: number;
    contractEndRangeStartMonths?: number;
    contractEndRangeEndMonths?: number;
    auditUserUuid?: string;
  }) {
    const db = getDb();
    
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }

    if (!planning.relieverCrewUuid) {
      throw new Error("No reliever crew assigned to sign on");
    }

    const relieverCrewUuid = planning.relieverCrewUuid;
    const vesselUuid = planning.vesselUuid;

    // Backend enforcement: same guard as the UI conflict check, so the API
    // rejects duplicates even when called directly. Excludes the current
    // planning row to allow in-place handover.
    const conflict = await vesselPlanningService.checkSignOnConflict(
      relieverCrewUuid,
      vesselUuid,
      planUuid,
    );
    if (conflict.hasConflict) {
      const err: any = new Error(
        `Sign-on conflict: crew member is already actively signed on to vessel ${conflict.conflictVesselName || "another vessel"}. Please sign off from the previous assignment before proceeding.`
      );
      err.code = "SIGN_ON_CONFLICT";
      err.conflict = conflict;
      throw err;
    }

    const signOnDate = data.signOnDate || planning.relieverSignOnDate || new Date().toISOString().split("T")[0];
    const effectiveContractPeriod = data.contractPeriodMonths || planning.relieverContractPeriodMonths;
    const effectiveContractRangeStart = data.contractEndRangeStartMonths ?? planning.relieverContractEndRangeStartMonths;
    const effectiveContractRangeEnd = data.contractEndRangeEndMonths ?? planning.relieverContractEndRangeEndMonths;
    
    const resolvedPortUuid = await resolvePortToUuid(data.signOnPort) || planning.joiningPortUuid;
    
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

    const hasPrimaryCrew = !!planning.crewUuid && !planning.isArchived && !planning.isDeleted;

    const result = await db.transaction(async (tx: typeof db) => {
      if (hasPrimaryCrew) {
        console.log(`🔄 [VESSEL-PLANNING-V2] CASE A: Primary crew exists (${planning.crewUuid}) — creating secondary record for reliever ${relieverCrewUuid}`);

        const existingSecondary = await tx
          .select()
          .from(vesselPlanningV2)
          .where(
            and(
              eq(vesselPlanningV2.vesselUuid, vesselUuid),
              eq(vesselPlanningV2.rankId, planning.rankId),
              eq(vesselPlanningV2.rank, planning.rank),
              eq(vesselPlanningV2.crewStatus, "secondary"),
              eq(vesselPlanningV2.isDeleted, false),
              eq(vesselPlanningV2.isArchived, false)
            )
          );

        if (existingSecondary.length > 0) {
          throw new Error(`A secondary crew member is already assigned to rank ${planning.rank}. Only one secondary crew is allowed per rank.`);
        }

        const { v4: uuidv4 } = await import("uuid");
        const secondaryPlanUuid = uuidv4();
        await tx
          .insert(vesselPlanningV2)
          .values({
            planUuid: secondaryPlanUuid,
            vesselUuid,
            activeRevisionUuid: planning.activeRevisionUuid,
            rankId: planning.rankId,
            rank: planning.rank,
            crewUuid: relieverCrewUuid,
            crewStatus: "secondary",
            signOnDate,
            reliefDue: calculatedReliefDue,
            contractPeriodMonths: effectiveContractPeriod,
            contractEndRangeStartMonths: effectiveContractRangeStart,
            contractEndRangeEndMonths: effectiveContractRangeEnd,
            signOffDate: null,
            signOffPortUuid: null,
            signOffReason: null,
            reliefStatus: null,
            takeOverDate: null,
            takeOverConfirmation: false,
            handOverDate: null,
            relieverCrewUuid: null,
            relieverSignOnDate: null,
            joiningPortUuid: resolvedPortUuid,
            joiningStatus: null,
            relieverContractPeriodMonths: null,
            relieverContractEndRangeStartMonths: null,
            relieverContractEndRangeEndMonths: null,
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false,
            isArchived: false,
            archivedDate: null,
            isDeleted: false,
            isSync: false,
            createdByUuid: data.auditUserUuid || null,
            updatedByUuid: data.auditUserUuid || null,
          });

        console.log(`✅ [VESSEL-PLANNING-V2] Created secondary planning record: ${secondaryPlanUuid}`);

        const [updated] = await tx
          .update(vesselPlanningV2)
          .set({
            relieverCrewUuid: null,
            relieverSignOnDate: null,
            relieverContractPeriodMonths: null,
            relieverContractEndRangeStartMonths: null,
            relieverContractEndRangeEndMonths: null,
            joiningStatus: null,
            joiningPortUuid: null,
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false,
            updatedAt: sql`NOW()`,
            updatedByUuid: data.auditUserUuid || null,
          })
          .where(eq(vesselPlanningV2.planUuid, planUuid))
          .returning();

        await tx
          .update(crewAssignments)
          .set({
            isCurrent: true,
            assignmentType: "OnBoard",
            signOnDate,
            contractPeriod: effectiveContractPeriod ? String(effectiveContractPeriod) : null,
            reliefDue: calculatedReliefDue,
            updatedByUuid: data.auditUserUuid || null,
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
      } else {
        console.log(`🔄 [VESSEL-PLANNING-V2] CASE B: Position vacant — promoting reliever ${relieverCrewUuid} to primary`);

        const [updated] = await tx
          .update(vesselPlanningV2)
          .set({
            crewUuid: relieverCrewUuid,
            crewStatus: "primary",
            signOnDate,
            contractPeriodMonths: effectiveContractPeriod,
            contractEndRangeStartMonths: effectiveContractRangeStart,
            contractEndRangeEndMonths: effectiveContractRangeEnd,
            reliefDue: calculatedReliefDue,
            relieverCrewUuid: null,
            relieverSignOnDate: null,
            relieverContractPeriodMonths: null,
            relieverContractEndRangeStartMonths: null,
            relieverContractEndRangeEndMonths: null,
            joiningStatus: null,
            joiningPortUuid: null,
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false,
            updatedAt: sql`NOW()`,
            updatedByUuid: data.auditUserUuid || null,
          })
          .where(eq(vesselPlanningV2.planUuid, planUuid))
          .returning();

        await tx
          .update(crewAssignments)
          .set({
            isCurrent: true,
            assignmentType: "OnBoard",
            signOnDate,
            contractPeriod: effectiveContractPeriod ? String(effectiveContractPeriod) : null,
            reliefDue: calculatedReliefDue,
            updatedByUuid: data.auditUserUuid || null,
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
      }
    });

    // E1 Sea Service sync: auto-create entry on sign-on
    try {
      const db3 = getDb();
      const finalCrewUuid = relieverCrewUuid;
      const finalSignOnDate = data.signOnDate || planning.relieverSignOnDate || new Date().toISOString().split("T")[0];

      // Resolve vessel info for E1 record
      const [vesselRow] = await db3
        .select({ vesselName: masterVessels.vessel, vesselTypeName: masterVessels.vesselType })
        .from(masterVessels)
        .where(eq(masterVessels.vesselUuid, vesselUuid))
        .limit(1);

      const resolvedVesselName = vesselRow?.vesselName || null;
      const resolvedVesselTypeName = vesselRow?.vesselTypeName || null;
      let resolvedVesselTypeUuid: string | null = null;
      if (resolvedVesselTypeName) {
        resolvedVesselTypeUuid = await resolveVesselTypeUuid(resolvedVesselTypeName);
      }

      // Duplicate check: same crew + vessel + fromDate + company service
      const existing = await db3
        .select({ id: crewSeaService.id })
        .from(crewSeaService)
        .where(
          and(
            eq(crewSeaService.crewUuid, finalCrewUuid),
            eq(crewSeaService.vesselUuid, vesselUuid),
            eq(crewSeaService.fromDate, finalSignOnDate),
            eq(crewSeaService.serviceType, 'company'),
            eq(crewSeaService.isDeleted, false)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`ℹ️ [VESSEL-PLANNING-V2] E1 auto-create skipped: record already exists for crew ${finalCrewUuid} on vessel ${vesselUuid} from ${finalSignOnDate}`);
      } else {
        // Overlap check: crew already has an open (no toDate) company sea service record
        const openRecord = await db3
          .select({ id: crewSeaService.id })
          .from(crewSeaService)
          .where(
            and(
              eq(crewSeaService.crewUuid, finalCrewUuid),
              eq(crewSeaService.serviceType, 'company'),
              eq(crewSeaService.isDeleted, false),
              isNull(crewSeaService.toDate)
            )
          )
          .limit(1);

        if (openRecord.length > 0) {
          console.warn(`⚠️ [VESSEL-PLANNING-V2] E1 auto-create skipped: crew ${finalCrewUuid} already has an open company sea service record (overlapping period)`);
        } else {
          const { v4: uuidv4e1 } = await import("uuid");
          await db3.insert(crewSeaService).values({
            seaUuid: uuidv4e1(),
            crewUuid: finalCrewUuid,
            serviceType: 'company',
            vesselUuid: vesselUuid,
            vesselName: resolvedVesselName,
            vesselTypeUuid: resolvedVesselTypeUuid,
            rank: planning.rank || null,
            fromDate: finalSignOnDate,
            toDate: null,
            isDeleted: false,
            isSync: false,
            createdByUuid: data.auditUserUuid || null,
            updatedByUuid: data.auditUserUuid || null,
          });
          console.log(`✅ [VESSEL-PLANNING-V2] E1 sea service auto-created for crew ${finalCrewUuid} on vessel ${vesselUuid} from ${finalSignOnDate}`);
        }
      }
    } catch (e1Err) {
      console.warn(`⚠️ [VESSEL-PLANNING-V2] E1 sign-on auto-create skipped:`, e1Err);
    }

    // Prior-joining promotion: a prior-joining promotion only takes effect when
    // the promotee signs on. If this crew has an approved prior-joining review
    // pending, complete it now so the rank-propagation engine flips the rank as
    // of the sign-on date. Best-effort — a promotion hiccup must not block the
    // sign-on, but failures are logged at error level so they stay visible.
    try {
      const finalSignOnDate = data.signOnDate || planning.relieverSignOnDate || new Date().toISOString().split("T")[0];
      const { crewMembersService } = await import("../../crew-pool/services/crewMembersService");
      const crew = await crewMembersService.getByUuid(relieverCrewUuid);
      const empNo = crew?.empNo;

      if (empNo) {
        const { PromotionReviewsRepository, ExecutionLedgerRepository } = await import("../../promotions/repositories");
        const reviewsRepo = new PromotionReviewsRepository();
        const ledgerRepo = new ExecutionLedgerRepository();

        const reviews = await reviewsRepo.findByCrewMemberId(empNo);
        const pendingPriorJoining = reviews.find((r) =>
          (r.status ?? "").trim().toLowerCase() === "approved" &&
          (r.promotionTiming ?? "").trim().toLowerCase() === "prior-joining"
        );

        if (pendingPriorJoining) {
          const alreadyApplied = await ledgerRepo.findByReviewUuid(pendingPriorJoining.reviewUuid);
          if (!alreadyApplied) {
            console.log(`🎖️ [VESSEL-PLANNING-V2] Completing prior-joining promotion ${pendingPriorJoining.reviewUuid} for crew ${empNo} on sign-on`);
            const { PromotionReviewsService } = await import("../../promotions/services");
            const reviewsService = new PromotionReviewsService();
            await reviewsService.updateReview(pendingPriorJoining.reviewUuid, {
              status: "completed",
              promotionDate: finalSignOnDate,
              auditUserUuid: data.auditUserUuid,
            });
          }
        }
      }
    } catch (promoErr) {
      console.error(`❌ [VESSEL-PLANNING-V2] Prior-joining promotion completion failed (non-fatal):`, promoErr);
    }

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
    auditUserUuid?: string;
  }) {
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }

    // Resolve port value to UUID if provided (handles both UUID and port name inputs)
    let resolvedData: any = { ...updateData };
    if (updateData?.joiningPortUuid) {
      const resolvedPortUuid = await resolvePortToUuid(updateData.joiningPortUuid);
      resolvedData.joiningPortUuid = resolvedPortUuid || undefined;
    }
    
    // Apply audit user
    if (updateData?.auditUserUuid) {
      resolvedData.updatedByUuid = updateData.auditUserUuid;
      delete resolvedData.auditUserUuid;
    }

    return vesselPlanningRepository.update(planUuid, {
      joiningStatus,
      ...resolvedData,
    });
  },

  /**
   * Get Officer Matrix data for a crew member
   * Returns experience metrics, certifications, and English proficiency
   */
  async checkSignOnConflict(
    crewUuid: string,
    currentVesselUuid: string,
    currentPlanUuid?: string,
  ): Promise<{ hasConflict: boolean; conflictVesselName?: string; conflictVesselUuid?: string }> {
    const db = getDb();
    const { masterVessels } = await import("../../../../shared/schema");

    // 1. Any active OnBoard assignment for this crew (same or different vessel,
    //    any rank) is a conflict. Reliever crew is, by definition, not yet
    //    OnBoard, so this should never match the row being edited.
    const activeAssignments = await db
      .select({
        vesselUuid: crewAssignments.vesselUuid,
        vesselName: masterVessels.vessel,
      })
      .from(crewAssignments)
      .leftJoin(masterVessels, eq(crewAssignments.vesselUuid, masterVessels.vesselUuid))
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.isDeleted, false)
        )
      );

    const conflict = activeAssignments.find(
      (a: { vesselUuid: string | null; vesselName: string | null }) => !!a.vesselUuid
    );

    if (conflict) {
      return {
        hasConflict: true,
        conflictVesselName: conflict.vesselName || "Unknown Vessel",
        conflictVesselUuid: conflict.vesselUuid!,
      };
    }

    // 2. Any active planning row where the crew is primary, or a reliever that
    //    has already progressed to "In Transit" / "Signed On", on any vessel
    //    and any rank, is a conflict. Exclude the planning row currently being
    //    edited so a slot does not conflict with itself (e.g. in-place
    //    handover where this row's relieverCrewUuid equals the crew being
    //    signed on).
    const activePlanning = await db
      .select({
        planUuid: vesselPlanningV2.planUuid,
        vesselUuid: vesselPlanningV2.vesselUuid,
        vesselName: masterVessels.vessel,
        joiningStatus: vesselPlanningV2.joiningStatus,
        crewStatus: vesselPlanningV2.crewStatus,
        crewUuid: vesselPlanningV2.crewUuid,
        relieverCrewUuid: vesselPlanningV2.relieverCrewUuid,
      })
      .from(vesselPlanningV2)
      .leftJoin(masterVessels, eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid))
      .where(
        and(
          or(
            eq(vesselPlanningV2.crewUuid, crewUuid),
            eq(vesselPlanningV2.relieverCrewUuid, crewUuid)
          ),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false)
        )
      );

    const planningConflict = activePlanning.find((p: { planUuid: string; vesselUuid: string; vesselName: string | null; joiningStatus: string | null; crewStatus: string | null; crewUuid: string | null; relieverCrewUuid: string | null }) => {
      if (currentPlanUuid && p.planUuid === currentPlanUuid) return false;
      if (p.crewUuid === crewUuid && (p.crewStatus === "primary" || p.crewStatus === "secondary")) return true;
      if (p.relieverCrewUuid === crewUuid && (p.joiningStatus === "In Transit" || p.joiningStatus === "Signed On")) return true;
      return false;
    });

    if (planningConflict) {
      return {
        hasConflict: true,
        conflictVesselName: planningConflict.vesselName || "Unknown Vessel",
        conflictVesselUuid: planningConflict.vesselUuid,
      };
    }

    return { hasConflict: false };
  },

  async getOfficerMatrixData(
    crewUuid: string,
    currentRank: string,
    signOnDate: string | null,
    department: 'deck' | 'engine',
    vesselUuid: string | null
  ) {
    const tankerCategory = await getVesselTankerCategory(vesselUuid);
    const [experienceMetrics, certifications, englishProficiency] = await Promise.all([
      calculateExperienceMetricsV2(crewUuid, currentRank, signOnDate, tankerCategory),
      getCertificationsV2(crewUuid, department),
      getEnglishProficiencyV2(crewUuid)
    ]);

    return {
      ...experienceMetrics,
      ...certifications,
      englishProficiency
    };
  },

  /**
   * Build the payload consumed by IMO FAL Form 5 (.docx) and US CBP I-418 (.pdf)
   * crew-list generators in the client. Returns vessel header info plus a list
   * of crew members with personal details and a passport-first documents array.
   */
  async getCrewListExportPayload(vesselUuid: string): Promise<{
    vessel: {
      id: number | null;
      vesselUuid: string;
      name: string;
      vesselType: string;
      imoNumber: string;
      flagState: string;
      officialNumber: string;
      callSign: string;
    };
    crewMembers: Array<{
      id: string;
      firstName: string;
      middleName: string;
      familyName: string;
      presentRank: string;
      nationality: string;
      dateOfBirth: string;
      placeOfBirth: string;
      gender: string;
      signOnDate: string;
      documents: string;
    }>;
  }> {
    const db = getDb();

    // 1. Vessel header
    const vesselRows = await db
      .select()
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, vesselUuid))
      .limit(1);

    if (vesselRows.length === 0) {
      throw new Error(`Vessel not found: ${vesselUuid}`);
    }
    const vesselRow = vesselRows[0];

    // 2. All non-archived crew assignments for this vessel, joined with crew core
    //    and nationality name. Personal details (place of birth) are loaded
    //    separately to avoid row-multiplication if a crew has multiple non-deleted
    //    crew_personal_details rows.
    type PlanningRow = {
      crewUuid: string | null;
      rank: string | null;
      signOnDate: string | null;
      createdAt: Date | null;
      firstName: string | null;
      middleName: string | null;
      familyName: string | null;
      gender: string | null;
      dob: string | null;
      nationality: string | null;
    };

    const planningRows: PlanningRow[] = await db
      .select({
        crewUuid: vesselPlanningV2.crewUuid,
        rank: vesselPlanningV2.rank,
        signOnDate: vesselPlanningV2.signOnDate,
        createdAt: vesselPlanningV2.createdAt,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
        gender: crewMembersV2.gender,
        dob: crewMembersV2.dob,
        nationality: masterNationalities.nationality,
      })
      .from(vesselPlanningV2)
      .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false),
          sql`${vesselPlanningV2.crewUuid} IS NOT NULL`
        )
      );

    // 3. Build crewUuid list (typed)
    const crewUuidSet = new Set<string>();
    for (const r of planningRows) {
      if (r.crewUuid) crewUuidSet.add(r.crewUuid);
    }
    const crewUuids: string[] = Array.from(crewUuidSet);

    // 4. Rank ordering map — mirrors the UI's useRankOrdering hook so the
    //    exported document lists crew in the same order as the on-screen table.
    type RankRow = { name: string | null; sortOrder: number | null };
    const rankRows: RankRow[] = await db
      .select({ name: admAvailableRanksV2.name, sortOrder: admAvailableRanksV2.sortOrder })
      .from(admAvailableRanksV2)
      .where(eq(admAvailableRanksV2.isDeleted, false));

    // Mirror of client/src/hooks/useRankNormalization.ts RANK_ALIASES so the
    // server can resolve sort order for ranks stored as display variants
    // (e.g. "2nd Engineer" -> "Second Engineer", "AB" -> "Able Bodied Seaman").
    const RANK_ALIASES: Record<string, string> = {
      "2nd officer": "Second Officer",
      "3rd officer": "Third Officer",
      "2nd engineer": "Second Engineer",
      "3rd engineer": "Third Engineer",
      "4th engineer": "Fourth Engineer",
      "5th engineer": "Fifth Engineer",
      "e/o": "Electrical Officer",
      "e.o": "Electrical Officer",
      "e.o.": "Electrical Officer",
      "eto": "Electrical Officer",
      "elect. officer": "Electrical Officer",
      "boatswain": "Bosun",
      "bosun/boatswain": "Bosun",
      "bo'sun": "Bosun",
      "ch. cook": "Chief Cook",
      "chief steward": "Chief Cook",
      "asst. electrician": "Electrician",
      "assistant electrician": "Electrician",
      "jr. electrician": "Electrician",
      "ab": "Able Bodied Seaman",
      "a/b": "Able Bodied Seaman",
      "a.b": "Able Bodied Seaman",
      "os": "Ordinary Seaman",
      "o/s": "Ordinary Seaman",
      "o.s": "Ordinary Seaman",
    };
    const addRankAliases = (map: Map<string, number>, rankName: string, sortOrder: number): void => {
      map.set(rankName, sortOrder);
      map.set(rankName.toLowerCase(), sortOrder);
      map.set(rankName.toUpperCase(), sortOrder);
      const lowerName = rankName.toLowerCase();
      Object.entries(RANK_ALIASES).forEach(([alias, canonical]) => {
        if (canonical.toLowerCase() === lowerName) {
          map.set(alias, sortOrder);
          map.set(alias.toUpperCase(), sortOrder);
          const titleCase = alias.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          map.set(titleCase, sortOrder);
        }
      });
    };

    const rankOrderMap = new Map<string, number>();
    for (const rr of rankRows) {
      if (!rr.name || rr.sortOrder === null) continue;
      addRankAliases(rankOrderMap, rr.name, rr.sortOrder);
    }
    const getSortOrder = (rankName: string | null | undefined): number => {
      if (!rankName) return 999999;
      if (rankOrderMap.has(rankName)) return rankOrderMap.get(rankName)!;
      const lower = rankName.toLowerCase();
      if (rankOrderMap.has(lower)) return rankOrderMap.get(lower)!;
      const base = rankName.includes("_") ? rankName.split("_")[0] : null;
      if (base) {
        if (rankOrderMap.has(base)) return rankOrderMap.get(base)!;
        const baseLower = base.toLowerCase();
        if (rankOrderMap.has(baseLower)) return rankOrderMap.get(baseLower)!;
      }
      return 999999;
    };

    // Sort planning rows: rank priority first, then suffix (MASTER_2 after MASTER),
    // then createdAt as a final tiebreaker. Same algorithm as the UI's sortCrewByRank.
    planningRows.sort((a, b) => {
      const ao = getSortOrder(a.rank);
      const bo = getSortOrder(b.rank);
      if (ao !== bo) return ao - bo;
      const aSuffix = a.rank?.includes("_") ? parseInt(a.rank.split("_")[1]) || 0 : 0;
      const bSuffix = b.rank?.includes("_") ? parseInt(b.rank.split("_")[1]) || 0 : 0;
      if (aSuffix !== bSuffix) return aSuffix - bSuffix;
      const at = a.createdAt ? a.createdAt.getTime() : 0;
      const bt = b.createdAt ? b.createdAt.getTime() : 0;
      return at - bt;
    });

    // 5. Bulk-load place of birth (city + country name) keyed by crewUuid. We use
    //    the latest non-deleted personal-details row per crew so duplicates in
    //    crew_personal_details cannot multiply downstream rows.
    type PersonalRow = {
      crewUuid: string | null;
      placeOfBirthCity: string | null;
      placeOfBirthCountry: string | null;
      updatedAt: Date | null;
    };
    const placeCountry = aliasedTable(masterCountries, "place_country");
    const personalRows: PersonalRow[] = crewUuids.length === 0 ? [] : await db
      .select({
        crewUuid: crewPersonalDetails.crewUuid,
        placeOfBirthCity: crewPersonalDetails.placeOfBirthCity,
        placeOfBirthCountry: placeCountry.countryName,
        updatedAt: crewPersonalDetails.updatedAt,
      })
      .from(crewPersonalDetails)
      .leftJoin(placeCountry, eq(crewPersonalDetails.placeOfBirthCountryUuid, placeCountry.countryUuid))
      .where(
        and(
          inArray(crewPersonalDetails.crewUuid, crewUuids),
          eq(crewPersonalDetails.isDeleted, false)
        )
      )
      .orderBy(desc(crewPersonalDetails.updatedAt));

    const placeByCrew = new Map<string, string>();
    for (const p of personalRows) {
      if (!p.crewUuid || placeByCrew.has(p.crewUuid)) continue; // keep newest only
      const place = [p.placeOfBirthCity, p.placeOfBirthCountry].filter(Boolean).join(", ");
      placeByCrew.set(p.crewUuid, place);
    }

    // 6. Bulk-load active documents.
    type DocumentRow = {
      crewUuid: string | null;
      documentName: string | null;
      number: string | null;
      issuingAuthority: string | null;
      issuingCountryName: string | null;
      expiry: string | null;
      sortOrder: number | null;
    };
    const issuingCountry = aliasedTable(masterCountries, "issuing_country");
    const documentRows: DocumentRow[] = crewUuids.length === 0 ? [] : await db
      .select({
        crewUuid: crewDocuments.crewUuid,
        documentName: crewDocuments.documentName,
        number: crewDocuments.number,
        issuingAuthority: crewDocuments.issuingAuthority,
        issuingCountryName: issuingCountry.countryName,
        expiry: crewDocuments.expiry,
        sortOrder: crewDocuments.sortOrder,
      })
      .from(crewDocuments)
      .leftJoin(
        issuingCountry,
        eq(crewDocuments.issuingCountryUuid, issuingCountry.countryUuid)
      )
      .where(
        and(
          inArray(crewDocuments.crewUuid, crewUuids),
          eq(crewDocuments.isDeleted, false)
        )
      );

    type DocEntry = {
      document: string;
      number: string;
      issuingAuthority: string;
      expiry: string;
      _sortOrder: number;
    };
    const docsByCrew = new Map<string, DocEntry[]>();

    for (const d of documentRows) {
      if (!d.crewUuid) continue;
      const list = docsByCrew.get(d.crewUuid) || [];
      list.push({
        document: d.documentName || "",
        number: d.number || "",
        // Generators read `issuingAuthority` for the "Issuing State" column;
        // prefer the resolved country name, fall back to the free-text authority field.
        issuingAuthority: d.issuingCountryName || d.issuingAuthority || "",
        expiry: d.expiry || "",
        _sortOrder: d.sortOrder ?? 0,
      });
      docsByCrew.set(d.crewUuid, list);
    }

    // Sort each crew's docs: passport first, seaman's book / CDC / identity next,
    // rest after. Within a bucket, fall back to the document's stored sortOrder
    // so multiple passports / seaman's books stay in their canonical order.
    const docPriority = (name: string): number => {
      const n = (name || "").toLowerCase();
      if (n.includes("passport")) return 0;
      if (n.includes("seaman") || n.includes("cdc") || n.includes("identity")) return 1;
      return 2;
    };
    docsByCrew.forEach((list) => {
      list.sort((a, b) => {
        const pa = docPriority(a.document);
        const pb = docPriority(b.document);
        if (pa !== pb) return pa - pb;
        return a._sortOrder - b._sortOrder;
      });
    });

    // 7. Assemble crew payload — strip rank suffix (`MASTER_2` → `MASTER`).
    const crewMembers = planningRows.map((r) => {
      const placeOfBirth = r.crewUuid ? (placeByCrew.get(r.crewUuid) || "") : "";
      const docs: DocEntry[] = r.crewUuid ? docsByCrew.get(r.crewUuid) || [] : [];
      return {
        id: r.crewUuid || "",
        firstName: r.firstName || "",
        middleName: r.middleName || "",
        familyName: r.familyName || "",
        presentRank: (r.rank || "").split("_")[0] || "",
        nationality: r.nationality || "",
        dateOfBirth: r.dob || "",
        placeOfBirth,
        gender: r.gender || "",
        signOnDate: r.signOnDate || "",
        documents: JSON.stringify(
          docs.map(({ _sortOrder, ...rest }) => rest)
        ),
      };
    });

    return {
      vessel: {
        id: vesselRow.id ?? null,
        vesselUuid: vesselRow.vesselUuid || vesselUuid,
        name: vesselRow.vessel || "",
        vesselType: vesselRow.vesselType || "",
        imoNumber: vesselRow.imoNumber || "",
        // These fields are not stored in master_vessels yet — left blank so the
        // generator renders empty form fields the user can fill in afterwards.
        flagState: "",
        officialNumber: "",
        callSign: "",
      },
      crewMembers,
    };
  },
};
