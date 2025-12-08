import { users, type User, type InsertUser, type Form, type InsertForm, type RankGroup, type InsertRankGroup, type AvailableRank, type InsertAvailableRank, type UpdateAvailableRank, type CrewMember, type InsertCrewMember, type AppraisalResult, type InsertAppraisalResult, type RecruitmentCandidate, type InsertRecruitmentCandidate, type CompanyRank, type InsertCompanyRank, type PromotionHierarchy, type InsertPromotionHierarchy, type CompanyProcessing, type InsertCompanyProcessing, type PromotionForm, type InsertPromotionForm, type DataMaster, type InsertDataMaster, type MasterDataEntry, type InsertMasterDataEntry, type VesselGroup, type InsertVesselGroup, type VesselDraft, type InsertVesselDraft, type VesselRevision, type InsertVesselRevision, type VesselPlanning, type InsertVesselPlanning, type RotationPlan, type InsertRotationPlan, type RotationArchiveEntry, type InsertRotationArchive, type DrugAlcoholTestRecord, type InsertDrugAlcoholTestRecord, type RestHoursVesselRecord, type InsertRestHoursVesselRecord, type RestHoursCrewRecord, type InsertRestHoursCrewRecord, type RestHoursDailyRecord, type InsertRestHoursDailyRecord, type FixedTask, type InsertFixedTask, type VariableTask, type InsertVariableTask, type VesselViolationComment, type InsertVesselViolationComment, type OfficeViolationComment, type InsertOfficeViolationComment, type NCReport, type InsertNCReport, type VesselDateLineAdjustment, type InsertVesselDateLineAdjustment, type CrewDashboardSummary } from "@shared/schema";

// Static vessel mapping for testing/development (MemStorage/PersistentFileStorage)
// In production (DatabaseStorage), vessel codes are fetched from master data
const STATIC_VESSEL_MAPPING: Record<string, string> = {
  "MV Atlantic Explorer": "VSL-001",
  "MV Pacific Voyager": "VSL-002",
  "Nordic Star": "VSL-003",
  "Oceanic Pride": "VSL-004",
  "Harbor Master": "VSL-005",
  "Coastal Guardian": "VSL-006",
};

const STATIC_VESSEL_CODE_TO_NAME: Record<string, string> = {
  "VSL-001": "MV Atlantic Explorer",
  "VSL-002": "MV Pacific Voyager",
  "VSL-003": "Nordic Star",
  "VSL-004": "Oceanic Pride",
  "VSL-005": "Harbor Master",
  "VSL-006": "Coastal Guardian",
};

export function translateVesselCodeToName(vesselCode: string): string {
  const vesselName = STATIC_VESSEL_CODE_TO_NAME[vesselCode];
  if (vesselName) {
    return vesselName;
  }
  return vesselCode;
}

function formatDateForDashboard(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
}

// Experience calculation helper functions
const TANKER_VESSEL_TYPES = [
  'Oil Tanker',
  'Chemical Tanker', 
  'Gas Tanker',
  'LPG Tanker',
  'LNG Tanker',
  'Product Oil Tanker',
  'Crude Oil Tanker',
  'Bitumen/Asphalt Carriers',
  'Oil Chemical Tanker',
  'Shuttle Tankers'
];

const OFFICER_RANK_NAMES = [
  'Master', 'Captain',
  'Chief Officer', 'Chief Mate', 'C/O',
  '2nd Officer', 'Second Officer', '2/O',
  '3rd Officer', 'Third Officer', '3/O',
  'Chief Engineer', 'C/E',
  '2nd Engineer', 'Second Engineer', '2/E',
  '3rd Engineer', 'Third Engineer', '3/E',
  '4th Engineer', 'Fourth Engineer', '4/E',
  'Electrical Officer', 'E/O', 'ETO',
  'Radio Officer', 'R/O'
];

function isTankerVesselType(vesselType: string): boolean {
  if (!vesselType) return false;
  const normalized = vesselType.trim().toLowerCase();
  
  // Keywords that indicate tanker vessels
  const tankerKeywords = ['tanker', 'oil', 'chemical', 'gas', 'lng', 'lpg', 'bitumen', 'asphalt', 'product'];
  
  // Check exact match first
  if (TANKER_VESSEL_TYPES.some(t => t.toLowerCase() === normalized)) {
    return true;
  }
  
  // Check keyword-based matching for variants like "Oil/Chemical Tanker", "Product Tanker", etc.
  return tankerKeywords.some(keyword => normalized.includes(keyword));
}

function isOfficerRank(rankName: string): boolean {
  if (!rankName) return false;
  const normalized = rankName.trim().toLowerCase();
  
  // Keywords that indicate officer ranks (excludes ratings like AB, Oiler, Fitter, Cook, Steward)
  const officerKeywords = ['officer', 'master', 'captain', 'engineer', 'mate', 'eto', 'e/o', 'r/o'];
  
  // Exclusion keywords for non-officer ratings that might have "officer" in title
  const ratingKeywords = ['petty', 'bosun', 'boatswain', 'able', 'ordinary', 'oiler', 'motorman', 'wiper', 
                          'fitter', 'cook', 'steward', 'messman', 'cadet', 'trainee', 'rating'];
  
  // Check exact match first
  if (OFFICER_RANK_NAMES.some(r => r.toLowerCase() === normalized)) {
    return true;
  }
  
  // Check if it's explicitly a rating (exclude)
  if (ratingKeywords.some(keyword => normalized.includes(keyword))) {
    return false;
  }
  
  // Check keyword-based matching for officer ranks
  return officerKeywords.some(keyword => normalized.includes(keyword));
}

function calculateShipTypeExperience(
  companySeaService: any[],
  externalSeaService: any[]
): { shipTypeExperience: Array<{ type: string; label: string; months: number; years: number }>; totalMonths: number } {
  const allSeaService = [...companySeaService, ...externalSeaService];
  
  // Vessel type normalization map
  const vesselTypeNormalization: Record<string, string> = {
    'oil tanker': 'Oil Tkr',
    'product tanker': 'Oil Tkr', 
    'crude oil tanker': 'Oil Tkr',
    'chemical tanker': 'Ch Tkr',
    'oil/chemical tanker': 'Oil/Ch Tkr',
    'oil chemical tanker': 'Oil/Ch Tkr',
    'gas tanker': 'Gas Tkr',
    'lpg tanker': 'Gas Tkr',
    'lng tanker': 'Gas Tkr',
    'bulk carrier': 'Bulk',
    'dry bulk carrier': 'Bulk',
    'bulk': 'Bulk',
    'container ship': 'Container',
    'container': 'Container',
    'general cargo': 'Gen Cargo',
    'ro-ro': 'Ro-Ro',
    'roro': 'Ro-Ro',
    'offshore': 'Offshore',
    'tanker': 'Tanker'
  };
  
  // Aggregate months by normalized vessel type
  const typeMonths: Record<string, number> = {};
  let totalMonths = 0;
  
  for (const service of allSeaService) {
    // Recalculate period from dates, with fallback to stored periodMonths for legacy records
    let period = 0;
    
    if (service.from) {
      const from = new Date(service.from);
      const isActiveContract = !service.to || service.to === '' || service.isActive === true;
      
      if (isActiveContract) {
        // Active contracts: always use today
        const to = new Date();
        if (!isNaN(from.getTime()) && to >= from) {
          const timeDiff = to.getTime() - from.getTime();
          const totalDays = timeDiff / (1000 * 60 * 60 * 24);
          period = Math.max(0, totalDays / 30.44);
        }
      } else if (service.to) {
        // Completed contracts with valid 'to' date: recalculate
        const to = new Date(service.to);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to >= from) {
          const timeDiff = to.getTime() - from.getTime();
          const totalDays = timeDiff / (1000 * 60 * 60 * 24);
          period = Math.max(0, totalDays / 30.44);
        }
      } else {
        // Legacy completed records with no 'to' date: use stored periodMonths
        period = parseFloat(service.periodMonths) || 0;
      }
    }
    
    if (period <= 0) continue;
    
    totalMonths += period;
    
    // Normalize vessel type
    let vesselType = (service.vesselType || '').trim();
    if (!vesselType) continue;
    
    const normalizedType = vesselType.toLowerCase();
    let displayLabel = vesselTypeNormalization[normalizedType] || null;
    
    // If no exact match, try keyword matching
    if (!displayLabel) {
      if (normalizedType.includes('oil') && normalizedType.includes('chemical')) {
        displayLabel = 'Oil/Ch Tkr';
      } else if (normalizedType.includes('oil') || normalizedType.includes('product') || normalizedType.includes('crude')) {
        displayLabel = 'Oil Tkr';
      } else if (normalizedType.includes('chemical')) {
        displayLabel = 'Ch Tkr';
      } else if (normalizedType.includes('gas') || normalizedType.includes('lpg') || normalizedType.includes('lng')) {
        displayLabel = 'Gas Tkr';
      } else if (normalizedType.includes('bulk')) {
        displayLabel = 'Bulk';
      } else if (normalizedType.includes('container')) {
        displayLabel = 'Container';
      } else if (normalizedType.includes('tanker')) {
        displayLabel = 'Tanker';
      } else {
        displayLabel = vesselType; // Use original if no mapping
      }
    }
    
    // Only add to typeMonths if we have a valid display label
    if (displayLabel) {
      typeMonths[displayLabel] = (typeMonths[displayLabel] || 0) + period;
    }
  }
  
  // Convert to array and sort by months descending
  const shipTypeExperience = Object.entries(typeMonths)
    .map(([type, months]) => ({
      type,
      label: type,
      months,
      years: Math.round((months / 12) * 10) / 10
    }))
    .sort((a, b) => b.months - a.months);
  
  return { shipTypeExperience, totalMonths };
}

export function calculateExperienceFromSeaService(
  companySeaService: any[],
  externalSeaService: any[],
  currentRank: string
): { company: number; rank: number; tankers: number; oow: number } {
  // Defensive: ensure inputs are arrays
  const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
  const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
  const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
  
  // 1. Company (Yrs) - Calendar time from earliest E1 "from" date to today
  let companyYears = 0;
  if (safeCompanySeaService.length > 0) {
    const fromDates = safeCompanySeaService
      .map(s => s.from)
      .filter((d: any) => d && d.trim() !== '')
      .map((d: any) => new Date(d))
      .filter((d: any) => !isNaN(d.getTime()));
    
    if (fromDates.length > 0) {
      const earliestDate = new Date(Math.min(...fromDates.map((d: any) => d.getTime())));
      const today = new Date();
      const diffMs = today.getTime() - earliestDate.getTime();
      const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
      companyYears = Math.round(diffYears * 10) / 10;
    }
  }

  // Helper function to get period in months for a service record
  // Recalculate from dates, with fallback to stored periodMonths for legacy records
  const getServicePeriodMonths = (service: any): number => {
    if (!service.from) return 0;
    
    const from = new Date(service.from);
    const isActiveContract = !service.to || service.to === '' || service.isActive === true;
    
    if (isActiveContract) {
      // Active contracts: always use today
      const to = new Date();
      if (!isNaN(from.getTime()) && to >= from) {
        const timeDiff = to.getTime() - from.getTime();
        const totalDays = timeDiff / (1000 * 60 * 60 * 24);
        return Math.max(0, totalDays / 30.44);
      }
    } else if (service.to) {
      // Completed contracts with valid 'to' date: recalculate
      const to = new Date(service.to);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to >= from) {
        const timeDiff = to.getTime() - from.getTime();
        const totalDays = timeDiff / (1000 * 60 * 60 * 24);
        return Math.max(0, totalDays / 30.44);
      }
    } else {
      // Legacy completed records with no 'to' date: use stored periodMonths
      return parseFloat(service.periodMonths) || 0;
    }
    
    return 0;
  };

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

  // 3. Tankers (Yrs) - Sum of Period(M) where vessel type is tanker / 12
  let tankerMonths = 0;
  for (const service of allSeaService) {
    if (isTankerVesselType(service.vesselType)) {
      tankerMonths += getServicePeriodMonths(service);
    }
  }
  const tankerYears = Math.round((tankerMonths / 12) * 10) / 10;

  // 4. OOW (Yrs) - Sum of Period(M) where rank is officer / 12
  let oowMonths = 0;
  for (const service of allSeaService) {
    if (isOfficerRank(service.rank)) {
      oowMonths += getServicePeriodMonths(service);
    }
  }
  const oowYears = Math.round((oowMonths / 12) * 10) / 10;

  return {
    company: companyYears,
    rank: rankYears,
    tankers: tankerYears,
    oow: oowYears
  };
}

/**
 * Calculate experience years on a specific vessel type from sea service records
 * Matches vessel types using keyword matching to handle variations in naming
 */
export function calculateVesselTypeSpecificExperience(
  companySeaService: any[],
  externalSeaService: any[],
  vesselTypeCode: string
): number {
  // Defensive: ensure inputs are arrays
  const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
  const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
  const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
  
  if (!vesselTypeCode) return 0;
  
  // Vessel type code to keywords mapping
  const vesselTypeKeywords: Record<string, string[]> = {
    'OIL_TANKER': ['oil tanker', 'crude oil', 'product oil', 'product tanker'],
    'CHEMICAL_TANKER': ['chemical tanker', 'chem tanker'],
    'GAS_TANKER': ['gas tanker', 'lng', 'lpg'],
    'LNG_TANKER': ['lng', 'lng tanker'],
    'LPG_TANKER': ['lpg', 'lpg tanker'],
    'OIL_CHEMICAL_TANKER': ['oil chemical', 'oil/chemical'],
    'BULK_CARRIER': ['bulk', 'bulk carrier', 'dry bulk'],
    'CONTAINER': ['container'],
    'GENERAL_CARGO': ['general cargo', 'cargo'],
    'RORO': ['ro-ro', 'roro'],
    'OFFSHORE_SUPPORT': ['offshore'],
    'SHUTTLE_TANKERS': ['shuttle']
  };
  
  const keywords = vesselTypeKeywords[vesselTypeCode] || [vesselTypeCode.toLowerCase().replace(/_/g, ' ')];
  
  // Sum months where vessel type matches
  let totalMonths = 0;
  for (const service of allSeaService) {
    const vesselType = (service.vesselType || '').trim().toLowerCase();
    if (!vesselType) continue;
    
    // Check if any keyword matches
    const matches = keywords.some(keyword => vesselType.includes(keyword.toLowerCase()));
    if (matches) {
      const period = parseFloat(service.periodMonths) || 0;
      totalMonths += period;
    }
  }
  
  return Math.round((totalMonths / 12) * 10) / 10;
}

/**
 * Derive endorsement code (O, C, G combinations) based on rank category and licenses held
 * 
 * Mapping by Rank Category:
 * - Senior Officers: L002 (DCE_Oil_Management) → O, L004 (DCE_Chem_Management) → C, L006 (DCE_Gas_Management) → G
 * - Other Officers: L001/L002 → O, L003/L004 → C, L005/L006 → G
 * - Ratings: LIC018 (DCE_Oil_Support) → O, LIC019 (DCE_Chem_Support) → C, LIC020 (DCE_Gas_Support) → G
 */
export function deriveEndorsementCode(
  rankFlags: { seniorOfficer?: boolean | null; officer?: boolean | null; rating?: boolean | null },
  licenses: Array<{ licenseType?: string; licenseId?: string; entryId?: string }>
): string {
  if (!licenses || licenses.length === 0) return '—';
  
  // Extract license IDs from the licenses array
  // Note: License records store their ID in 'entryId' (from Master 016), not 'licenseId'
  const licenseIds = new Set(
    licenses.map(lic => (lic.entryId || lic.licenseId || lic.licenseType || '').toUpperCase())
  );
  
  let hasO = false;
  let hasC = false;
  let hasG = false;
  
  if (rankFlags.seniorOfficer) {
    // Senior Officers - only Management level DCE
    hasO = licenseIds.has('L002') || licenseIds.has('LIC002');
    hasC = licenseIds.has('L004') || licenseIds.has('LIC004');
    hasG = licenseIds.has('L006') || licenseIds.has('LIC006');
  } else if (rankFlags.rating) {
    // Ratings - Support level DCE
    hasO = licenseIds.has('LIC018');
    hasC = licenseIds.has('LIC019');
    hasG = licenseIds.has('LIC020');
  } else if (rankFlags.officer) {
    // Other Officers (not Senior) - Operation OR Management level DCE
    hasO = licenseIds.has('L001') || licenseIds.has('L002') || licenseIds.has('LIC001') || licenseIds.has('LIC002');
    hasC = licenseIds.has('L003') || licenseIds.has('L004') || licenseIds.has('LIC003') || licenseIds.has('LIC004');
    hasG = licenseIds.has('L005') || licenseIds.has('L006') || licenseIds.has('LIC005') || licenseIds.has('LIC006');
  } else {
    // Default: treat as Other Officers (officer flag not explicitly set)
    hasO = licenseIds.has('L001') || licenseIds.has('L002') || licenseIds.has('LIC001') || licenseIds.has('LIC002');
    hasC = licenseIds.has('L003') || licenseIds.has('L004') || licenseIds.has('LIC003') || licenseIds.has('LIC004');
    hasG = licenseIds.has('L005') || licenseIds.has('L006') || licenseIds.has('LIC005') || licenseIds.has('LIC006');
  }
  
  // Build endorsement code string
  let code = '';
  if (hasO) code += 'O';
  if (hasC) code += 'C';
  if (hasG) code += 'G';
  
  return code || '—';
}

//Helper function to translate vessel name to vessel code
// Provides static mapping for storage backends that don't have master data
// Throws error if vessel cannot be translated to enforce data integrity
export function translateVesselNameToCode(vesselName: string): string {
  const staticCode = STATIC_VESSEL_MAPPING[vesselName];
  if (staticCode) {
    return staticCode;
  }
  
  // If already in VSL-XXX format, return it
  if (vesselName && vesselName.match(/^VSL-\d+$/)) {
    return vesselName;
  }
  
  // Fail loudly if vessel cannot be translated
  throw new Error(
    `Cannot translate vessel name "${vesselName}" to canonical vessel code. ` +
    `Vessel must be in STATIC_VESSEL_MAPPING or already in VSL-XXX format. ` +
    `Available vessels: ${Object.keys(STATIC_VESSEL_MAPPING).join(', ')}`
  );
}

/**
 * Build service timeline from sea service records and vessel planning
 * Combines historical sea service with current/planned vessel assignments
 * for the 6-month dashboard timeline display
 * @param companySeaService - Historical sea service records
 * @param vesselPlanningRecords - Current vessel planning where crew is assigned as primary
 * @param appraisalsByVessel - Map of vessel names/IDs to appraisal IDs
 * @param handoversByVessel - Map of vessel names/IDs to handover IDs
 * @param vesselCodeToNameMap - Optional map of vessel codes to names for translation (for DatabaseStorage)
 * @param relieverPlanningRecords - Optional records where crew is assigned as a reliever (for blue planned bars)
 */
export function buildServiceTimeline(
  companySeaService: any[],
  vesselPlanningRecords: any[],
  appraisalsByVessel: Map<string, number[]>,
  handoversByVessel: Map<string, number[]>,
  vesselCodeToNameMap?: Map<string, string>,
  relieverPlanningRecords?: any[]
): Array<{
  vessel: string;
  vesselId?: string;
  startDate: string;
  endDate: string | null;
  contractEndDate: string | null;
  rangeEndDate: string | null;
  type: 'onBoard' | 'planned' | 'completed';
  appraisalIds?: number[];
  handoverIds?: number[];
}> {
  const today = new Date();
  const timelineStart = new Date(today);
  timelineStart.setMonth(today.getMonth() - 2);
  const timelineEnd = new Date(today);
  timelineEnd.setMonth(today.getMonth() + 4);
  
  const timeline: Array<{
    vessel: string;
    vesselId?: string;
    startDate: string;
    endDate: string | null;
    contractEndDate: string | null;
    rangeEndDate: string | null;
    type: 'onBoard' | 'planned' | 'completed';
    appraisalIds?: number[];
    handoverIds?: number[];
  }> = [];
  
  // Process sea service records (completed/historical assignments)
  for (const service of companySeaService) {
    if (!service.from) continue;
    
    const fromDate = new Date(service.from);
    const toDate = service.to ? new Date(service.to) : null;
    
    // Skip if entirely outside the 6-month window
    if (toDate && toDate < timelineStart) continue;
    if (fromDate > timelineEnd) continue;
    
    // Get vessel name - prefer database translation, then provided names, then fallback
    const vesselId = service.vesselId || '';
    let vesselName = service.vesselName || service.vessel || 'Unknown Vessel';
    
    // If we have a vessel ID and a translation map, use the map to get the authoritative name
    if (vesselId && vesselCodeToNameMap && vesselCodeToNameMap.has(vesselId)) {
      vesselName = vesselCodeToNameMap.get(vesselId)!;
    } else if (vesselId && !vesselCodeToNameMap) {
      // Fall back to static translation if no map provided (MemStorage case)
      vesselName = translateVesselCodeToName(vesselId) || vesselName;
    }
    
    timeline.push({
      vessel: vesselName,
      vesselId,
      startDate: service.from,
      endDate: service.to || null,
      contractEndDate: null,
      rangeEndDate: null,
      type: toDate && toDate < today ? 'completed' : 'onBoard',
      appraisalIds: appraisalsByVessel.get(vesselName) || appraisalsByVessel.get(vesselId) || [],
      handoverIds: handoversByVessel.get(vesselName) || handoversByVessel.get(vesselId) || [],
    });
  }
  
  // Process vessel planning records (current/planned assignments)
  for (const planning of vesselPlanningRecords) {
    if (!planning.signOnDate && !planning.joiningDate) continue;
    
    const startDate = planning.signOnDate || planning.joiningDate;
    const fromDate = new Date(startDate);
    
    // Skip if starts after timeline end
    if (fromDate > timelineEnd) continue;
    
    // Determine end date and contract dates
    let endDate: string | null = planning.signOffDate || null;
    let contractEndDate: string | null = null;
    let rangeEndDate: string | null = null;
    
    // Calculate contractEndDate and rangeEndDate from Sign On Date (or Joining Date as fallback)
    // CRITICAL: Prioritize signOnDate over joiningDate because joiningDate may contain
    // the reliever's planned arrival date (stored on primary record for planning purposes)
    // while signOnDate contains the actual on-board crew's sign-on date for timeline calculations
    // This matches the logic in routes.ts for Crew Due/Overdue to ensure both modules are aligned.
    // These define the flexibility window for contract termination:
    // - contractEndDate (Green bar ends): signOnDate + contractEndRangeStartMonths
    // - rangeEndDate (Yellow bar ends): signOnDate + contractEndRangeEndMonths
    // - Red (Overdue): when today > rangeEndDate
    const baseDate = planning.signOnDate || planning.joiningDate;
    
    if (baseDate) {
      const baseDateObj = new Date(baseDate);
      
      if (planning.contractEndRangeStartMonths) {
        // contractEndDate = joiningDate + contractEndRangeStartMonths (Green bar ends here)
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + planning.contractEndRangeStartMonths);
        contractEndDate = contractEnd.toISOString().split('T')[0];
      } else if (planning.contractPeriodMonths) {
        // Fallback: use contractPeriodMonths if no range start is configured
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + planning.contractPeriodMonths);
        contractEndDate = contractEnd.toISOString().split('T')[0];
      } else if (planning.reliefDue) {
        // Last resort: use reliefDue if no other configuration
        contractEndDate = planning.reliefDue;
      }
      
      if (planning.contractEndRangeEndMonths) {
        // rangeEndDate = joiningDate + contractEndRangeEndMonths (Yellow bar ends here)
        const rangeEnd = new Date(baseDateObj);
        rangeEnd.setMonth(rangeEnd.getMonth() + planning.contractEndRangeEndMonths);
        rangeEndDate = rangeEnd.toISOString().split('T')[0];
      } else if (contractEndDate) {
        // If no range end configured, use the same as contractEndDate (no yellow extension)
        rangeEndDate = contractEndDate;
      }
    }
    
    // Determine type based on dates
    let type: 'onBoard' | 'planned' | 'completed' = 'planned';
    if (planning.signOnDate) {
      const signOn = new Date(planning.signOnDate);
      if (signOn <= today) {
        if (planning.signOffDate && new Date(planning.signOffDate) < today) {
          type = 'completed';
        } else {
          type = 'onBoard';
        }
      }
    }
    
    // Get vessel name - always prefer database translation when vesselId is available
    const vesselId = planning.vesselId || '';
    let vesselName = planning.vesselName || 'Unknown Vessel';
    
    // Always translate via the authoritative map if we have a vesselId
    // This ensures we use the latest database vessel names, not stale stored names
    if (vesselId) {
      if (vesselCodeToNameMap && vesselCodeToNameMap.has(vesselId)) {
        vesselName = vesselCodeToNameMap.get(vesselId)!;
      } else if (!vesselCodeToNameMap) {
        // Fall back to static translation if no map provided (MemStorage case)
        vesselName = translateVesselCodeToName(vesselId);
      }
    }
    
    timeline.push({
      vessel: vesselName,
      vesselId,
      startDate,
      endDate,
      contractEndDate,
      rangeEndDate,
      type,
      appraisalIds: appraisalsByVessel.get(vesselName) || appraisalsByVessel.get(vesselId) || [],
      handoverIds: handoversByVessel.get(vesselName) || handoversByVessel.get(vesselId) || [],
    });
  }
  
  // Process reliever planning records - these are records where the crew is assigned as a reliever
  // They should appear as blue "planned" bars showing future assignments
  if (relieverPlanningRecords && relieverPlanningRecords.length > 0) {
    for (const planning of relieverPlanningRecords) {
      // For reliever records, use joiningDate as the start date (this is when the reliever will join)
      const startDate = planning.joiningDate;
      if (!startDate) continue;
      
      const fromDate = new Date(startDate);
      
      // Skip if starts after timeline end
      if (fromDate > timelineEnd) continue;
      
      // Calculate contract end dates based on the reliever's contract period
      // IMPORTANT: Coerce contract period values to numbers since they may come as strings from the database
      let contractEndDate: string | null = null;
      let rangeEndDate: string | null = null;
      
      const baseDateObj = new Date(startDate);
      
      // Helper to safely parse month values (handles string and number types)
      const parseMonths = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const num = typeof val === 'number' ? val : parseInt(String(val), 10);
        return isNaN(num) ? null : num;
      };
      
      const contractEndRangeStartMonths = parseMonths(planning.contractEndRangeStartMonths);
      const contractPeriodMonths = parseMonths(planning.contractPeriodMonths);
      const contractEndRangeEndMonths = parseMonths(planning.contractEndRangeEndMonths);
      
      if (contractEndRangeStartMonths !== null) {
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + contractEndRangeStartMonths);
        contractEndDate = contractEnd.toISOString().split('T')[0];
      } else if (contractPeriodMonths !== null) {
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + contractPeriodMonths);
        contractEndDate = contractEnd.toISOString().split('T')[0];
      }
      
      if (contractEndRangeEndMonths !== null) {
        const rangeEnd = new Date(baseDateObj);
        rangeEnd.setMonth(rangeEnd.getMonth() + contractEndRangeEndMonths);
        rangeEndDate = rangeEnd.toISOString().split('T')[0];
      } else if (contractEndDate) {
        rangeEndDate = contractEndDate;
      }
      
      // For reliever assignments, default end date based on contract period
      let endDate: string | null = rangeEndDate || contractEndDate || null;
      
      // Get vessel name
      const vesselId = planning.vesselId || '';
      let vesselName = planning.vesselName || 'Unknown Vessel';
      
      if (vesselId) {
        if (vesselCodeToNameMap && vesselCodeToNameMap.has(vesselId)) {
          vesselName = vesselCodeToNameMap.get(vesselId)!;
        } else if (!vesselCodeToNameMap) {
          vesselName = translateVesselCodeToName(vesselId);
        }
      }
      
      // Reliever assignments are always type "planned" until they actually sign on
      timeline.push({
        vessel: vesselName,
        vesselId,
        startDate,
        endDate,
        contractEndDate,
        rangeEndDate,
        type: 'planned',
        appraisalIds: [],
        handoverIds: [],
      });
    }
  }
  
  // Deduplicate entries: If both sea_service and vessel_planning have entries for the same vessel
  // with overlapping date ranges, prefer the vessel_planning entry (it has more complete data like 
  // contractEndDate and rangeEndDate). This prevents duplicate bars in the timeline.
  const deduplicatedTimeline: typeof timeline = [];
  const seen = new Set<string>();
  
  // First pass: add entries with vesselId (from vessel_planning) - these have richer data
  for (const entry of timeline) {
    if (entry.vesselId) {
      const key = `${entry.vesselId}_${entry.startDate}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedTimeline.push(entry);
      }
    }
  }
  
  // Second pass: add entries without vesselId (from sea_service) only if not duplicate
  for (const entry of timeline) {
    if (!entry.vesselId) {
      // Check if there's already an entry with the same vessel name and similar start date
      const isDuplicate = deduplicatedTimeline.some(existing => {
        if (existing.vessel !== entry.vessel) return false;
        // Consider duplicates if start dates are within 7 days of each other
        const existingStart = new Date(existing.startDate).getTime();
        const entryStart = new Date(entry.startDate).getTime();
        const daysDiff = Math.abs(existingStart - entryStart) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });
      
      if (!isDuplicate) {
        deduplicatedTimeline.push(entry);
      }
    }
  }
  
  // Sort by start date
  deduplicatedTimeline.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  
  return deduplicatedTimeline;
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getForms(): Promise<Form[]>;
  getForm(id: number): Promise<Form | undefined>;
  createForm(form: InsertForm): Promise<Form>;
  updateForm(id: number, form: Partial<InsertForm>): Promise<Form | undefined>;
  deleteForm(id: number): Promise<boolean>;
  getRankGroups(formId: number): Promise<RankGroup[]>;
  createRankGroup(rankGroup: InsertRankGroup): Promise<RankGroup>;
  updateRankGroup(id: number, rankGroup: Partial<InsertRankGroup>): Promise<RankGroup | undefined>;
  deleteRankGroup(id: number): Promise<boolean>;
  getFormForRank(rankLabel: string, category: string): Promise<Form | undefined>;
  getAvailableRanks(): Promise<AvailableRank[]>;
  createAvailableRank(rank: InsertAvailableRank): Promise<AvailableRank>;
  updateAvailableRank(id: number, rank: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined>;
  deleteAvailableRank(id: number): Promise<boolean>;
  clearAllAvailableRanks(): Promise<boolean>;
  updateRankOrders(rankOrders: Array<{ id: number; sortOrder: number }>): Promise<boolean>;
  // Company Ranks
  getCompanyRanks(): Promise<CompanyRank[]>;
  getCompanyRank(id: string): Promise<CompanyRank | undefined>;
  getCompanyRankByName(rankName: string): Promise<CompanyRank | undefined>;
  createCompanyRank(rank: InsertCompanyRank): Promise<CompanyRank>;
  updateCompanyRank(id: string, rank: Partial<InsertCompanyRank>): Promise<CompanyRank | undefined>;
  deleteCompanyRank(id: string): Promise<boolean>;
  clearAllCompanyRanks(): Promise<boolean>;
  saveAllCompanyRanks(ranks: InsertCompanyRank[]): Promise<CompanyRank[]>;
  // Promotion Hierarchies
  getPromotionHierarchies(): Promise<PromotionHierarchy[]>;
  getPromotionHierarchy(id: number): Promise<PromotionHierarchy | undefined>;
  createPromotionHierarchy(hierarchy: InsertPromotionHierarchy): Promise<PromotionHierarchy>;
  updatePromotionHierarchy(id: number, hierarchy: Partial<InsertPromotionHierarchy>): Promise<PromotionHierarchy | undefined>;
  deletePromotionHierarchy(id: number): Promise<boolean>;
  // Company Processing
  getCompanyProcessingRecords(): Promise<CompanyProcessing[]>;
  getCompanyProcessing(id: number): Promise<CompanyProcessing | undefined>;
  getCompanyProcessingByCandidateId(candidateId: string): Promise<CompanyProcessing[]>;
  createCompanyProcessing(record: InsertCompanyProcessing): Promise<CompanyProcessing>;
  updateCompanyProcessing(id: number, record: Partial<InsertCompanyProcessing>): Promise<CompanyProcessing | undefined>;
  deleteCompanyProcessing(id: number): Promise<boolean>;
  // Promotion Forms
  getPromotionForms(): Promise<PromotionForm[]>;
  getPromotionForm(id: number): Promise<PromotionForm | undefined>;
  getPromotionFormsByCrewMember(crewMemberId: string): Promise<PromotionForm[]>;
  createPromotionForm(form: InsertPromotionForm): Promise<PromotionForm>;
  updatePromotionForm(id: number, form: Partial<InsertPromotionForm>): Promise<PromotionForm | undefined>;
  deletePromotionForm(id: number): Promise<boolean>;
  approvePromotionForm(id: number, reviewedBy: string, comments: string, effectiveDate: string): Promise<PromotionForm | undefined>;
  rejectPromotionForm(id: number, reviewedBy: string, comments: string): Promise<PromotionForm | undefined>;
  // Crew Members
  getCrewMembers(filters?: { rank?: string; nationality?: string; status?: string; search?: string }): Promise<CrewMember[]>;
  getCrewMember(id: string): Promise<CrewMember | undefined>;
  createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: string, crewMember: Partial<InsertCrewMember>): Promise<CrewMember | undefined>;
  deleteCrewMember(id: string): Promise<boolean>;
  // Appraisal Results
  getAppraisalResults(): Promise<AppraisalResult[]>;
  getAppraisalResult(id: number): Promise<AppraisalResult | undefined>;
  getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]>;
  createAppraisalResult(appraisalResult: InsertAppraisalResult): Promise<AppraisalResult>;
  updateAppraisalResult(id: number, appraisalResult: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined>;
  deleteAppraisalResult(id: number): Promise<boolean>;
  submitAppraisalStage(id: number, stage: 'stage1' | 'stage2' | 'stage3', data: any, submittedBy: string): Promise<AppraisalResult | undefined>;
  // Recruitment Candidates
  getRecruitmentCandidates(): Promise<RecruitmentCandidate[]>;
  getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined>;
  getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]>;
  createRecruitmentCandidate(candidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate>;
  updateRecruitmentCandidate(id: string, candidate: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined>;
  deleteRecruitmentCandidate(id: string): Promise<boolean>;
  softDeleteRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined>;
  // Data Masters
  getDataMasters(): Promise<DataMaster[]>;
  getDataMaster(id: string): Promise<DataMaster | undefined>;
  createDataMaster(master: InsertDataMaster): Promise<DataMaster>;
  updateDataMaster(id: string, master: Partial<InsertDataMaster>): Promise<DataMaster | undefined>;
  deleteDataMaster(id: string): Promise<boolean>;
  // Master Data Entries
  getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]>;
  getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined>;
  createMasterDataEntry(entry: InsertMasterDataEntry): Promise<MasterDataEntry>;
  updateMasterDataEntry(id: number, entry: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined>;
  deleteMasterDataEntry(id: number): Promise<boolean>;
  // Vessel Groups
  getVesselGroups(): Promise<VesselGroup[]>;
  getVesselGroup(id: number): Promise<VesselGroup | undefined>;
  createVesselGroup(vesselGroup: InsertVesselGroup): Promise<VesselGroup>;
  updateVesselGroup(id: number, vesselGroup: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined>;
  deleteVesselGroup(id: number): Promise<boolean>;
  // Vessel Drafts
  getVesselDrafts(): Promise<VesselDraft[]>;
  getVesselDraft(id: number): Promise<VesselDraft | undefined>;
  getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]>;
  createVesselDraft(vesselDraft: InsertVesselDraft): Promise<VesselDraft>;
  updateVesselDraft(id: number, vesselDraft: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined>;
  deleteVesselDraft(id: number): Promise<boolean>;
  // Vessel Revisions
  getVesselRevisions(): Promise<VesselRevision[]>;
  getVesselRevision(id: number): Promise<VesselRevision | undefined>;
  getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]>;
  createVesselRevision(vesselRevision: InsertVesselRevision): Promise<VesselRevision>;
  // Vessel Planning
  getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]>;
  getVesselPlanningByCrewMember(crewMemberId: string): Promise<VesselPlanning[]>;
  getVesselPlanningAsReliever(crewMemberId: string): Promise<VesselPlanning[]>;
  getVesselPlanningById(id: number): Promise<VesselPlanning | undefined>;
  getAllVesselPlanning(): Promise<VesselPlanning[]>;
  createVesselPlanning(planning: InsertVesselPlanning): Promise<VesselPlanning>;
  updateVesselPlanning(id: number, planning: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined>;
  deleteVesselPlanning(id: number): Promise<boolean>;
  // Dashboard Summary
  getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined>;
  // ID Generation
  getNextCrewId(): Promise<string>;
  // Recruitment to Crew Transfer
  transferRecruitedCandidate(candidateId: string): Promise<{ crewMember: CrewMember; crewId: string }>;
  // Rotation Plans
  getRotationPlans(): Promise<RotationPlan[]>;
  getRotationPlan(id: number): Promise<RotationPlan | undefined>;
  createRotationPlan(plan: InsertRotationPlan): Promise<RotationPlan>;
  updateRotationPlan(id: number, plan: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined>;
  deleteRotationPlan(id: number): Promise<boolean>;
  // Rotation Approval Workflow
  proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined>;
  getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string; archived?: boolean }): Promise<any[]>;
  deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[]; vesselPlanningId?: number; vesselCode?: string }>;
  rejectAssignment(planId: number, assignmentIndex: number, rejectedBy?: string): Promise<RotationPlan | undefined>;
  checkAssignmentConflicts(crewId: string, signOnDate: string, contractPeriod: number, excludePlanId?: number, excludeAssignmentIndex?: number): Promise<any[]>;
  // Rotation Archive - Independent historical records
  getArchivedAssignments(filters?: { vessels?: string[]; ranks?: string[]; dateFrom?: string; dateTo?: string }): Promise<RotationArchiveEntry[]>;
  createArchiveEntry(entry: InsertRotationArchive): Promise<RotationArchiveEntry>;
  // Drug/Alcohol Test Records
  getDrugAlcoholTestRecords(): Promise<DrugAlcoholTestRecord[]>;
  getDrugAlcoholTestRecord(id: number): Promise<DrugAlcoholTestRecord | undefined>;
  getDrugAlcoholTestRecordsByVessel(vesselId: string, testType?: string): Promise<DrugAlcoholTestRecord[]>;
  createDrugAlcoholTestRecord(record: InsertDrugAlcoholTestRecord): Promise<DrugAlcoholTestRecord>;
  updateDrugAlcoholTestRecord(id: number, record: Partial<InsertDrugAlcoholTestRecord>): Promise<DrugAlcoholTestRecord | undefined>;
  deleteDrugAlcoholTestRecord(id: number): Promise<boolean>;
  // Rest Hours Vessel Records
  getRestHoursVesselRecords(): Promise<RestHoursVesselRecord[]>;
  getRestHoursVesselRecord(id: number): Promise<RestHoursVesselRecord | undefined>;
  getRestHoursVesselRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string }): Promise<RestHoursVesselRecord[]>;
  createRestHoursVesselRecord(record: InsertRestHoursVesselRecord): Promise<RestHoursVesselRecord>;
  updateRestHoursVesselRecord(id: number, record: Partial<InsertRestHoursVesselRecord>): Promise<RestHoursVesselRecord | undefined>;
  deleteRestHoursVesselRecord(id: number): Promise<boolean>;
  // Rest Hours Crew Records
  getRestHoursCrewRecords(): Promise<RestHoursCrewRecord[]>;
  getRestHoursCrewRecord(id: number): Promise<RestHoursCrewRecord | undefined>;
  getRestHoursCrewRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string; ranks?: string[]; search?: string }): Promise<RestHoursCrewRecord[]>;
  createRestHoursCrewRecord(record: InsertRestHoursCrewRecord): Promise<RestHoursCrewRecord>;
  updateRestHoursCrewRecord(id: number, record: Partial<InsertRestHoursCrewRecord>): Promise<RestHoursCrewRecord | undefined>;
  deleteRestHoursCrewRecord(id: number): Promise<boolean>;
  // Rest Hours Daily Records
  getRestHoursDailyRecords(): Promise<RestHoursDailyRecord[]>;
  getRestHoursDailyRecord(id: number): Promise<RestHoursDailyRecord | undefined>;
  getRestHoursDailyRecordByKey(crewMemberId: string, vesselId: string, monthYear: string): Promise<RestHoursDailyRecord | undefined>;
  createRestHoursDailyRecord(record: InsertRestHoursDailyRecord): Promise<RestHoursDailyRecord>;
  updateRestHoursDailyRecord(id: number, record: Partial<InsertRestHoursDailyRecord>): Promise<RestHoursDailyRecord | undefined>;
  deleteRestHoursDailyRecord(id: number): Promise<boolean>;
  // Variable Tasks
  getVariableTasks(): Promise<VariableTask[]>;
  getVariableTask(id: number): Promise<VariableTask | undefined>;
  getVariableTasksByFilters(filters: { vesselId?: string; periodValue?: string }): Promise<VariableTask[]>;
  createVariableTask(task: InsertVariableTask): Promise<VariableTask>;
  updateVariableTask(id: number, task: Partial<InsertVariableTask>): Promise<VariableTask | undefined>;
  deleteVariableTask(id: number): Promise<boolean>;
  // Fixed Tasks
  getFixedTasks(): Promise<FixedTask[]>;
  getFixedTask(id: number): Promise<FixedTask | undefined>;
  getFixedTasksByVesselAndMonth(vesselId: string, monthYear: string): Promise<FixedTask[]>;
  getFixedTaskByKey(crewMemberId: string, vesselId: string, monthYear: string): Promise<FixedTask | undefined>;
  createFixedTask(task: InsertFixedTask): Promise<FixedTask>;
  updateFixedTask(id: number, task: Partial<InsertFixedTask>): Promise<FixedTask | undefined>;
  deleteFixedTask(id: number): Promise<boolean>;
  // Vessel Violation Comments
  getVesselViolationComment(vesselId: string, monthValue: string): Promise<VesselViolationComment | null>;
  saveVesselViolationComment(comment: InsertVesselViolationComment): Promise<VesselViolationComment>;
  // Office Violation Comments
  getOfficeViolationComment(vesselId: string, monthValue: string): Promise<OfficeViolationComment | null>;
  saveOfficeViolationComment(comment: InsertOfficeViolationComment): Promise<OfficeViolationComment>;
  // NC Reports
  getAllNCReports(): Promise<NCReport[]>;
  getNCReport(crewMemberId: string, vesselId: string, monthValue: string): Promise<NCReport | null>;
  saveNCReport(report: InsertNCReport): Promise<NCReport>;
  // Vessel Date Line Adjustments
  getVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<VesselDateLineAdjustment | null>;
  saveVesselDateLineAdjustment(adjustment: InsertVesselDateLineAdjustment): Promise<VesselDateLineAdjustment>;
  deleteVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<boolean>;
  clearAdvancedDaysData(vesselId: string, monthValue: string, advancedDays: number[]): Promise<boolean>;
}

/* MemStorage commented out - contains test seed data with type mismatches and is never used in production.
   PersistentFileStorage is used instead. Keeping this code for future reference if needed.

// @ts-expect-error - MemStorage contains test seed data with type mismatches. Not used in production (PersistentFileStorage is used instead).
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private forms: Map<number, Form>;
  private rankGroups: Map<number, RankGroup>;
  private availableRanks: Map<number, AvailableRank>;
  private companyRanks: Map<string, CompanyRank>;
  private promotionHierarchies: Map<number, PromotionHierarchy>;
  private crewMembers: Map<string, CrewMember>;
  private appraisalResults: Map<number, AppraisalResult>;
  private recruitmentCandidates: Map<string, RecruitmentCandidate>;
  private vesselGroups: Map<number, VesselGroup>;
  private vesselDrafts: Map<number, VesselDraft>;
  private vesselRevisions: Map<number, VesselRevision>;
  private vesselPlanning: Map<number, VesselPlanning>;
  private rotationPlans: Map<number, RotationPlan>;
  private drugAlcoholTestRecords: Map<number, DrugAlcoholTestRecord>;
  private restHoursVesselRecords: Map<number, RestHoursVesselRecord>;
  private restHoursCrewRecords: Map<number, RestHoursCrewRecord>;
  private restHoursDailyRecords: Map<number, RestHoursDailyRecord>;
  private fixedTasks: Map<number, FixedTask>;
  private variableTasks: Map<number, VariableTask>;
  private vesselViolationComments: Map<number, VesselViolationComment>;
  private officeViolationComments: Map<number, OfficeViolationComment>;
  private ncReports: Map<number, NCReport>;
  private vesselDateLineAdjustments: Map<number, VesselDateLineAdjustment>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentPromotionHierarchyId: number;
  private currentAppraisalResultId: number;
  private currentCrewIdCounter: number;
  private currentVesselGroupId: number;
  private currentVesselDraftId: number;
  private currentVesselRevisionId: number;
  private currentVesselPlanningId: number;
  private currentRotationPlanId: number;
  private currentDrugAlcoholTestRecordId: number;
  private currentRestHoursVesselRecordId: number;
  private currentRestHoursCrewRecordId: number;
  private currentRestHoursDailyRecordId: number;
  private currentFixedTaskId: number;
  private currentVariableTaskId: number;
  private currentVesselViolationCommentId: number;
  private currentOfficeViolationCommentId: number;
  private currentNCReportId: number;
  private currentVesselDateLineAdjustmentId: number;

  constructor() {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.promotionHierarchies = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.vesselGroups = new Map();
    this.vesselDrafts = new Map();
    this.vesselRevisions = new Map();
    this.vesselPlanning = new Map();
    this.rotationPlans = new Map();
    this.rotationArchive = new Map();
    this.drugAlcoholTestRecords = new Map();
    this.restHoursVesselRecords = new Map();
    this.restHoursCrewRecords = new Map();
    this.restHoursDailyRecords = new Map();
    this.fixedTasks = new Map();
    this.variableTasks = new Map();
    this.vesselViolationComments = new Map();
    this.officeViolationComments = new Map();
    this.ncReports = new Map();
    this.vesselDateLineAdjustments = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentPromotionHierarchyId = 1;
    this.currentAppraisalResultId = 1;
    this.currentCrewIdCounter = 1;
    this.currentVesselGroupId = 1;
    this.currentVesselDraftId = 1;
    this.currentVesselRevisionId = 1;
    this.currentVesselPlanningId = 1;
    this.currentRotationPlanId = 1;
    this.currentRotationArchiveId = 1;
    this.currentDrugAlcoholTestRecordId = 1;
    this.currentRestHoursVesselRecordId = 1;
    this.currentRestHoursCrewRecordId = 1;
    this.currentRestHoursDailyRecordId = 1;
    this.currentFixedTaskId = 1;
    this.currentVariableTaskId = 1;
    this.currentVesselViolationCommentId = 1;
    this.currentOfficeViolationCommentId = 1;
    this.currentNCReportId = 1;
    this.currentVesselDateLineAdjustmentId = 1;
    
    this.initializeDefaultData();

    // Initialize with sample form data - showing only 1 rank group for configuration
    this.forms.set(1, {
      id: 1,
      name: "Crew Appraisal Form",
      category: "Appraisal",
      rankGroup: "Senior Officers",
      versionNo: "01",
      versionDate: "01-Jan-2025",
      configuration: null,
    });
    this.currentFormId = 2;

    // Initialize with sample available ranks (minimal seeding since user manages their own data)
    this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "S1", label: "Master", applicableToCompany: true, sortOrder: 1 });
    this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "S2", label: "Chief Officer", applicableToCompany: true, sortOrder: 2 });
    this.availableRanks.set(3, { id: 3, name: "Chief Engineer", category: "Senior Officers", rankId: "S7", label: "Chief Engineer", applicableToCompany: true, sortOrder: 3 });
    this.availableRanks.set(4, { id: 4, name: "2nd Officer", category: "Junior Officers", rankId: "S3", label: "2nd Officer", applicableToCompany: true, sortOrder: 4 });
    this.availableRanks.set(5, { id: 5, name: "3rd Officer", category: "Junior Officers", rankId: "S4", label: "3rd Officer", applicableToCompany: true, sortOrder: 5 });
    this.availableRanks.set(6, { id: 6, name: "2nd Engineer", category: "Junior Officers", rankId: "S9", label: "2nd Engineer", applicableToCompany: true, sortOrder: 6 });
    this.availableRanks.set(7, { id: 7, name: "3rd Engineer", category: "Junior Officers", rankId: "S10", label: "3rd Engineer", applicableToCompany: true, sortOrder: 7 });
    this.availableRanks.set(8, { id: 8, name: "Bosun", category: "Ratings", rankId: "S12", label: "Bosun", applicableToCompany: true, sortOrder: 8 });
    this.availableRanks.set(9, { id: 9, name: "AB", category: "Ratings", rankId: "S14", label: "AB", applicableToCompany: true, sortOrder: 9 });
    this.availableRanks.set(10, { id: 10, name: "OS", category: "Ratings", rankId: "S15", label: "OS", applicableToCompany: false, sortOrder: 10 });
    this.availableRanks.set(11, { id: 11, name: "Oiler", category: "Ratings", rankId: "S16", label: "Oiler", applicableToCompany: false, sortOrder: 11 });
    this.availableRanks.set(12, { id: 12, name: "Wiper", category: "Ratings", rankId: "S17", label: "Wiper", applicableToCompany: false, sortOrder: 12 });
    this.currentAvailableRankId = 13;

    // Initialize with sample rank groups - showing only 1 for configuration
    // Note: Using JSON string for ranks array compatibility with MySQL
    this.rankGroups.set(1, {
      id: 1,
      formId: 1,
      name: "Senior Officers",
      ranks: JSON.stringify(["Master", "Chief Officer", "Chief Engineer"])
    });
    this.currentRankGroupId = 2;

    // Initialize with sample crew member data
    this.crewMembers.set("2025-05-14", {
      id: "2025-05-14",
      empNo: "EMP001",
      firstName: "James",
      middleName: "Michael",
      familyName: "Smith",
      dateOfBirth: "1985-03-15",
      age: "39",
      nationality: "British",
      presentRank: "Master",
      rankAppliedFor: null,
      employeeId: "EMP001",
      presentVessel: "MT Sail One",
      vesselType: "Oil Tanker",
      lastVessel: null,
      status: "On Board",
      joiningDate: "01-Feb-2025",
      signOnDate: "01-Feb-2025",
      signOffDate: null,
      contractPeriod: "6 months",
      reliefDue: "01-Aug-2025",
      reason: null,
      availability: "On Board",
      email: "james.smith@example.com",
      mobile: "+44 7700 900123",
      contactLandline: null,
      countryOfResidence: "United Kingdom",
      nearestAirport: "LHR",
      residentialAddressLine1: null,
      residentialAddressLine2: null,
      placeOfBirthCity: "London",
      placeOfBirthCountry: "United Kingdom",
      heightCm: null,
      weightKg: null,
      bmi: null,
      nativeLanguage: "English",
      foreignLanguages: null,
      englishProficiency: "Native",
      maritalStatus: "Married",
      numberOfDependentChildren: "2",
      fatherName: null,
      motherName: null,
      spouseFirstName: null,
      spouseMiddleName: null,
      spouseFamilyName: null,
      spouseDateOfBirth: null,
      nokFirstName: null,
      nokMiddleName: null,
      nokFamilyName: null,
      nokTelephone: null,
      nokEmail: null,
      nokAddress: null,
      nokRelationship: null,
      manningAgent: null,
      vesselTypes: JSON.stringify(["Oil Tanker", "Chemical Tanker"]),
      documents: null,
      visas: null,
      education: null,
      licenses: null,
      trainingCourses: null,
      currentCompanySeaService: null,
      externalSeaService: null,
      preJoiningMedicals: null,
      doctorVisits: null,
      children: null,
      createdAt: null,
      updatedAt: null as any // new Date("2025-02-01")
    });

    // REMOVED: Duplicate incomplete crew member seed data (380-433) - complete versions exist elsewhere

    // Initialize with sample recruitment candidates
    this.recruitmentCandidates.set("2025-09-23-1758595508955", {
      id: "2025-09-23-1758595508955",
      fileNo: "M2025-955",
      firstName: "Mark",
      middleName: "Tan",
      familyName: "Twait",
      dob: "1981-01-04",
      nationality: "Malaysian",
      rankAppliedFor: "Master",
      presentRank: "Master",
      vesselType: "Oil Tanker",
      status: "Applied",
      applicationData: "{\"firstName\":\"Mark\",\"middleName\":\"Tan\",\"familyName\":\"Twait\",\"nationality\":\"Malaysian\",\"presentRank\":\"Master\",\"dateOfBirth\":\"1981-01-04\",\"placeOfBirthCity\":\"\",\"placeOfBirthCountry\":\"Malaysia\",\"ageInYears\":\"44\",\"heightCm\":\"\",\"weightKg\":\"\",\"nativeLanguage\":\"English\",\"foreignLanguages\":\"Spanish\",\"englishProficiency\":\"Good\",\"rankAppliedFor\":\"Master\",\"manningAgent\":\"ABC \",\"fileNo\":\"M2025-955\",\"b1AgeMeetsCriteria\":\"Yes\",\"b1RankMeetsCriteria\":\"Yes\",\"b1CertificatesValid\":\"No\",\"b1Shortlisted\":\"Yes\",\"b2ReferenceChecksCompleted\":\"Yes\",\"b2CurrentEmployerFeedback\":\"Good feedback\"}",
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-001", {
      id: "RC-2025-001",
      fileNo: "RF-2025-001",
      firstName: "Michael",
      middleName: "James",
      familyName: "Thompson",
      dob: "1985-03-15",
      nationality: "Filipino",
      rankAppliedFor: "Chief Officer",
      presentRank: "2nd Officer",
      vesselType: "Container",
      status: "Applied",
      applicationData: null,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-002", {
      id: "RC-2025-002",
      fileNo: "RF-2025-002",
      firstName: "Sarah",
      middleName: null,
      familyName: "Rodriguez",
      dob: "1990-07-22",
      nationality: "Spanish",
      rankAppliedFor: "3rd Engineer",
      presentRank: "Engine Cadet",
      vesselType: "Oil Tanker",
      status: "Screening",
      applicationData: null,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-003", {
      id: "RC-2025-003",
      fileNo: "RF-2025-003",
      firstName: "Alexander",
      middleName: "Viktor",
      familyName: "Petrov",
      dob: "1982-11-08",
      nationality: "Russian",
      rankAppliedFor: "Master",
      presentRank: "Chief Officer",
      vesselType: "Bulk Carrier",
      status: "For Approval",
      applicationData: null,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-004", {
      id: "RC-2025-004",
      fileNo: "RF-2025-004",
      firstName: "Priya",
      middleName: "Devi",
      familyName: "Sharma",
      dob: "1993-02-14",
      nationality: "Indian",
      rankAppliedFor: "Able Seaman",
      presentRank: "Ordinary Seaman",
      vesselType: "LPG Tanker",
      status: "Applied",
      applicationData: null,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    // Initialize with sample appraisal results
    this.appraisalResults.set(1, {
      id: 1,
      crewMemberId: "2025-05-14",
      formId: 1,
      appraisalType: "End of Contract",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "4.9",
      behavioralRating: "4.5",
      overallRating: "4.7",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-06-06"),
      stageStatuses: null,
      stagePayloads: null
    });

    this.appraisalResults.set(2, {
      id: 2,
      crewMemberId: "2025-03-12",
      formId: 1,
      appraisalType: "Mid Term",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.5",
      behavioralRating: "4.5",
      overallRating: "4.0",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-05-07"),
      stageStatuses: null,
      stagePayloads: null
    });

    this.appraisalResults.set(3, {
      id: 3,
      crewMemberId: "2025-02-12",
      formId: 1,
      appraisalType: "Special",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "2.5",
      behavioralRating: "3.5",
      overallRating: "3.0",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-06-06"),
      stageStatuses: null,
      stagePayloads: null
    });

    this.appraisalResults.set(4, {
      id: 4,
      crewMemberId: "2025-05-14-2",
      formId: 1,
      appraisalType: "Probation",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.5",
      behavioralRating: "4.5",
      overallRating: "4.0",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-05-07"),
      stageStatuses: null,
      stagePayloads: null
    });

    this.appraisalResults.set(5, {
      id: 5,
      crewMemberId: "2025-03-12-2",
      formId: 1,
      appraisalType: "Appraiser S/Off",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "4.5",
      behavioralRating: "2.5",
      overallRating: "3.5",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-06-06"),
      stageStatuses: null,
      stagePayloads: null
    });

    this.currentAppraisalResultId = 6;

    // Initialize with sample rotation plan data
    this.rotationPlans.set(1, {
      id: 1,
      draftId: "24-01-13",
      lastEdited: "10 Jan 24",
      vessels: JSON.stringify(["Vessel 2", "Vessel 4", "Vessel 5", "Vessel 6"]),
      crew: "Master, Chief Officer",
      planFromDate: "1 Jan 24",
      planToDate: "30 Jun 24",
      createdBy: "ABC, Crew Execution",
      planStatus: "Pending Approval",
      proposedBy: null,
      proposedDate: null,
      assignments: null,
      createdAt: null,
      updatedAt: null as any // new Date("2024-01-10")
    });

    this.rotationPlans.set(2, {
      id: 2,
      draftId: "24-02-05",
      lastEdited: "15 Feb 24",
      vessels: JSON.stringify(["MT Sail One", "MT Sail Two"]),
      crew: "Chief Engineer, 2nd Engineer",
      planFromDate: "1 Mar 24",
      planToDate: "31 Aug 24",
      createdBy: "Tech Team",
      planStatus: "In Draft",
      proposedBy: null,
      proposedDate: null,
      assignments: null,
      createdAt: null,
      updatedAt: null as any // new Date("2024-02-15")
    });

    this.rotationPlans.set(3, {
      id: 3,
      draftId: "24-03-22",
      lastEdited: "22 Mar 24",
      vessels: JSON.stringify(["MT Sail Five", "MT Sail Eight", "MT Sail Ten"]),
      crew: "Master, Chief Officer, 2nd Officer",
      planFromDate: "1 Apr 24",
      planToDate: "30 Sep 24",
      createdBy: "Operations Team",
      planStatus: "Approved",
      proposedBy: null,
      proposedDate: null,
      assignments: null,
      createdAt: null,
      updatedAt: null as any // new Date("2024-03-22")
    });

    this.currentRotationPlanId = 4;
  }

  private initializeDefaultData() {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.vesselGroups = new Map();
    this.vesselDrafts = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
    this.currentVesselGroupId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getForms(): Promise<Form[]> {
    return Array.from(this.forms.values());
  }

  async getForm(id: number): Promise<Form | undefined> {
    return this.forms.get(id);
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const id = this.currentFormId++;
    const form: Form = { 
      ...insertForm, 
      id,
      configuration: insertForm.configuration || null
    };
    this.forms.set(id, form);
    return form;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    const existingForm = this.forms.get(id);
    if (!existingForm) return undefined;

    const updatedForm: Form = { 
      ...existingForm, 
      ...formData,
      configuration: formData.configuration !== undefined ? formData.configuration : existingForm.configuration
    };
    this.forms.set(id, updatedForm);
    return updatedForm;
  }

  async deleteForm(id: number): Promise<boolean> {
    return this.forms.delete(id);
  }

  async getRankGroups(formId: number): Promise<RankGroup[]> {
    return Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
  }

  async createRankGroup(insertRankGroup: InsertRankGroup): Promise<RankGroup> {
    const id = this.currentRankGroupId++;
    // Convert array to JSON string for MySQL compatibility
    const rankGroup: RankGroup = { 
      ...insertRankGroup, 
      id,
      ranks: typeof insertRankGroup.ranks === 'string' 
        ? insertRankGroup.ranks 
        : JSON.stringify(insertRankGroup.ranks)
    };
    this.rankGroups.set(id, rankGroup);
    
    // Sync the form's rankGroup field with all associated rank groups
    await this.syncFormRankGroup(insertRankGroup.formId);
    
    return rankGroup;
  }

  // Private helper to sync form's rankGroup field with associated rank groups
  private async syncFormRankGroup(formId: number): Promise<void> {
    // Get all rank groups for this form
    const formRankGroups = Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
    
    // Create display string from rank group names
    const rankGroupNames = formRankGroups.map(rg => rg.name).join(", ");
    
    // Update the form's rankGroup field
    const form = this.forms.get(formId);
    if (form) {
      form.rankGroup = rankGroupNames || "";
      this.forms.set(formId, form);
    }
  }

  async updateRankGroup(id: number, rankGroupData: Partial<InsertRankGroup>): Promise<RankGroup | undefined> {
    const existingRankGroup = this.rankGroups.get(id);
    if (!existingRankGroup) return undefined;

    const updatedRankGroup: RankGroup = { 
      ...existingRankGroup, 
      ...rankGroupData,
      ranks: rankGroupData.ranks 
        ? (typeof rankGroupData.ranks === 'string' 
          ? rankGroupData.ranks 
          : JSON.stringify(rankGroupData.ranks))
        : existingRankGroup.ranks
    };
    this.rankGroups.set(id, updatedRankGroup);
    return updatedRankGroup;
  }

  async deleteRankGroup(id: number): Promise<boolean> {
    const rankGroup = this.rankGroups.get(id);
    if (!rankGroup) return false;
    
    const formId = rankGroup.formId;
    const result = this.rankGroups.delete(id);
    
    if (result) {
      // Sync the form's rankGroup field after deletion
      await this.syncFormRankGroup(formId);
    }
    
    return result;
  }

  async getFormForRank(rankLabel: string, category: string): Promise<Form | undefined> {
    for (const rankGroup of Array.from(this.rankGroups.values())) {
      try {
        const ranks = JSON.parse(rankGroup.ranks);
        if (Array.isArray(ranks) && ranks.includes(rankLabel)) {
          const form = this.forms.get(rankGroup.formId);
          // Filter by category if provided
          if (form && (!category || form.category === category)) {
            return form;
          }
        }
      } catch (e) {
        console.error(`Error parsing ranks for rank group ${rankGroup.id}:`, e);
      }
    }
    return undefined;
  }

  async getAvailableRanks(): Promise<AvailableRank[]> {
    return Array.from(this.availableRanks.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    const id = this.currentAvailableRankId++;
    // Get the next sortOrder value
    const existingRanks = await this.getAvailableRanks();
    const maxSortOrder = existingRanks.length > 0 ? Math.max(...existingRanks.map(r => r.sortOrder || 0)) : 0;
    
    const availableRank: AvailableRank = { 
      ...insertAvailableRank, 
      id,
      rankId: insertAvailableRank.rankId ?? null,
      label: insertAvailableRank.label ?? null,
      applicableToCompany: insertAvailableRank.applicableToCompany ?? null,
      sortOrder: insertAvailableRank.sortOrder ?? (maxSortOrder + 1)
    };
    this.availableRanks.set(id, availableRank);
    return availableRank;
  }

  async updateAvailableRank(id: number, rankData: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined> {
    const existingRank = this.availableRanks.get(id);
    if (!existingRank) return undefined;

    const updatedRank: AvailableRank = { 
      ...existingRank, 
      ...rankData
    };
    this.availableRanks.set(id, updatedRank);
    return updatedRank;
  }

  async deleteAvailableRank(id: number): Promise<boolean> {
    return this.availableRanks.delete(id);
  }

  async clearAllAvailableRanks(): Promise<boolean> {
    this.availableRanks.clear();
    return true;
  }

  async updateRankOrders(rankOrders: Array<{ id: number; sortOrder: number }>): Promise<boolean> {
    try {
      for (const { id, sortOrder } of rankOrders) {
        const existingRank = this.availableRanks.get(id);
        if (existingRank) {
          const updatedRank: AvailableRank = { 
            ...existingRank, 
            sortOrder 
          };
          this.availableRanks.set(id, updatedRank);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to update rank orders:', error);
      return false;
    }
  }

  // Company Ranks Methods
  async getCompanyRanks(): Promise<CompanyRank[]> {
    return Array.from(this.companyRanks.values());
  }

  async getCompanyRank(id: string): Promise<CompanyRank | undefined> {
    return this.companyRanks.get(id);
  }

  async getCompanyRankByName(rankName: string): Promise<CompanyRank | undefined> {
    const ranks = Array.from(this.companyRanks.values());
    return ranks.find(r => r.rank?.toLowerCase() === rankName.toLowerCase());
  }

  async createCompanyRank(insertCompanyRank: InsertCompanyRank): Promise<CompanyRank> {
    const companyRank: CompanyRank = { ...insertCompanyRank, createdAt: null, updatedAt: null };
    this.companyRanks.set(companyRank.id, companyRank);
    return companyRank;
  }

  async updateCompanyRank(id: string, companyRankData: Partial<InsertCompanyRank>): Promise<CompanyRank | undefined> {
    const existingCompanyRank = this.companyRanks.get(id);
    if (!existingCompanyRank) return undefined;

    const updatedCompanyRank: CompanyRank = { ...existingCompanyRank, ...companyRankData };
    this.companyRanks.set(id, updatedCompanyRank);
    return updatedCompanyRank;
  }

  async deleteCompanyRank(id: string): Promise<boolean> {
    return this.companyRanks.delete(id);
  }

  async clearAllCompanyRanks(): Promise<boolean> {
    this.companyRanks.clear();
    return true;
  }

  async saveAllCompanyRanks(ranks: InsertCompanyRank[]): Promise<CompanyRank[]> {
    this.companyRanks.clear();
    const savedRanks: CompanyRank[] = [];
    
    for (const rank of ranks) {
      const companyRank: CompanyRank = { ...rank, createdAt: null, updatedAt: null };
      this.companyRanks.set(companyRank.id, companyRank);
      savedRanks.push(companyRank);
    }
    
    return savedRanks;
  }

  // Promotion Hierarchies Methods
  async getPromotionHierarchies(): Promise<PromotionHierarchy[]> {
    return Array.from(this.promotionHierarchies.values());
  }

  async getPromotionHierarchy(id: number): Promise<PromotionHierarchy | undefined> {
    return this.promotionHierarchies.get(id);
  }

  async createPromotionHierarchy(insertPromotionHierarchy: InsertPromotionHierarchy): Promise<PromotionHierarchy> {
    const id = this.currentPromotionHierarchyId++;
    const promotionHierarchy: PromotionHierarchy = { 
      ...insertPromotionHierarchy, 
      id,
      createdAt: null,
      updatedAt: null
    };
    this.promotionHierarchies.set(id, promotionHierarchy);
    return promotionHierarchy;
  }

  async updatePromotionHierarchy(id: number, promotionHierarchyData: Partial<InsertPromotionHierarchy>): Promise<PromotionHierarchy | undefined> {
    const existingPromotionHierarchy = this.promotionHierarchies.get(id);
    if (!existingPromotionHierarchy) return undefined;

    const updatedPromotionHierarchy: PromotionHierarchy = { 
      ...existingPromotionHierarchy, 
      ...promotionHierarchyData
    };
    this.promotionHierarchies.set(id, updatedPromotionHierarchy);
    return updatedPromotionHierarchy;
  }

  async deletePromotionHierarchy(id: number): Promise<boolean> {
    return this.promotionHierarchies.delete(id);
  }

  // Crew Members Methods
  async getCrewMembers(): Promise<CrewMember[]> {
    return Array.from(this.crewMembers.values());
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    return this.crewMembers.get(id);
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    const now = new Date();
    const crewMember: CrewMember = { 
      ...insertCrewMember,
      middleName: insertCrewMember.middleName || null,
      familyName: insertCrewMember.familyName || null,
      createdAt: now,
      updatedAt: now
    };
    this.crewMembers.set(crewMember.id, crewMember);
    return crewMember;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const existingCrewMember = this.crewMembers.get(id);
    if (!existingCrewMember) return undefined;

    // Set updatedAt timestamp automatically on every update for sorting by latest edited
    const updatedCrewMember: CrewMember = { 
      ...existingCrewMember, 
      ...crewMemberData,
      updatedAt: new Date()
    };
    this.crewMembers.set(id, updatedCrewMember);
    return updatedCrewMember;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    return this.crewMembers.delete(id);
  }

  // Dashboard Summary Method
  async getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined> {
    const crewMember = await this.getCrewMember(crewId);
    if (!crewMember) return undefined;

    const appraisals = await this.getAppraisalResultsByCrewMember(crewId);

    const vesselName = crewMember.presentVessel ? translateVesselCodeToName(crewMember.presentVessel) : '';
    const joinedDateFormatted = formatDateForDashboard(crewMember.signOnDate);
    const reliefDueFormatted = formatDateForDashboard(crewMember.reliefDue);

    // Parse sea service data for experience calculations
    let companySeaService: any[] = [];
    let externalSeaService: any[] = [];
    try {
      companySeaService = crewMember.currentCompanySeaService 
        ? JSON.parse(crewMember.currentCompanySeaService as string) 
        : [];
    } catch (e) {
      companySeaService = [];
    }
    try {
      externalSeaService = crewMember.externalSeaService 
        ? JSON.parse(crewMember.externalSeaService as string) 
        : [];
    } catch (e) {
      externalSeaService = [];
    }
    
    // Calculate experience from sea service
    const currentRank = crewMember.presentRank || '';
    const experience = calculateExperienceFromSeaService(companySeaService, externalSeaService, currentRank);
    
    // Calculate ship type experience
    const shipTypeData = calculateShipTypeExperience(companySeaService, externalSeaService);

    // Parse licenses for endorsement calculation
    // Handle both cases: licenses can be a JSON string or already an array
    let licenses: any[] = [];
    if (crewMember.licenses) {
      if (Array.isArray(crewMember.licenses)) {
        licenses = crewMember.licenses;
      } else if (typeof crewMember.licenses === 'string') {
        try {
          licenses = JSON.parse(crewMember.licenses);
        } catch (e) {
          licenses = [];
        }
      }
    }

    // Get rank flags for endorsement derivation
    const rankFlags = await this.getCompanyRankByName(currentRank);
    const endorsementCode = deriveEndorsementCode(
      {
        seniorOfficer: rankFlags?.seniorOfficer,
        officer: rankFlags?.officer,
        rating: rankFlags?.rating
      },
      licenses
    );

    // Build service timeline from sea service and vessel planning
    const vesselPlanningRecords = await this.getVesselPlanningByCrewMember(crewId);
    
    // Also fetch records where this crew member is assigned as a reliever (for planned blue bars)
    const relieverPlanningRecords = await this.getVesselPlanningAsReliever(crewId);
    
    // Group appraisals by vessel for badge display
    const appraisalsByVessel = new Map<string, number[]>();
    for (const appraisal of appraisals) {
      const vessel = appraisal.vesselName || '';
      if (!appraisalsByVessel.has(vessel)) {
        appraisalsByVessel.set(vessel, []);
      }
      appraisalsByVessel.get(vessel)!.push(appraisal.id);
    }
    
    // Filter out archived records for timeline display (archived records should not appear as active bars)
    const activeVesselPlanningRecords = vesselPlanningRecords.filter(p => !p.isArchived);
    
    // Build the timeline (includes both primary assignments and reliever assignments)
    const serviceTimeline = buildServiceTimeline(
      companySeaService,
      activeVesselPlanningRecords,
      appraisalsByVessel,
      new Map(), // handovers - not yet implemented
      undefined, // vesselCodeToNameMap - MemStorage uses static translation
      relieverPlanningRecords
    );

    // Compute status based on crew member data:
    // - On Board: Has a presentVessel (assigned to a vessel)
    // - On Leave: No presentVessel but isActive is true (available but not on ship)
    // - Inactive: isActive is false (manually triggered only)
    let computedStatus: 'On Board' | 'On Leave' | 'Inactive' = 'On Leave';
    if (crewMember.isActive === false) {
      computedStatus = 'Inactive';
    } else if (crewMember.presentVessel && crewMember.presentVessel.trim() !== '') {
      computedStatus = 'On Board';
    } else {
      computedStatus = 'On Leave';
    }

    // Generate dashboard data based on actual crew member data
    const summary: CrewDashboardSummary = {
      status: {
        status: computedStatus,
        vessel: vesselName,
        joinedDate: joinedDateFormatted, 
        sailingDue: reliefDueFormatted,
        presentAssignment: crewMember.presentVessel || null,
        emergencyContact: (crewMember.nokFirstName && crewMember.nokRelationship && crewMember.nokTelephone) ? {
          name: `${crewMember.nokFirstName}${crewMember.nokFamilyName ? ' ' + crewMember.nokFamilyName : ''}`.trim(),
          relation: crewMember.nokRelationship,
          phone: crewMember.nokTelephone
        } : null
      },
      experience: {
        company: experience.company,
        rank: experience.rank,
        tankers: experience.tankers, 
        ocw: experience.oow,
        endorsements: endorsementCode
      },
      shipTypes: {
        items: shipTypeData.shipTypeExperience,
        totalMonths: shipTypeData.totalMonths,
        totalYears: Math.round((shipTypeData.totalMonths / 12) * 10) / 10
      },
      serviceTimeline,
      compliance: [
        { category: "Travel Docs", status: "compliant", details: "✓" },
        { category: "Visas", status: "compliant", details: "✓" },
        { category: "License & DCE", status: "compliant", details: "✓" },
        { category: "Training", status: "issues", details: "Issues: 2" },
        { category: "Medical", status: "compliant", details: "Last: 15 Feb 2022" },
        { category: "Vaccination", status: "issues", details: "Issue: 1" }
      ],
      careerProgression: [
        {
          position: "To C/E",
          status: { recommend: false, advance: false, demote: true, approved: false }
        },
        {
          position: "To 2/E", 
          date: "22 Jan 2017",
          status: { recommend: true, advance: true, demote: false, approved: true }
        },
        {
          position: "To 3/E",
          date: "12 Dec 2014", 
          status: { recommend: true, advance: true, demote: false, approved: true }
        }
      ],
      appraisals: appraisals.map((appraisal, index) => ({
        year: 2014 + index * 2,
        score: parseFloat(appraisal.overallRating || "3.0") * 8 // Convert to chart scale
      })).concat([
        { year: 2024, score: 31 } // Add current year point
      ])
    };

    return summary;
  }

  // ID Generation Methods
  async getNextCrewId(): Promise<string> {
    const nextNumber = this.currentCrewIdCounter++;
    // Format: A000001, A000002, etc. (A + 6-digit padded number)
    return `A${nextNumber.toString().padStart(6, '0')}`;
  }

  // Vessel Groups Methods
  async getVesselGroups(): Promise<VesselGroup[]> {
    return Array.from(this.vesselGroups.values());
  }

  async getVesselGroup(id: number): Promise<VesselGroup | undefined> {
    return this.vesselGroups.get(id);
  }

  async createVesselGroup(insertVesselGroup: InsertVesselGroup): Promise<VesselGroup> {
    const id = this.currentVesselGroupId++;
    const vesselGroup: VesselGroup = { 
      ...insertVesselGroup, 
      id,
      createdAt: null,
      updatedAt: null as any // new Date()
    };
    this.vesselGroups.set(id, vesselGroup);
    return vesselGroup;
  }

  async updateVesselGroup(id: number, vesselGroupData: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined> {
    const existingVesselGroup = this.vesselGroups.get(id);
    if (!existingVesselGroup) return undefined;

    const updatedVesselGroup: VesselGroup = { 
      ...existingVesselGroup, 
      ...vesselGroupData,
      updatedAt: null as any // new Date()
    };
    this.vesselGroups.set(id, updatedVesselGroup);
    return updatedVesselGroup;
  }

  async deleteVesselGroup(id: number): Promise<boolean> {
    return this.vesselGroups.delete(id);
  }

  // Vessel Drafts methods
  async getVesselDrafts(): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values());
  }

  async getVesselDraft(id: number): Promise<VesselDraft | undefined> {
    return this.vesselDrafts.get(id);
  }

  async getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values()).filter(draft => draft.vesselId === vesselId);
  }

  async createVesselDraft(insertVesselDraft: InsertVesselDraft): Promise<VesselDraft> {
    const id = this.currentVesselDraftId++;
    const vesselDraft: VesselDraft = { 
      ...insertVesselDraft, 
      id,
      createdAt: null,
      updatedAt: null as any // new Date()
    };
    this.vesselDrafts.set(id, vesselDraft);
    return vesselDraft;
  }

  async updateVesselDraft(id: number, vesselDraftData: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined> {
    const existingVesselDraft = this.vesselDrafts.get(id);
    if (!existingVesselDraft) return undefined;

    const updatedVesselDraft: VesselDraft = { 
      ...existingVesselDraft, 
      ...vesselDraftData,
      updatedAt: null as any // new Date()
    };
    this.vesselDrafts.set(id, updatedVesselDraft);
    return updatedVesselDraft;
  }

  async deleteVesselDraft(id: number): Promise<boolean> {
    return this.vesselDrafts.delete(id);
  }

  // Vessel Revisions methods
  async getVesselRevisions(): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values());
  }

  async getVesselRevision(id: number): Promise<VesselRevision | undefined> {
    return this.vesselRevisions.get(id);
  }

  async getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values()).filter(revision => revision.vesselId === vesselId);
  }

  async createVesselRevision(insertVesselRevision: InsertVesselRevision): Promise<VesselRevision> {
    const id = this.currentVesselRevisionId++;
    const vesselRevision: VesselRevision = { 
      ...insertVesselRevision, 
      id,
      createdAt: null as any // new Date()
    };
    this.vesselRevisions.set(id, vesselRevision);
    return vesselRevision;
  }

  // Vessel Planning Methods
  async getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.vesselId === vesselId);
  }

  async getVesselPlanningByCrewMember(crewMemberId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.crewMemberId === crewMemberId);
  }

  async getVesselPlanningAsReliever(crewMemberId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.relieverCrewId === crewMemberId);
  }

  async getVesselPlanningById(id: number): Promise<VesselPlanning | undefined> {
    return this.vesselPlanning.get(id);
  }

  async getAllVesselPlanning(): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values());
  }

  async createVesselPlanning(insertPlanning: InsertVesselPlanning): Promise<VesselPlanning> {
    const id = this.currentVesselPlanningId++;
    const vesselPlanning: VesselPlanning = { 
      ...insertPlanning,
      id,
      onBoardCrewId: insertPlanning.onBoardCrewId || null,
      onBoardCrewName: insertPlanning.onBoardCrewName || null,
      reliefDue: insertPlanning.reliefDue || null,
      signOffDate: insertPlanning.signOffDate || null,
      signOffPort: insertPlanning.signOffPort || null,
      reliefStatus: insertPlanning.reliefStatus || null,
      relieverCrewId: insertPlanning.relieverCrewId || null,
      relieverCrewName: insertPlanning.relieverCrewName || null,
      joiningDate: insertPlanning.joiningDate || null,
      joiningPort: insertPlanning.joiningPort || null,
      joiningStatus: insertPlanning.joiningStatus || null,
      createdAt: null,
      updatedAt: null as any // new Date()
    };
    this.vesselPlanning.set(id, vesselPlanning);
    return vesselPlanning;
  }

  async updateVesselPlanning(id: number, planningData: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined> {
    const existingPlanning = this.vesselPlanning.get(id);
    if (!existingPlanning) return undefined;

    const updatedPlanning: VesselPlanning = { 
      ...existingPlanning, 
      ...planningData,
      updatedAt: null as any // new Date()
    };
    this.vesselPlanning.set(id, updatedPlanning);
    return updatedPlanning;
  }

  async deleteVesselPlanning(id: number): Promise<boolean> {
    return this.vesselPlanning.delete(id);
  }

  // Rotation Plans Methods
  async getRotationPlans(): Promise<RotationPlan[]> {
    return Array.from(this.rotationPlans.values());
  }

  async getRotationPlan(id: number): Promise<RotationPlan | undefined> {
    return this.rotationPlans.get(id);
  }

  async createRotationPlan(insertPlan: InsertRotationPlan): Promise<RotationPlan> {
    const id = this.currentRotationPlanId++;
    const rotationPlan: RotationPlan = {
      ...insertPlan,
      id,
      planStatus: insertPlan.planStatus || "In Draft",
      createdAt: null,
      updatedAt: null,
    };
    this.rotationPlans.set(id, rotationPlan);
    return rotationPlan;
  }

  async updateRotationPlan(id: number, updateData: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined> {
    const existingPlan = this.rotationPlans.get(id);
    if (!existingPlan) return undefined;
    
    const updatedPlan: RotationPlan = {
      ...existingPlan,
      ...updateData,
      updatedAt: null,
    };
    this.rotationPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async deleteRotationPlan(id: number): Promise<boolean> {
    return this.rotationPlans.delete(id);
  }

  // Rotation Approval Workflow Methods
  async proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(id);
    if (!plan) return undefined;

    const updatedPlan: RotationPlan = {
      ...plan,
      planStatus: "Proposed",
      proposedBy,
      proposedDate: new Date().toISOString().split('T')[0],
      updatedAt: null as any // new Date()
    };
    this.rotationPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string; archived?: boolean }): Promise<any[]> {
    // For archived view, include completed plans as well (which have all assignments deployed/rejected)
    const proposedPlans = Array.from(this.rotationPlans.values()).filter(plan => 
      plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved" || plan.planStatus === "Completed"
    );

    const assignments: any[] = [];
    for (const plan of proposedPlans) {
      if (plan.assignments) {
        const planAssignments = JSON.parse(plan.assignments);
        for (let i = 0; i < planAssignments.length; i++) {
          const assignment = planAssignments[i];
          
          // Determine which assignments to include based on archived filter
          const isArchived = assignment.proposalStatus === "deployed" || assignment.proposalStatus === "rejected";
          const isPending = !assignment.proposalStatus || assignment.proposalStatus === "proposed";
          
          // If archived filter is set, only include archived assignments; otherwise only pending
          if (filters?.archived ? isArchived : isPending) {
            // Find current crew on board for this vessel/rank
            let currentCrew = null;
            
            // Determine vesselId for lookup
            let vesselIdToMatch: string | null = null;
            if (assignment.vesselId) {
              // Use existing vesselId and normalize it
              vesselIdToMatch = String(assignment.vesselId);
              if (/^\d+$/.test(vesselIdToMatch)) {
                // Numeric format - convert to VSL-XXX format
                vesselIdToMatch = `VSL-${vesselIdToMatch.padStart(3, '0')}`;
              }
            } else if (assignment.vessel || assignment.vesselName) {
              // Legacy assignment without vesselId
              const vesselValue = assignment.vessel || assignment.vesselName;
              
              // Check if the vessel field already contains a vessel ID (VSL-XXX format)
              if (/^VSL-\d{3}$/.test(vesselValue)) {
                // It's already a vessel ID, use it directly
                vesselIdToMatch = vesselValue;
              } else {
                // It's a vessel name, need to look it up in master data (master ID "014")
                const vesselMasterData = await this.getMasterDataEntries("014");
                const vessel = vesselMasterData?.find((v: any) => v.name === vesselValue);
                
                if (vessel && vessel.entryId) {
                  // Use the entryId which is in VSL-XXX format
                  vesselIdToMatch = vessel.entryId;
                }
              }
            }
            
            if (vesselIdToMatch && assignment.rank) {
              // Look for crew members currently on this vessel with this rank
              // Note: crew.presentVessel stores vessel ID format "VSL-003"
              const crewOnBoard = Array.from(this.crewMembers.values()).find(crew => 
                crew.presentVessel === vesselIdToMatch && crew.presentRank === assignment.rank
              );
              
              if (crewOnBoard) {
                // Get vessel planning data for this crew member to get contract dates
                // vesselPlanning.vesselId stores vessel ID
                const planning = Array.from(this.vesselPlanning.values()).find(p => 
                  p.onBoardCrewId === crewOnBoard.id && p.vesselId === vesselIdToMatch && p.rank === assignment.rank
                );
                
                if (planning && planning.reliefDue) {
                  // Calculate range dates based on contract end range settings
                  const reliefDueDate = new Date(planning.reliefDue);
                  const rangeStartMonths = planning.contractEndRangeStartMonths || 0;
                  const rangeEndMonths = planning.contractEndRangeEndMonths || 1;
                  
                  const rangeStartDate = new Date(reliefDueDate);
                  rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
                  
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.familyName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: planning.signOnDate || crewOnBoard.signOnDate || '',
                    contractEndDate: planning.reliefDue,
                    rangeStartDate: rangeStartDate.toISOString().split('T')[0],
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                } else if (crewOnBoard.signOnDate && crewOnBoard.reliefDue) {
                  // Fallback to crew member data if no planning data
                  const reliefDueDate = new Date(crewOnBoard.reliefDue);
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + 1); // Default 1 month grace period
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.familyName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: crewOnBoard.signOnDate,
                    contractEndDate: crewOnBoard.reliefDue,
                    rangeStartDate: crewOnBoard.reliefDue,
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                }
              }
            }
            
            const { assignmentIndex: _, ...assignmentWithoutIndex } = assignment;
            
            // For archived assignments, add result and archivedDate fields
            let result: string | undefined;
            let archivedDate: string | undefined;
            if (assignment.proposalStatus === "deployed") {
              result = "Deployed";
              archivedDate = assignment.deployedDate;
            } else if (assignment.proposalStatus === "rejected") {
              result = "Rejected";
              archivedDate = assignment.rejectedDate;
            }
            
            assignments.push({
              ...assignmentWithoutIndex,
              planId: plan.id,
              draftId: plan.draftId,
              proposedBy: plan.proposedBy,
              proposedDate: plan.proposedDate,
              assignmentIndex: i,
              currentCrew, // Add current crew timeline data
              ...(result && { result }),
              ...(archivedDate && { archivedDate }),
            });
          }
        }
      }
    }

    // Sort archived assignments by archivedDate (latest first)
    if (filters?.archived) {
      assignments.sort((a, b) => {
        const dateA = new Date(a.archivedDate || '1970-01-01');
        const dateB = new Date(b.archivedDate || '1970-01-01');
        return dateB.getTime() - dateA.getTime();
      });
    }

    return assignments;
  }

  async deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[]; vesselPlanningId?: number; vesselCode?: string }> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return { success: false };

    const assignments = JSON.parse(plan.assignments);
    const assignment = assignments[assignmentIndex];
    if (!assignment) return { success: false };

    // Check for conflicts, excluding this assignment to avoid self-conflict
    const conflicts = await this.checkAssignmentConflicts(
      assignment.crewId,
      assignment.joiningDate,
      assignment.contractPeriod,
      planId,
      assignmentIndex
    );

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    // Mark assignment as deployed
    assignments[assignmentIndex] = {
      ...assignment,
      proposalStatus: "deployed",
      deployedDate: new Date().toISOString().split('T')[0],
      deployedBy
    };

    // Update rotation plan
    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      updatedAt: null as any // new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);

    // Update vessel planning entry for the deployed crew
    // Require proper IDs - fail if not available
    if (!assignment.vesselId || !assignment.rankId) {
      console.error('Missing vesselId or rankId in assignment:', assignment);
      return { success: false };
    }

    // MemStorage doesn't have master data - use static vessel mapping for testing
    const vesselCode = translateVesselNameToCode(assignment.vesselId);
    console.log(`🔄 Vessel translation (MemStorage):`, { 
      vesselName: assignment.vesselId, 
      vesselCode
    });

    // Find existing vessel planning record for this vessel + rank
    let existingPlanningId: number | null = null;
    for (const [id, planning] of Array.from(this.vesselPlanning.entries())) {
      if (planning.vesselId === vesselCode && planning.rankId === assignment.rankId) {
        existingPlanningId = id;
        break;
      }
    }

    if (existingPlanningId !== null) {
      // Update existing record with reliever information
      await this.updateVesselPlanning(existingPlanningId, {
        relieverCrewId: assignment.crewId,
        relieverCrewName: assignment.crewName,
        relieverSignOnDate: assignment.signOnDate || assignment.joiningDate,
        joiningStatus: "Planned",
        contractPeriodMonths: assignment.contractPeriod,
        deploymentChecklistCompleted: false,
        applicableDocsChecked: false,
      });
    } else {
      // Create new vessel planning entry if none exists
      const vesselPlanningEntry = {
        vesselId: vesselCode,
        rankId: assignment.rankId,
        rank: assignment.rank,
        relieverCrewId: assignment.crewId,
        relieverCrewName: assignment.crewName,
        relieverSignOnDate: assignment.signOnDate || assignment.joiningDate,
        joiningStatus: "Planned",
        contractPeriodMonths: assignment.contractPeriod,
        deploymentChecklistCompleted: false,
        applicableDocsChecked: false,
      };
      await this.createVesselPlanning(vesselPlanningEntry);
    }

    // Create independent archive entry for this deployment with full snapshot
    // Preserve exact source values - use null if not available (no synthetic defaults)
    const archivedDate = new Date().toISOString().split('T')[0];
    await this.createArchiveEntry({
      originalPlanId: planId,
      originalDraftId: plan.draftId || null,
      originalAssignmentIndex: assignmentIndex,
      vesselId: vesselCode,
      vesselName: assignment.vessel || assignment.vesselName || null,
      rankId: assignment.rankId || null,
      rank: assignment.rank,
      crewId: assignment.crewId,
      crewName: assignment.crewName,
      crewMemberId: assignment.crewMemberId || null,
      signOnDate: assignment.signOnDate || assignment.joiningDate,
      joiningPort: assignment.joiningPort || null,
      contractPeriod: assignment.contractPeriod,
      signOffDate: assignment.signOffDate || null,
      proposedBy: plan.proposedBy || null,
      proposedDate: plan.proposedDate || null,
      result: 'Deployed',
      archivedDate,
      archivedBy: deployedBy || null,
      vesselPlanningId: existingPlanningId || null,
      currentCrewInfo: assignment.currentCrew ? JSON.stringify(assignment.currentCrew) : null,
      fullAssignmentSnapshot: JSON.stringify(assignment),
    });

    return { success: true, vesselPlanningId: existingPlanningId || undefined, vesselCode };
  }

  async rejectAssignment(planId: number, assignmentIndex: number, rejectedBy?: string): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return undefined;

    const assignments = JSON.parse(plan.assignments);
    if (!assignments[assignmentIndex]) return undefined;

    const assignment = assignments[assignmentIndex];

    // Mark assignment as rejected (instead of removing it, so it can be archived)
    // Preserve exact rejectedBy value - use null if not available
    assignments[assignmentIndex] = {
      ...assignment,
      proposalStatus: "rejected",
      rejectedDate: new Date().toISOString().split('T')[0],
      rejectedBy: rejectedBy || null
    };

    // Check if all assignments are now processed (deployed or rejected)
    const pendingAssignments = assignments.filter((a: any) => 
      !a.proposalStatus || a.proposalStatus === "proposed"
    );
    const planStatus = pendingAssignments.length === 0 ? "Completed" : plan.planStatus;

    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      planStatus,
      updatedAt: null as any // new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);

    // Create independent archive entry for this rejection with full snapshot
    // Preserve exact source values - use null if not available (no synthetic defaults)
    const archivedDate = new Date().toISOString().split('T')[0];
    // Use original vesselId without translation - preserve exact source value
    const vesselCode = assignment.vesselId || assignment.vessel || null;
    
    await this.createArchiveEntry({
      originalPlanId: planId,
      originalDraftId: plan.draftId || null,
      originalAssignmentIndex: assignmentIndex,
      vesselId: vesselCode,
      vesselName: assignment.vessel || assignment.vesselName || null,
      rankId: assignment.rankId || null,
      rank: assignment.rank,
      crewId: assignment.crewId,
      crewName: assignment.crewName,
      crewMemberId: assignment.crewMemberId || null,
      signOnDate: assignment.signOnDate || assignment.joiningDate,
      joiningPort: assignment.joiningPort || null,
      contractPeriod: assignment.contractPeriod,
      signOffDate: assignment.signOffDate || null,
      proposedBy: plan.proposedBy || null,
      proposedDate: plan.proposedDate || null,
      result: 'Rejected',
      archivedDate,
      archivedBy: rejectedBy || null,
      vesselPlanningId: null,
      currentCrewInfo: assignment.currentCrew ? JSON.stringify(assignment.currentCrew) : null,
      fullAssignmentSnapshot: JSON.stringify(assignment),
    });

    this.saveToFile();
    return updatedPlan;
  }

  async checkAssignmentConflicts(
    crewId: string, 
    signOnDate: string, 
    contractPeriod: number,
    excludePlanId?: number,
    excludeAssignmentIndex?: number
  ): Promise<any[]> {
    const conflicts: any[] = [];
    const signOnDateObj = new Date(signOnDate);
    const contractEndDate = new Date(signOnDateObj);
    contractEndDate.setMonth(contractEndDate.getMonth() + contractPeriod);

    // Check all proposed assignments
    for (const plan of Array.from(this.rotationPlans.values())) {
      if (plan.assignments) {
        const assignments = JSON.parse(plan.assignments);
        for (let i = 0; i < assignments.length; i++) {
          const assignment = assignments[i];
          
          // Skip the assignment being deployed to avoid self-conflict
          if (excludePlanId !== undefined && excludeAssignmentIndex !== undefined) {
            if (plan.id === excludePlanId && i === excludeAssignmentIndex) {
              continue;
            }
          }
          
          if (assignment.crewId === crewId && assignment.proposalStatus === "proposed") {
            const assignmentSignOnDate = new Date(assignment.signOnDate || assignment.joiningDate);
            const assignmentEndDate = new Date(assignmentSignOnDate);
            assignmentEndDate.setMonth(assignmentEndDate.getMonth() + assignment.contractPeriod);

            // Check for overlap
            if (
              (signOnDateObj <= assignmentEndDate && contractEndDate >= assignmentSignOnDate)
            ) {
              conflicts.push({
                planId: plan.id,
                draftId: plan.draftId,
                vessel: assignment.vesselName,
                rank: assignment.rank,
                signOnDate: assignment.signOnDate || assignment.joiningDate,
                contractPeriod: assignment.contractPeriod
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  // Drug/Alcohol Test Records Methods
  async getDrugAlcoholTestRecords(): Promise<DrugAlcoholTestRecord[]> {
    return Array.from(this.drugAlcoholTestRecords.values());
  }

  async getDrugAlcoholTestRecord(id: number): Promise<DrugAlcoholTestRecord | undefined> {
    return this.drugAlcoholTestRecords.get(id);
  }

  async getDrugAlcoholTestRecordsByVessel(vesselId: string, testType?: string): Promise<DrugAlcoholTestRecord[]> {
    const records = Array.from(this.drugAlcoholTestRecords.values()).filter(
      record => record.vesselId === vesselId
    );
    
    if (testType) {
      return records.filter(record => record.testType === testType);
    }
    
    return records;
  }

  async createDrugAlcoholTestRecord(insertRecord: InsertDrugAlcoholTestRecord): Promise<DrugAlcoholTestRecord> {
    const id = this.currentDrugAlcoholTestRecordId++;
    const record: DrugAlcoholTestRecord = {
      ...insertRecord,
      id,
      createdAt: null,
      updatedAt: null,
    };
    this.drugAlcoholTestRecords.set(id, record);
    return record;
  }

  async updateDrugAlcoholTestRecord(id: number, updateData: Partial<InsertDrugAlcoholTestRecord>): Promise<DrugAlcoholTestRecord | undefined> {
    const existingRecord = this.drugAlcoholTestRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: DrugAlcoholTestRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.drugAlcoholTestRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteDrugAlcoholTestRecord(id: number): Promise<boolean> {
    return this.drugAlcoholTestRecords.delete(id);
  }

  // Appraisal Results Methods
  async getAppraisalResults(): Promise<AppraisalResult[]> {
    // Filter out drafts - only return preliminary, submitted, reviewed
    return Array.from(this.appraisalResults.values()).filter(ar => ar.status !== 'draft');
  }

  async getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    return this.appraisalResults.get(id);
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    return Array.from(this.appraisalResults.values()).filter(ar => ar.crewMemberId === crewMemberId);
  }

  async createAppraisalResult(insertAppraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    const id = this.currentAppraisalResultId++;
    const appraisalResult: AppraisalResult = { 
      ...insertAppraisalResult, 
      id,
      competenceRating: insertAppraisalResult.competenceRating || null,
      behavioralRating: insertAppraisalResult.behavioralRating || null,
      overallRating: insertAppraisalResult.overallRating || null,
      status: insertAppraisalResult.status || "draft",
      submittedAt: new Date()
    };
    this.appraisalResults.set(id, appraisalResult);
    return appraisalResult;
  }

  async updateAppraisalResult(id: number, appraisalResultData: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    const existingAppraisalResult = this.appraisalResults.get(id);
    if (!existingAppraisalResult) return undefined;

    const updatedAppraisalResult: AppraisalResult = { 
      ...existingAppraisalResult, 
      ...appraisalResultData
    };
    this.appraisalResults.set(id, updatedAppraisalResult);
    return updatedAppraisalResult;
  }

  async deleteAppraisalResult(id: number): Promise<boolean> {
    return this.appraisalResults.delete(id);
  }

  async submitAppraisalStage(id: number, stage: 'stage1' | 'stage2' | 'stage3', data: any, submittedBy: string): Promise<AppraisalResult | undefined> {
    const existingAppraisal = this.appraisalResults.get(id);
    if (!existingAppraisal) return undefined;

    // Parse existing stage statuses and payloads
    const stageStatuses = existingAppraisal.stageStatuses ? JSON.parse(existingAppraisal.stageStatuses) : {};
    const stagePayloads = existingAppraisal.stagePayloads ? JSON.parse(existingAppraisal.stagePayloads) : {};
    
    // Enforce sequential stage progression
    if (stage === 'stage2' && !stageStatuses.stage1?.status) {
      throw new Error('Stage 1 must be submitted before Stage 2');
    }
    if (stage === 'stage3' && !stageStatuses.stage2?.status) {
      throw new Error('Stage 2 must be submitted before Stage 3');
    }

    // Update stage status
    stageStatuses[stage] = {
      status: 'completed',
      submittedAt: new Date().toISOString(),
      submittedBy: submittedBy
    };

    // Store stage payload separately
    stagePayloads[stage] = data;

    // Determine overall status based on completed stages
    let newStatus = existingAppraisal.status;
    if (stage === 'stage1') {
      newStatus = 'preliminary';
    } else if (stage === 'stage2') {
      newStatus = 'submitted';
    } else if (stage === 'stage3') {
      newStatus = 'reviewed';
    }

    // Parse existing appraisal data and merge all stage payloads
    const appraisalData = existingAppraisal.appraisalData ? JSON.parse(existingAppraisal.appraisalData) : {};
    const updatedData = { ...appraisalData, ...data };

    const updatedAppraisal: AppraisalResult = {
      ...existingAppraisal,
      appraisalData: JSON.stringify(updatedData),
      stageStatuses: JSON.stringify(stageStatuses),
      stagePayloads: JSON.stringify(stagePayloads),
      status: newStatus,
      submittedBy: submittedBy,
      submittedAt: new Date()
    };

    this.appraisalResults.set(id, updatedAppraisal);
    return updatedAppraisal;
  }

  // Recruitment Candidates Methods
  async getRecruitmentCandidates(): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values());
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    return this.recruitmentCandidates.get(id);
  }

  async getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values()).filter(candidate => candidate.status === status);
  }

  async createRecruitmentCandidate(insertCandidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    const candidate: RecruitmentCandidate = { 
      ...insertCandidate,
      middleName: insertCandidate.middleName || null,
      applicationData: insertCandidate.applicationData || null,
      status: insertCandidate.status || "Applied",
      isDelete: false,
      createdAt: null,
      updatedAt: null as any // new Date()
    };
    this.recruitmentCandidates.set(candidate.id, candidate);
    return candidate;
  }

  async updateRecruitmentCandidate(id: string, candidateData: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined> {
    const existingCandidate = this.recruitmentCandidates.get(id);
    if (!existingCandidate) return undefined;

    const updatedCandidate: RecruitmentCandidate = { 
      ...existingCandidate, 
      ...candidateData,
      updatedAt: null as any // new Date()
    };
    this.recruitmentCandidates.set(id, updatedCandidate);
    return updatedCandidate;
  }

  async deleteRecruitmentCandidate(id: string): Promise<boolean> {
    return this.recruitmentCandidates.delete(id);
  }

  async softDeleteRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    const existingCandidate = this.recruitmentCandidates.get(id);
    if (!existingCandidate) return undefined;

    const updatedCandidate: RecruitmentCandidate = { 
      ...existingCandidate, 
      isDelete: true,
      updatedAt: null as any // new Date()
    };
    this.recruitmentCandidates.set(id, updatedCandidate);
    return updatedCandidate;
  }

  async transferRecruitedCandidate(candidateId: string): Promise<{ crewMember: CrewMember; crewId: string }> {
    const candidate = this.recruitmentCandidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Recruitment candidate with ID ${candidateId} not found`);
    }

    if (candidate.status !== 'Recruited') {
      throw new Error(`Candidate must have status 'Recruited' to be transferred. Current status: ${candidate.status}`);
    }

    // Check if already transferred by looking for crew member with matching empNo (fileNo)
    const existingCrew = Array.from(this.crewMembers.values()).find(
      crew => crew.empNo === candidate.fileNo
    );
    
    if (existingCrew) {
      console.log(`⚠️ Candidate ${candidate.fileNo} already transferred to crew database with ID ${existingCrew.id}`);
      return { crewMember: existingCrew, crewId: existingCrew.id };
    }

    const crewId = await this.getNextCrewId();

    let applicationData: any = null;
    if (candidate.applicationData) {
      try {
        applicationData = typeof candidate.applicationData === 'string' 
          ? JSON.parse(candidate.applicationData) 
          : candidate.applicationData;
      } catch (e) {
        console.warn('Failed to parse applicationData:', e);
      }
    }

    // Create crew member from candidate data - Transfer ALL A1 section fields
    const crewMemberData: InsertCrewMember = {
      id: crewId,
      employeeId: crewId, // Set employeeId to display as Crew ID in the database view
      empNo: candidate.fileNo || '',
      
      // Photo (A1 - Crew Photo)
      uploadedPhoto: applicationData?.uploadedPhoto || null,
      
      // A1.1 General Particulars
      firstName: candidate.firstName,
      middleName: candidate.middleName || null,
      familyName: candidate.familyName,
      dateOfBirth: candidate.dob,
      nationality: candidate.nationality,
      presentRank: candidate.rankAppliedFor,
      rankAppliedFor: candidate.rankAppliedFor,
      vesselType: candidate.vesselType || 'General',
      presentVessel: 'Unassigned',
      age: applicationData?.ageInYears || null,
      placeOfBirthCity: applicationData?.placeOfBirthCity || null,
      placeOfBirthCountry: applicationData?.placeOfBirthCountry || null,
      heightCm: applicationData?.heightCm || null,
      weightKg: applicationData?.weightKg || null,
      nativeLanguage: applicationData?.nativeLanguage || null,
      foreignLanguages: applicationData?.foreignLanguages || null,
      englishProficiency: applicationData?.englishProficiency || null,
      manningAgent: applicationData?.manningAgent || null,
      
      // A1.2 Address & Contact Info
      countryOfResidence: applicationData?.countryOfResidence || null,
      nearestAirport: applicationData?.nearestAirport || null,
      residentialAddressLine1: applicationData?.residentialAddressLine1 || null,
      residentialAddressLine2: applicationData?.residentialAddressLine2 || null,
      contactLandline: applicationData?.contactLandline || null,
      mobile: applicationData?.mobile || null,
      email: applicationData?.email || null,
      
      // A1.3 Family and NOK
      maritalStatus: applicationData?.maritalStatus || null,
      numberOfDependentChildren: applicationData?.numberOfDependentChildren || null,
      fatherName: applicationData?.fatherName || null,
      motherName: applicationData?.motherName || null,
      spouseFirstName: applicationData?.spouseFirstName || null,
      spouseMiddleName: applicationData?.spouseMiddleName || null,
      spouseFamilyName: applicationData?.spouseFamilyName || null,
      spouseDateOfBirth: applicationData?.spouseDateOfBirth || null,
      children: applicationData?.children ? JSON.stringify(applicationData.children) : null,
      nokFirstName: applicationData?.nokFirstName || null,
      nokMiddleName: applicationData?.nokMiddleName || null,
      nokFamilyName: applicationData?.nokFamilyName || null,
      nokTelephone: applicationData?.nokTelephone || null,
      nokEmail: applicationData?.nokEmail || null,
      nokAddress: applicationData?.nokAddress || null,
      nokRelationship: applicationData?.nokRelationship || null,
      
      // A2 - Travel & ID Documents
      documents: applicationData?.documents ? JSON.stringify(applicationData.documents) : null,
      visas: applicationData?.visas ? JSON.stringify(applicationData.visas) : null,
      
      // A3 - Training & Certificates
      education: applicationData?.education ? JSON.stringify(applicationData.education) : null,
      licenses: applicationData?.licenses ? JSON.stringify(applicationData.licenses) : null,
      trainingCourses: applicationData?.trainingCourses ? JSON.stringify(applicationData.trainingCourses) : null,
      
      // A4 - Sea Service (recruitment seaService maps to externalSeaService in crew)
      externalSeaService: applicationData?.seaService ? JSON.stringify(applicationData.seaService) : null,
      
      status: 'Active'
    };

    const crewMember = await this.createCrewMember(crewMemberData);
    
    console.log(`✅ Transferred recruited candidate ${candidate.fileNo} to crew database with ID ${crewId}`);
    
    return { crewMember, crewId };
  }

  // Data Masters Methods (stub implementations for MemStorage)
  async getDataMasters(): Promise<DataMaster[]> {
    // MemStorage doesn't have data masters - return empty array
    return [];
  }

  async getDataMaster(id: string): Promise<DataMaster | undefined> {
    // MemStorage doesn't have data masters - return undefined
    return undefined;
  }

  async createDataMaster(master: InsertDataMaster): Promise<DataMaster> {
    // MemStorage doesn't support data masters - throw error
    throw new Error("MemStorage doesn't support data masters. Use DatabaseStorage instead.");
  }

  async updateDataMaster(id: string, master: Partial<InsertDataMaster>): Promise<DataMaster | undefined> {
    // MemStorage doesn't support data masters - throw error
    throw new Error("MemStorage doesn't support data masters. Use DatabaseStorage instead.");
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    // MemStorage doesn't support data masters - throw error
    throw new Error("MemStorage doesn't support data masters. Use DatabaseStorage instead.");
  }

  // Master Data Entries Methods (stub implementations for MemStorage)
  async getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]> {
    // MemStorage doesn't have master data entries - return empty array
    return [];
  }

  async getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined> {
    // MemStorage doesn't have master data entries - return undefined
    return undefined;
  }

  async createMasterDataEntry(entry: InsertMasterDataEntry): Promise<MasterDataEntry> {
    // MemStorage doesn't support master data entries - throw error
    throw new Error("MemStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async updateMasterDataEntry(id: number, entry: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined> {
    // MemStorage doesn't support master data entries - throw error
    throw new Error("MemStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    // MemStorage doesn't support master data entries - throw error
    throw new Error("MemStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  // Rest Hours Vessel Records Methods
  async getRestHoursVesselRecords(): Promise<RestHoursVesselRecord[]> {
    return Array.from(this.restHoursVesselRecords.values());
  }

  async getRestHoursVesselRecord(id: number): Promise<RestHoursVesselRecord | undefined> {
    return this.restHoursVesselRecords.get(id);
  }

  async getRestHoursVesselRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string }): Promise<RestHoursVesselRecord[]> {
    let records = Array.from(this.restHoursVesselRecords.values());
    
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      records = records.filter(record => filters.vesselIds!.includes(record.vesselId));
    }
    
    if (filters.monthValue) {
      records = records.filter(record => record.monthValue === filters.monthValue);
    }
    
    return records;
  }

  async createRestHoursVesselRecord(insertRecord: InsertRestHoursVesselRecord): Promise<RestHoursVesselRecord> {
    const id = this.currentRestHoursVesselRecordId++;
    const record: RestHoursVesselRecord = {
      ...insertRecord,
      id,
      createdAt: null,
      updatedAt: null,
    };
    this.restHoursVesselRecords.set(id, record);
    return record;
  }

  async updateRestHoursVesselRecord(id: number, updateData: Partial<InsertRestHoursVesselRecord>): Promise<RestHoursVesselRecord | undefined> {
    const existingRecord = this.restHoursVesselRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: RestHoursVesselRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.restHoursVesselRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteRestHoursVesselRecord(id: number): Promise<boolean> {
    return this.restHoursVesselRecords.delete(id);
  }

  // Rest Hours Crew Records Methods
  async getRestHoursCrewRecords(): Promise<RestHoursCrewRecord[]> {
    return Array.from(this.restHoursCrewRecords.values());
  }

  async getRestHoursCrewRecord(id: number): Promise<RestHoursCrewRecord | undefined> {
    return this.restHoursCrewRecords.get(id);
  }

  async getRestHoursCrewRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string; ranks?: string[]; search?: string }): Promise<RestHoursCrewRecord[]> {
    let records = Array.from(this.restHoursCrewRecords.values());
    
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      records = records.filter(record => filters.vesselIds!.includes(record.vesselId));
    }
    
    if (filters.monthValue) {
      records = records.filter(record => record.monthValue === filters.monthValue);
    }
    
    if (filters.ranks && filters.ranks.length > 0) {
      records = records.filter(record => filters.ranks!.includes(record.rank));
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      records = records.filter(record => 
        record.name.toLowerCase().includes(searchLower) ||
        record.crewMemberId.toLowerCase().includes(searchLower)
      );
    }
    
    return records;
  }

  async createRestHoursCrewRecord(insertRecord: InsertRestHoursCrewRecord): Promise<RestHoursCrewRecord> {
    const id = this.currentRestHoursCrewRecordId++;
    const record: RestHoursCrewRecord = {
      ...insertRecord,
      id,
      createdAt: null,
      updatedAt: null,
    };
    this.restHoursCrewRecords.set(id, record);
    return record;
  }

  async updateRestHoursCrewRecord(id: number, updateData: Partial<InsertRestHoursCrewRecord>): Promise<RestHoursCrewRecord | undefined> {
    const existingRecord = this.restHoursCrewRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: RestHoursCrewRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.restHoursCrewRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteRestHoursCrewRecord(id: number): Promise<boolean> {
    return this.restHoursCrewRecords.delete(id);
  }

  // Rest Hours Daily Records Methods
  async getRestHoursDailyRecords(): Promise<RestHoursDailyRecord[]> {
    return Array.from(this.restHoursDailyRecords.values());
  }

  async getRestHoursDailyRecord(id: number): Promise<RestHoursDailyRecord | undefined> {
    return this.restHoursDailyRecords.get(id);
  }

  async getRestHoursDailyRecordByKey(crewMemberId: string, vesselId: string, monthYear: string): Promise<RestHoursDailyRecord | undefined> {
    const records = Array.from(this.restHoursDailyRecords.values());
    const matches = records.filter(record => 
      record.crewMemberId === crewMemberId && 
      record.vesselId === vesselId && 
      record.monthYear === monthYear
    );
    
    // If duplicates exist, return the one with the highest ID (most recent)
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];
    
    return matches.reduce((latest, current) => {
      const latestId = Number(latest.id);
      const currentId = Number(current.id);
      return currentId > latestId ? current : latest;
    });
  }

  async createRestHoursDailyRecord(insertRecord: InsertRestHoursDailyRecord): Promise<RestHoursDailyRecord> {
    // Check if a record already exists for this crew/vessel/month (upsert logic)
    const existing = await this.getRestHoursDailyRecordByKey(
      insertRecord.crewMemberId,
      insertRecord.vesselId,
      insertRecord.monthYear
    );
    
    if (existing) {
      // Update existing record instead of creating duplicate
      const updatedRecord: RestHoursDailyRecord = {
        ...existing,
        ...insertRecord,
        id: existing.id, // Keep the original ID
        createdAt: existing.createdAt, // Keep the original creation date
        updatedAt: null,
      };
      this.restHoursDailyRecords.set(existing.id, updatedRecord);
      return updatedRecord;
    }
    
    // Create new record if none exists
    const id = this.currentRestHoursDailyRecordId++;
    const record: RestHoursDailyRecord = {
      ...insertRecord,
      id,
      createdAt: null,
      updatedAt: null,
    };
    this.restHoursDailyRecords.set(id, record);
    return record;
  }

  async updateRestHoursDailyRecord(id: number, updateData: Partial<InsertRestHoursDailyRecord>): Promise<RestHoursDailyRecord | undefined> {
    const existingRecord = this.restHoursDailyRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: RestHoursDailyRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.restHoursDailyRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteRestHoursDailyRecord(id: number): Promise<boolean> {
    return this.restHoursDailyRecords.delete(id);
  }

  // Fixed Tasks Methods
  async getFixedTasks(): Promise<FixedTask[]> {
    return Array.from(this.fixedTasks.values());
  }

  async getFixedTask(id: number): Promise<FixedTask | undefined> {
    return this.fixedTasks.get(id);
  }

  async getFixedTasksByVesselAndMonth(vesselId: string, monthYear: string): Promise<FixedTask[]> {
    const tasks = Array.from(this.fixedTasks.values());
    return tasks.filter(task => 
      task.vesselId === vesselId && 
      task.monthYear === monthYear
    );
  }

  async getFixedTaskByKey(crewMemberId: string, vesselId: string, monthYear: string): Promise<FixedTask | undefined> {
    const tasks = Array.from(this.fixedTasks.values());
    return tasks.find(task => 
      task.crewMemberId === crewMemberId && 
      task.vesselId === vesselId && 
      task.monthYear === monthYear
    );
  }

  async createFixedTask(insertTask: InsertFixedTask): Promise<FixedTask> {
    const id = this.currentFixedTaskId++;
    const task: FixedTask = {
      ...insertTask,
      id,
      createdAt: null,
      updatedAt: null,
    };
    this.fixedTasks.set(id, task);
    return task;
  }

  async updateFixedTask(id: number, updateData: Partial<InsertFixedTask>): Promise<FixedTask | undefined> {
    const existingTask = this.fixedTasks.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask: FixedTask = {
      ...existingTask,
      ...updateData,
      updatedAt: null,
    };
    this.fixedTasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteFixedTask(id: number): Promise<boolean> {
    return this.fixedTasks.delete(id);
  }

  // Vessel Violation Comments Methods
  async getVesselViolationComment(vesselId: string, monthValue: string): Promise<VesselViolationComment | null> {
    const comments = Array.from(this.vesselViolationComments.values());
    const existing = comments.find(c => c.vesselId === vesselId && c.monthValue === monthValue);
    return existing || null;
  }

  async saveVesselViolationComment(insertComment: InsertVesselViolationComment): Promise<VesselViolationComment> {
    // Check if comment already exists for this vessel/month (upsert logic)
    const comments = Array.from(this.vesselViolationComments.values());
    const existing = comments.find(c => c.vesselId === insertComment.vesselId && c.monthValue === insertComment.monthValue);
    
    if (existing) {
      // Update existing comment
      const updated: VesselViolationComment = {
        ...existing,
        comment: insertComment.comment ?? null,
        updatedAt: null,
      };
      this.vesselViolationComments.set(existing.id, updated);
      return updated;
    } else {
      // Create new comment
      const id = this.currentVesselViolationCommentId++;
      const newComment: VesselViolationComment = {
        id,
        ...insertComment,
        createdAt: null,
        updatedAt: null,
      };
      this.vesselViolationComments.set(id, newComment);
      return newComment;
    }
  }

  // Office Violation Comments Methods
  async getOfficeViolationComment(vesselId: string, monthValue: string): Promise<OfficeViolationComment | null> {
    const comments = Array.from(this.officeViolationComments.values());
    const existing = comments.find(c => c.vesselId === vesselId && c.monthValue === monthValue);
    return existing || null;
  }

  async saveOfficeViolationComment(insertComment: InsertOfficeViolationComment): Promise<OfficeViolationComment> {
    // Check if comment already exists for this vessel/month (upsert logic)
    const comments = Array.from(this.officeViolationComments.values());
    const existing = comments.find(c => c.vesselId === insertComment.vesselId && c.monthValue === insertComment.monthValue);
    
    if (existing) {
      // Update existing comment
      const updated: OfficeViolationComment = {
        ...existing,
        ...insertComment,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: null,
      };
      this.officeViolationComments.set(existing.id, updated);
      return updated;
    } else {
      // Create new comment
      const id = this.currentOfficeViolationCommentId++;
      const newComment: OfficeViolationComment = {
        id,
        ...insertComment,
        createdAt: null,
        updatedAt: null,
      };
      this.officeViolationComments.set(id, newComment);
      return newComment;
    }
  }

  // NC Reports Methods
  async getAllNCReports(): Promise<NCReport[]> {
    return Array.from(this.ncReports.values());
  }

  async getNCReport(crewMemberId: string, vesselId: string, monthValue: string): Promise<NCReport | null> {
    const reports = Array.from(this.ncReports.values());
    const existing = reports.find(r => 
      r.crewMemberId === crewMemberId && 
      r.vesselId === vesselId && 
      r.monthValue === monthValue
    );
    return existing || null;
  }

  async saveNCReport(insertReport: InsertNCReport): Promise<NCReport> {
    // Check if report already exists for this crew/vessel/month (upsert logic)
    const reports = Array.from(this.ncReports.values());
    const existing = reports.find(r => 
      r.crewMemberId === insertReport.crewMemberId && 
      r.vesselId === insertReport.vesselId && 
      r.monthValue === insertReport.monthValue
    );
    
    if (existing) {
      // Update existing report
      const updated: NCReport = {
        ...existing,
        ...insertReport,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: null,
      };
      this.ncReports.set(existing.id, updated);
      return updated;
    } else {
      // Create new report
      const id = this.currentNCReportId++;
      const newReport: NCReport = {
        id,
        ...insertReport,
        createdAt: null,
        updatedAt: null,
      };
      this.ncReports.set(id, newReport);
      return newReport;
    }
  }

  async getVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<VesselDateLineAdjustment | null> {
    const adjustments = Array.from(this.vesselDateLineAdjustments.values());
    const existing = adjustments.find(a => a.vesselId === vesselId && a.monthValue === monthValue);
    return existing || null;
  }

  async saveVesselDateLineAdjustment(insertAdjustment: InsertVesselDateLineAdjustment): Promise<VesselDateLineAdjustment> {
    const adjustments = Array.from(this.vesselDateLineAdjustments.values());
    const existing = adjustments.find(a => 
      a.vesselId === insertAdjustment.vesselId && 
      a.monthValue === insertAdjustment.monthValue
    );
    
    if (existing) {
      const updated: VesselDateLineAdjustment = {
        ...existing,
        ...insertAdjustment,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: null,
      };
      this.vesselDateLineAdjustments.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentVesselDateLineAdjustmentId++;
      const newAdjustment: VesselDateLineAdjustment = {
        id,
        ...insertAdjustment,
        createdAt: null,
        updatedAt: null,
      };
      this.vesselDateLineAdjustments.set(id, newAdjustment);
      return newAdjustment;
    }
  }

  async deleteVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<boolean> {
    const adjustments = Array.from(this.vesselDateLineAdjustments.values());
    const existing = adjustments.find(a => a.vesselId === vesselId && a.monthValue === monthValue);
    
    if (existing) {
      this.vesselDateLineAdjustments.delete(existing.id);
      return true;
    }
    return false;
  }

  async clearAdvancedDaysData(vesselId: string, monthValue: string, advancedDays: number[]): Promise<boolean> {
    if (advancedDays.length === 0) return true;
    
    const allDailyRecords = Array.from(this.restHoursDailyRecords.values());
    const relevantRecords = allDailyRecords.filter(
      record => record.vesselId === vesselId && record.monthYear === monthValue
    );
    
    for (const record of relevantRecords) {
      let dailyRecords;
      try {
        dailyRecords = JSON.parse(record.dailyRecords);
      } catch (e) {
        continue;
      }
      
      if (!Array.isArray(dailyRecords)) continue;
      
      let modified = false;
      for (const dayRecord of dailyRecords) {
        if (advancedDays.includes(dayRecord.day)) {
          dayRecord.hours = Array(48).fill('');
          dayRecord.isPlan = false;
          dayRecord.comments = '';
          dayRecord.violations = [];
          modified = true;
        }
      }
      
      if (modified) {
        this.restHoursDailyRecords.set(record.id, {
          ...record,
          dailyRecords: JSON.stringify(dailyRecords),
        });
      }
    }
    
    return true;
  }

  // Variable Tasks Methods
  async getVariableTasks(): Promise<VariableTask[]> {
    return Array.from(this.variableTasks.values());
  }

  async getVariableTask(id: number): Promise<VariableTask | undefined> {
    return this.variableTasks.get(id);
  }

  async getVariableTasksByFilters(filters: { vesselId?: string; periodValue?: string }): Promise<VariableTask[]> {
    const tasks = Array.from(this.variableTasks.values());
    return tasks.filter(task => {
      if (filters.vesselId && task.vesselId !== filters.vesselId) return false;
      if (filters.periodValue && task.periodValue !== filters.periodValue) return false;
      return true;
    });
  }

  async createVariableTask(insertTask: InsertVariableTask): Promise<VariableTask> {
    const id = this.currentVariableTaskId++;
    const task: VariableTask = {
      ...insertTask,
      id,
    };
    this.variableTasks.set(id, task);
    return task;
  }

  async updateVariableTask(id: number, updateData: Partial<InsertVariableTask>): Promise<VariableTask | undefined> {
    const existingTask = this.variableTasks.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask: VariableTask = {
      ...existingTask,
      ...updateData,
    };
    this.variableTasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteVariableTask(id: number): Promise<boolean> {
    return this.variableTasks.delete(id);
  }
}
End of MemStorage - commented out */

// PersistentFileStorage class - saves data to JSON file for persistence across restarts
export class PersistentFileStorage implements IStorage {
  private users: Map<number, User>;
  private forms: Map<number, Form>;
  private rankGroups: Map<number, RankGroup>;
  private availableRanks: Map<number, AvailableRank>;
  private companyRanks: Map<string, CompanyRank>;
  private promotionHierarchies: Map<number, PromotionHierarchy>;
  private crewMembers: Map<string, CrewMember>;
  private appraisalResults: Map<number, AppraisalResult>;
  private recruitmentCandidates: Map<string, RecruitmentCandidate>;
  private vesselGroups: Map<number, VesselGroup>;
  private masterDataEntries: Map<string, any>;
  private vesselDrafts: Map<number, VesselDraft>;
  private vesselRevisions: Map<number, VesselRevision>;
  private vesselPlanning: Map<number, VesselPlanning>;
  private rotationPlans: Map<number, RotationPlan>;
  private rotationArchive: Map<number, RotationArchiveEntry>;
  private drugAlcoholTestRecords: Map<number, DrugAlcoholTestRecord>;
  private restHoursVesselRecords: Map<number, RestHoursVesselRecord>;
  private restHoursCrewRecords: Map<number, RestHoursCrewRecord>;
  private restHoursDailyRecords: Map<number, RestHoursDailyRecord>;
  private variableTasks: Map<number, VariableTask>;
  private fixedTasks: Map<number, FixedTask>;
  private vesselViolationComments: Map<number, VesselViolationComment>;
  private officeViolationComments: Map<number, OfficeViolationComment>;
  private ncReports: Map<number, NCReport>;
  private vesselDateLineAdjustments: Map<number, VesselDateLineAdjustment>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentPromotionHierarchyId: number;
  private currentAppraisalResultId: number;
  private currentCrewIdCounter: number;
  private currentVesselGroupId: number;
  private currentVesselDraftId: number;
  private currentVesselRevisionId: number;
  private currentVesselPlanningId: number;
  private currentRotationPlanId: number;
  private currentRotationArchiveId: number;
  private currentDrugAlcoholTestRecordId: number;
  private currentRestHoursVesselRecordId: number;
  private currentRestHoursCrewRecordId: number;
  private currentRestHoursDailyRecordId: number;
  private currentVariableTaskId: number;
  private currentFixedTaskId: number;
  private currentVesselViolationCommentId: number;
  private currentOfficeViolationCommentId: number;
  private currentNCReportId: number;
  private currentVesselDateLineAdjustmentId: number;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving: boolean = false;
  private needsResave: boolean = false;
  private pendingData: any = null;

  constructor() {
    // Initialize all properties first
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.promotionHierarchies = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.vesselGroups = new Map();
    this.masterDataEntries = new Map();
    this.vesselDrafts = new Map();
    this.vesselRevisions = new Map();
    this.vesselPlanning = new Map();
    this.rotationPlans = new Map();
    this.rotationArchive = new Map();
    this.drugAlcoholTestRecords = new Map();
    this.restHoursVesselRecords = new Map();
    this.restHoursCrewRecords = new Map();
    this.restHoursDailyRecords = new Map();
    this.variableTasks = new Map();
    this.fixedTasks = new Map();
    this.vesselViolationComments = new Map();
    this.officeViolationComments = new Map();
    this.ncReports = new Map();
    this.vesselDateLineAdjustments = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentPromotionHierarchyId = 1;
    this.currentAppraisalResultId = 1;
    this.currentCrewIdCounter = 1;
    this.currentVesselGroupId = 1;
    this.currentVesselDraftId = 1;
    this.currentVesselRevisionId = 1;
    this.currentVesselPlanningId = 1;
    this.currentRotationPlanId = 1;
    this.currentRotationArchiveId = 1;
    this.currentDrugAlcoholTestRecordId = 1;
    this.currentRestHoursVesselRecordId = 1;
    this.currentRestHoursCrewRecordId = 1;
    this.currentRestHoursDailyRecordId = 1;
    this.currentVariableTaskId = 1;
    this.currentFixedTaskId = 1;
    this.currentVesselViolationCommentId = 1;
    this.currentOfficeViolationCommentId = 1;
    this.currentNCReportId = 1;
    this.currentVesselDateLineAdjustmentId = 1;
    
    this.filePath = path.join(process.cwd(), 'test-data.json');
    this.loadFromFile();
  }

  private migrateRotationPlanAssignments(): void {
    // Fix any rotation plans with assignments that have undefined assignmentIndex
    let plansFixed = 0;
    
    for (const [planId, plan] of Array.from(this.rotationPlans.entries())) {
      if (plan.assignments) {
        try {
          const assignments = JSON.parse(plan.assignments);
          let needsFix = false;
          
          // Check if any assignment has undefined or invalid assignmentIndex
          for (let i = 0; i < assignments.length; i++) {
            if (assignments[i].assignmentIndex === undefined || assignments[i].assignmentIndex !== i) {
              needsFix = true;
              break;
            }
          }
          
          if (needsFix) {
            // Clean up assignments: remove assignmentIndex field and let it be set by index
            const cleanedAssignments = assignments.map((assignment: any, index: number) => {
              const { assignmentIndex, ...cleaned } = assignment;
              return {
                ...cleaned,
                proposalStatus: assignment.proposalStatus || "proposed"
              };
            });
            
            // Update the plan
            const updatedPlan = {
              ...plan,
              assignments: JSON.stringify(cleanedAssignments)
            };
            this.rotationPlans.set(planId, updatedPlan);
            plansFixed++;
          }
        } catch (error) {
          console.error(`Failed to migrate rotation plan ${planId}:`, error);
        }
      }
    }
    
    if (plansFixed > 0) {
      console.log(`🔧 Migrated ${plansFixed} rotation plans to fix assignment indices`);
      this.saveToFile();
    }
  }

  private deduplicateDailyRecords(): void {
    // Group records by crew/vessel/month key
    const grouped = new Map<string, RestHoursDailyRecord[]>();
    
    for (const record of Array.from(this.restHoursDailyRecords.values())) {
      const key = `${record.crewMemberId}-${record.vesselId}-${record.monthYear}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }
    
    // Find and remove duplicates (keep highest ID)
    let duplicatesRemoved = 0;
    for (const [key, records] of Array.from(grouped.entries())) {
      if (records.length > 1) {
        // Sort by numeric ID (highest first)
        records.sort((a, b) => Number(b.id) - Number(a.id));
        const keepRecord = records[0]; // Highest ID
        const removeRecords = records.slice(1); // All others
        
        // Remove duplicates from the Map
        for (const record of removeRecords) {
          this.restHoursDailyRecords.delete(record.id);
          duplicatesRemoved++;
        }
      }
    }
    
    if (duplicatesRemoved > 0) {
      console.log(`🔧 Deduplicated ${duplicatesRemoved} duplicate daily records (kept highest ID for each crew/vessel/month)`);
      // Save cleaned data back to file
      this.saveToFile();
    }
  }

  private loadNestedMapData(data: any): Map<number, VesselRevision> {
    // Helper function to recursively extract revision objects from nested arrays
    const extractRevisions = (arr: any, results: VesselRevision[] = []): VesselRevision[] => {
      if (!Array.isArray(arr)) return results;
      
      for (const item of arr) {
        if (Array.isArray(item) && item.length === 2) {
          const [key, value] = item;
          // Check if value is a revision object (has vesselId property)
          if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.vesselId) {
            results.push(value);
          } else {
            // Recursively search in nested arrays
            extractRevisions(item, results);
          }
        }
      }
      return results;
    };
    
    const revisions = extractRevisions(data);
    const map = new Map<number, VesselRevision>();
    
    for (const revision of revisions) {
      if (revision.id !== undefined) {
        map.set(revision.id, revision);
      }
    }
    
    console.log(`📊 Loaded ${map.size} vessel revisions from file`);
    return map;
  }

  // Vessel Violation Comments Methods
  async getVesselViolationComment(vesselId: string, monthValue: string): Promise<VesselViolationComment | null> {
    const comments = Array.from(this.vesselViolationComments.values());
    const existing = comments.find(c => c.vesselId === vesselId && c.monthValue === monthValue);
    return existing || null;
  }

  async saveVesselViolationComment(insertComment: InsertVesselViolationComment): Promise<VesselViolationComment> {
    // Check if comment already exists for this vessel/month (upsert logic)
    const comments = Array.from(this.vesselViolationComments.values());
    const existing = comments.find(c => c.vesselId === insertComment.vesselId && c.monthValue === insertComment.monthValue);
    
    if (existing) {
      // Update existing comment
      const updated: VesselViolationComment = {
        ...existing,
        comment: insertComment.comment ?? null,
        updatedAt: null,
      };
      this.vesselViolationComments.set(existing.id, updated);
      this.saveToFile();
      return updated;
    } else {
      // Create new comment
      const id = this.currentVesselViolationCommentId++;
      const newComment: VesselViolationComment = {
        id,
        vesselId: insertComment.vesselId,
        monthValue: insertComment.monthValue,
        comment: insertComment.comment ?? null,
        createdAt: null,
        updatedAt: null,
      };
      this.vesselViolationComments.set(id, newComment);
      this.saveToFile();
      return newComment;
    }
  }

  // Office Violation Comments Methods
  async getOfficeViolationComment(vesselId: string, monthValue: string): Promise<OfficeViolationComment | null> {
    const comments = Array.from(this.officeViolationComments.values());
    const existing = comments.find(c => c.vesselId === vesselId && c.monthValue === monthValue);
    return existing || null;
  }

  async saveOfficeViolationComment(insertComment: InsertOfficeViolationComment): Promise<OfficeViolationComment> {
    // Check if comment already exists for this vessel/month (upsert logic)
    const comments = Array.from(this.officeViolationComments.values());
    const existing = comments.find(c => c.vesselId === insertComment.vesselId && c.monthValue === insertComment.monthValue);
    
    if (existing) {
      // Update existing comment
      const updated: OfficeViolationComment = {
        ...existing,
        ...insertComment,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: null,
      };
      this.officeViolationComments.set(existing.id, updated);
      this.saveToFile();
      return updated;
    } else {
      // Create new comment
      const id = this.currentOfficeViolationCommentId++;
      const newComment: OfficeViolationComment = {
        id,
        vesselId: insertComment.vesselId,
        monthValue: insertComment.monthValue,
        comment: insertComment.comment ?? null,
        reviewerName: insertComment.reviewerName ?? null,
        reviewerPosition: insertComment.reviewerPosition ?? null,
        reviewDate: insertComment.reviewDate ?? null,
        createdAt: null,
        updatedAt: null,
      };
      this.officeViolationComments.set(id, newComment);
      this.saveToFile();
      return newComment;
    }
  }

  // NC Reports Methods
  async getAllNCReports(): Promise<NCReport[]> {
    return Array.from(this.ncReports.values());
  }

  async getNCReport(crewMemberId: string, vesselId: string, monthValue: string): Promise<NCReport | null> {
    const reports = Array.from(this.ncReports.values());
    const existing = reports.find(r => 
      r.crewMemberId === crewMemberId && 
      r.vesselId === vesselId && 
      r.monthValue === monthValue
    );
    return existing || null;
  }

  async saveNCReport(insertReport: InsertNCReport): Promise<NCReport> {
    const reports = Array.from(this.ncReports.values());
    const existing = reports.find(r => 
      r.crewMemberId === insertReport.crewMemberId && 
      r.vesselId === insertReport.vesselId && 
      r.monthValue === insertReport.monthValue
    );
    
    if (existing) {
      const updated: NCReport = {
        ...existing,
        ...insertReport,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: null,
      };
      this.ncReports.set(existing.id, updated);
      this.saveToFile();
      return updated;
    } else {
      const id = this.currentNCReportId++;
      const newReport: NCReport = {
        id,
        crewMemberId: insertReport.crewMemberId,
        vesselId: insertReport.vesselId,
        monthValue: insertReport.monthValue,
        rank: insertReport.rank,
        status: insertReport.status ?? "Open",
        ncReference: insertReport.ncReference ?? "STCW/MLC/ILO",
        identifiedRootCause: insertReport.identifiedRootCause ?? null,
        immediateCorrectiveAction: insertReport.immediateCorrectiveAction ?? null,
        preventiveAction: insertReport.preventiveAction ?? null,
        preventiveActionStatus: insertReport.preventiveActionStatus ?? "Pending",
        preventiveActionDueDate: insertReport.preventiveActionDueDate ?? null,
        preventiveActionDateCompleted: insertReport.preventiveActionDateCompleted ?? null,
        officeClosureVerifiedByName: insertReport.officeClosureVerifiedByName ?? null,
        officeClosureVerifiedByPosition: insertReport.officeClosureVerifiedByPosition ?? null,
        officeClosureDate: insertReport.officeClosureDate ?? null,
        submissionStatus: insertReport.submissionStatus ?? "draft",
        createdAt: null,
        updatedAt: null,
      };
      this.ncReports.set(id, newReport);
      this.saveToFile();
      return newReport;
    }
  }

  async getVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<VesselDateLineAdjustment | null> {
    const adjustments = Array.from(this.vesselDateLineAdjustments.values());
    const existing = adjustments.find(a => a.vesselId === vesselId && a.monthValue === monthValue);
    return existing || null;
  }

  async saveVesselDateLineAdjustment(insertAdjustment: InsertVesselDateLineAdjustment): Promise<VesselDateLineAdjustment> {
    const adjustments = Array.from(this.vesselDateLineAdjustments.values());
    const existing = adjustments.find(a => 
      a.vesselId === insertAdjustment.vesselId && 
      a.monthValue === insertAdjustment.monthValue
    );
    
    if (existing) {
      const updated: VesselDateLineAdjustment = {
        ...existing,
        ...insertAdjustment,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: null,
      };
      this.vesselDateLineAdjustments.set(existing.id, updated);
      this.saveToFile();
      return updated;
    } else {
      const id = this.currentVesselDateLineAdjustmentId++;
      const newAdjustment: VesselDateLineAdjustment = {
        id,
        ...insertAdjustment,
        createdAt: null,
        updatedAt: null,
      };
      this.vesselDateLineAdjustments.set(id, newAdjustment);
      this.saveToFile();
      return newAdjustment;
    }
  }

  async deleteVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<boolean> {
    const adjustments = Array.from(this.vesselDateLineAdjustments.values());
    const existing = adjustments.find(a => a.vesselId === vesselId && a.monthValue === monthValue);
    
    if (existing) {
      this.vesselDateLineAdjustments.delete(existing.id);
      this.saveToFile();
      return true;
    }
    return false;
  }

  async clearAdvancedDaysData(vesselId: string, monthValue: string, advancedDays: number[]): Promise<boolean> {
    if (advancedDays.length === 0) return true;
    
    const allDailyRecords = Array.from(this.restHoursDailyRecords.values());
    const relevantRecords = allDailyRecords.filter(
      record => record.vesselId === vesselId && record.monthYear === monthValue
    );
    
    for (const record of relevantRecords) {
      let dailyRecords;
      try {
        dailyRecords = JSON.parse(record.dailyRecords);
      } catch (e) {
        continue;
      }
      
      if (!Array.isArray(dailyRecords)) continue;
      
      let modified = false;
      for (const dayRecord of dailyRecords) {
        if (advancedDays.includes(dayRecord.day)) {
          dayRecord.hours = Array(48).fill('');
          dayRecord.isPlan = false;
          dayRecord.comments = '';
          dayRecord.violations = [];
          modified = true;
        }
      }
      
      if (modified) {
        this.restHoursDailyRecords.set(record.id, {
          ...record,
          dailyRecords: JSON.stringify(dailyRecords),
        });
      }
    }
    
    if (relevantRecords.length > 0) {
      this.saveToFile();
    }
    
    return true;
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // Convert arrays back to Maps
        this.users = new Map(data.users || []);
        this.forms = new Map(data.forms || []);
        this.rankGroups = new Map(data.rankGroups || []);
        this.availableRanks = new Map(data.availableRanks || []);
        this.companyRanks = new Map(data.companyRanks || []);
        this.promotionHierarchies = new Map(data.promotionHierarchies || []);
        this.crewMembers = new Map(data.crewMembers || []);
        this.appraisalResults = new Map(data.appraisalResults || []);
        this.recruitmentCandidates = new Map(data.recruitmentCandidates || []);
        this.vesselGroups = new Map(data.vesselGroups || []);
        this.masterDataEntries = new Map(data.masterDataEntries || []);
        
        // Load current counters
        this.currentUserId = data.currentUserId || 1;
        this.currentFormId = data.currentFormId || 2;
        this.currentRankGroupId = data.currentRankGroupId || 1;
        this.currentAvailableRankId = data.currentAvailableRankId || 11;
        this.currentPromotionHierarchyId = data.currentPromotionHierarchyId || 1;
        this.currentAppraisalResultId = data.currentAppraisalResultId || 1;
        
        // Robust crew ID counter initialization
        if (data.currentCrewIdCounter) {
          this.currentCrewIdCounter = data.currentCrewIdCounter;
        } else {
          // First run with existing data - scan for highest existing A-series ID
          this.currentCrewIdCounter = this.initializeCrewIdCounter();
        }

        // Initialize vessel group counter
        this.currentVesselGroupId = data.currentVesselGroupId || 1;
        
        // Load vessel drafts and counter (same format as other maps)
        this.vesselDrafts = new Map(data.vesselDrafts || []);
        this.currentVesselDraftId = data.currentVesselDraftId || 1;
        
        // Load vessel revisions and counter - flatten nested structure if needed
        this.vesselRevisions = this.loadNestedMapData(data.vesselRevisions || []);
        this.currentVesselRevisionId = data.currentVesselRevisionId || 1;
        
        // Load vessel planning and counter
        this.vesselPlanning = new Map(data.vesselPlanning || []);
        this.currentVesselPlanningId = data.currentVesselPlanningId || 1;
        
        // Load rotation plans and counter
        this.rotationPlans = new Map(data.rotationPlans || []);
        this.currentRotationPlanId = data.currentRotationPlanId || 1;
        
        // Load rotation archive (independent historical records)
        this.rotationArchive = new Map(data.rotationArchive || []);
        this.currentRotationArchiveId = data.currentRotationArchiveId || 1;
        
        // Load drug/alcohol test records and counter
        this.drugAlcoholTestRecords = new Map(data.drugAlcoholTestRecords || []);
        this.currentDrugAlcoholTestRecordId = data.currentDrugAlcoholTestRecordId || 1;
        
        // Load rest hours vessel records and counter
        this.restHoursVesselRecords = new Map(data.restHoursVesselRecords || []);
        this.currentRestHoursVesselRecordId = data.currentRestHoursVesselRecordId || 1;
        
        // Load rest hours crew records and counter
        this.restHoursCrewRecords = new Map(data.restHoursCrewRecords || []);
        this.currentRestHoursCrewRecordId = data.currentRestHoursCrewRecordId || 1;
        
        // Load rest hours daily records and counter
        this.restHoursDailyRecords = new Map(data.restHoursDailyRecords || []);
        this.currentRestHoursDailyRecordId = data.currentRestHoursDailyRecordId || 1;
        
        // Deduplicate daily records (keep highest ID for each crew/vessel/month)
        this.deduplicateDailyRecords();
        
        // Load variable tasks and counter
        this.variableTasks = new Map(data.variableTasks || []);
        this.currentVariableTaskId = data.currentVariableTaskId || 1;
        this.fixedTasks = new Map(data.fixedTasks || []);
        this.currentFixedTaskId = data.currentFixedTaskId || 1;
        
        // Load vessel violation comments and counter
        this.vesselViolationComments = new Map(data.vesselViolationComments || []);
        this.currentVesselViolationCommentId = data.currentVesselViolationCommentId || 1;
        
        // Load office violation comments and counter
        this.officeViolationComments = new Map(data.officeViolationComments || []);
        this.currentOfficeViolationCommentId = data.currentOfficeViolationCommentId || 1;
        
        // Load NC reports and counter
        this.ncReports = new Map(data.ncReports || []);
        this.currentNCReportId = data.currentNCReportId || 1;
        
        console.log("📄 Loaded existing data from test-data.json");
        
        // Run data migration to fix rotation plan assignments
        this.migrateRotationPlanAssignments();
        
        // Initialize rest hours sample data if empty
        if (this.restHoursVesselRecords.size === 0) {
          console.log("📊 Initializing rest hours sample data for testing");
          this.initializeRestHoursSampleData();
          this.saveToFile();
        }
      } else {
        console.log("📄 test-data.json not found, initializing with default data");
        this.initializeDefaultData();
        this.saveToFile();
      }
    } catch (error) {
      console.error("⚠️ Error loading test-data.json, falling back to default data:", error);
      this.initializeDefaultData();
      this.saveToFile();
    }
  }

  private saveToFile(): void {
    this.pendingData = {
      users: Array.from(this.users.entries()),
      forms: Array.from(this.forms.entries()),
      rankGroups: Array.from(this.rankGroups.entries()),
      availableRanks: Array.from(this.availableRanks.entries()),
      companyRanks: Array.from(this.companyRanks.entries()),
      promotionHierarchies: Array.from(this.promotionHierarchies.entries()),
      crewMembers: Array.from(this.crewMembers.entries()),
      appraisalResults: Array.from(this.appraisalResults.entries()),
      recruitmentCandidates: Array.from(this.recruitmentCandidates.entries()),
      vesselGroups: Array.from(this.vesselGroups.entries()),
      vesselDrafts: Array.from(this.vesselDrafts.entries()),
      vesselRevisions: Array.from(this.vesselRevisions.entries()),
      vesselPlanning: Array.from(this.vesselPlanning.entries()),
      rotationPlans: Array.from(this.rotationPlans.entries()),
      rotationArchive: Array.from(this.rotationArchive.entries()),
      drugAlcoholTestRecords: Array.from(this.drugAlcoholTestRecords.entries()),
      restHoursVesselRecords: Array.from(this.restHoursVesselRecords.entries()),
      restHoursCrewRecords: Array.from(this.restHoursCrewRecords.entries()),
      restHoursDailyRecords: Array.from(this.restHoursDailyRecords.entries()),
      variableTasks: Array.from(this.variableTasks.entries()),
      fixedTasks: Array.from(this.fixedTasks.entries()),
      vesselViolationComments: Array.from(this.vesselViolationComments.entries()),
      officeViolationComments: Array.from(this.officeViolationComments.entries()),
      ncReports: Array.from(this.ncReports.entries()),
      masterDataEntries: Array.from(this.masterDataEntries.entries()),
      currentUserId: this.currentUserId,
      currentFormId: this.currentFormId,
      currentRankGroupId: this.currentRankGroupId,
      currentAvailableRankId: this.currentAvailableRankId,
      currentPromotionHierarchyId: this.currentPromotionHierarchyId,
      currentAppraisalResultId: this.currentAppraisalResultId,
      currentCrewIdCounter: this.currentCrewIdCounter,
      currentVesselGroupId: this.currentVesselGroupId,
      currentVesselDraftId: this.currentVesselDraftId,
      currentVesselRevisionId: this.currentVesselRevisionId,
      currentVesselPlanningId: this.currentVesselPlanningId,
      currentRotationPlanId: this.currentRotationPlanId,
      currentRotationArchiveId: this.currentRotationArchiveId,
      currentDrugAlcoholTestRecordId: this.currentDrugAlcoholTestRecordId,
      currentRestHoursVesselRecordId: this.currentRestHoursVesselRecordId,
      currentRestHoursCrewRecordId: this.currentRestHoursCrewRecordId,
      currentRestHoursDailyRecordId: this.currentRestHoursDailyRecordId,
      currentVariableTaskId: this.currentVariableTaskId,
      currentFixedTaskId: this.currentFixedTaskId,
      currentVesselViolationCommentId: this.currentVesselViolationCommentId,
      currentOfficeViolationCommentId: this.currentOfficeViolationCommentId,
      currentNCReportId: this.currentNCReportId
    };
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(async () => {
      if (this.isSaving) {
        this.needsResave = true;
        return;
      }
      
      this.isSaving = true;
      try {
        await fs.promises.writeFile(this.filePath, JSON.stringify(this.pendingData), 'utf8');
        console.log("💾 Data saved to test-data.json");
      } catch (error) {
        console.error("⚠️ Error saving to test-data.json:", error);
      } finally {
        this.isSaving = false;
        
        if (this.needsResave) {
          this.needsResave = false;
          this.saveToFile();
        }
      }
    }, 300);
  }

  private initializeDefaultData(): void {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.masterDataEntries = new Map();
    this.currentUserId = 1;
    this.currentFormId = 2;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 11;
    this.currentAppraisalResultId = 1;
    this.currentCrewIdCounter = 1;

    // Initialize with sample form data
    this.forms.set(1, {
      id: 1,
      name: "Crew Appraisal Form",
      category: "Appraisal",
      rankGroup: "Senior Officers",
      versionNo: "01",
      versionDate: "01-Jan-2025",
      configuration: null,
    });

    // Initialize with sample available ranks
    this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "S1", label: "Master", applicableToCompany: true, sortOrder: 1 });
    this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "S2", label: "Chief Officer", applicableToCompany: true, sortOrder: 2 });
    this.availableRanks.set(3, { id: 3, name: "Chief Engineer", category: "Senior Officers", rankId: "S7", label: "Chief Engineer", applicableToCompany: true, sortOrder: 3 });
    this.availableRanks.set(4, { id: 4, name: "2nd Officer", category: "Junior Officers", rankId: "S3", label: "2nd Officer", applicableToCompany: true, sortOrder: 4 });
    this.availableRanks.set(5, { id: 5, name: "3rd Officer", category: "Junior Officers", rankId: "S4", label: "3rd Officer", applicableToCompany: true, sortOrder: 5 });
    this.availableRanks.set(6, { id: 6, name: "2nd Engineer", category: "Junior Officers", rankId: "S9", label: "2nd Engineer", applicableToCompany: true, sortOrder: 6 });
    this.availableRanks.set(7, { id: 7, name: "3rd Engineer", category: "Junior Officers", rankId: "S10", label: "3rd Engineer", applicableToCompany: true, sortOrder: 7 });
    this.availableRanks.set(8, { id: 8, name: "Bosun", category: "Ratings", rankId: "S12", label: "Bosun", applicableToCompany: true, sortOrder: 8 });
    this.availableRanks.set(9, { id: 9, name: "AB", category: "Ratings", rankId: "S14", label: "AB", applicableToCompany: true, sortOrder: 9 });
    this.availableRanks.set(10, { id: 10, name: "OS", category: "Ratings", rankId: "S15", label: "OS", applicableToCompany: false, sortOrder: 10 });

    // Initialize sample recruitment candidate
    const sampleCandidate: RecruitmentCandidate = {
      id: "2025-09-23-1758595508955",
      fileNo: "RC-2025-001",
      firstName: "Mark",
      middleName: "Tan",
      familyName: "Twait",
      dob: "1981-01-04",
      nationality: "Malaysian",
      rankAppliedFor: "Master",
      presentRank: "Master",
      vesselType: JSON.stringify(["Oil Tanker"]),
      status: "Applied",
      applicationData: JSON.stringify({
        firstName: "Mark",
        middleName: "Tan",
        familyName: "Twait",
        nationality: "Malaysian",
        presentRank: "Master",
        vesselType: ["Oil Tanker"],
        dateOfBirth: "1981-01-04",
        ageInYears: "44",
        nativeLanguage: "English",
        foreignLanguages: "Spanish",
        englishProficiency: "Good",
        rankAppliedFor: "Master",
        manningAgent: "ABC ",
        fileNo: "M2025-955"
      }),
      isDelete: false,
      createdAt: null,
      updatedAt: null,
    };

    this.recruitmentCandidates.set(sampleCandidate.id, sampleCandidate);

    // Add additional recruitment candidates (from original MemStorage)
    this.recruitmentCandidates.set("RC-2025-002", {
      id: "RC-2025-002",
      fileNo: "RF-2025-002",
      firstName: "Sarah",
      middleName: null,
      familyName: "Rodriguez",
      dob: "1990-07-22",
      nationality: "Spanish",
      rankAppliedFor: "3rd Engineer",
      presentRank: "Engine Cadet",
      vesselType: "Oil Tanker",
      status: "Screening",
      applicationData: null,
      isDelete: false,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-003", {
      id: "RC-2025-003",
      fileNo: "RF-2025-003",
      firstName: "Alexander",
      middleName: "Viktor",
      familyName: "Petrov",
      dob: "1982-11-08",
      nationality: "Russian",
      rankAppliedFor: "Master",
      presentRank: "Chief Officer",
      vesselType: "Bulk Carrier",
      status: "For Approval",
      applicationData: null,
      isDelete: false,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-004", {
      id: "RC-2025-004",
      fileNo: "RF-2025-004",
      firstName: "Priya",
      middleName: "Devi",
      familyName: "Sharma",
      dob: "1993-02-14",
      nationality: "Indian",
      rankAppliedFor: "Able Seaman",
      presentRank: "Ordinary Seaman",
      vesselType: "LPG Tanker",
      status: "Applied",
      applicationData: null,
      isDelete: false,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-005", {
      id: "RC-2025-005",
      fileNo: "RF-2025-005",
      firstName: "Ahmed",
      middleName: "Hassan",
      familyName: "Al-Rashid",
      dob: "1985-09-30",
      nationality: "Egyptian",
      rankAppliedFor: "Chief Officer",
      presentRank: "2nd Officer",
      vesselType: "Container",
      status: "Recruited",
      applicationData: null,
      isDelete: false,
      createdAt: null,
      updatedAt: null as any // new Date("2025-09-23")
    });

    // Initialize with sample crew member data (from original MemStorage)
    this.crewMembers.set("2025-05-14", {
      id: "2025-05-14",
      firstName: "James",
      middleName: "Michael",
      familyName: "Wilson",
      presentRank: "Master",
      nationality: "British",
      presentVessel: "MT Sail One",
      vesselType: "Oil Tanker",
      signOnDate: "01-Feb-2025",
      createdAt: null,
      updatedAt: null,
      uploadedPhoto: null,
      status: null,
      isActive: true,
      nextAvailability: null,
      empNo: null,
      dateOfBirth: null,
      age: null,
      rankAppliedFor: null,
      employeeId: null,
      lastVessel: null,
      signOffDate: null,
      contractPeriod: null,
      reliefDue: null,
      reason: null,
      availability: null,
      email: null,
      mobile: null,
      contactLandline: null,
      countryOfResidence: null,
      nearestAirport: null,
      residentialAddressLine1: null,
      residentialAddressLine2: null,
      placeOfBirthCity: null,
      placeOfBirthCountry: null,
      heightCm: null,
      weightKg: null,
      bmi: null,
      nativeLanguage: null,
      foreignLanguages: null,
      englishProficiency: null,
      maritalStatus: null,
      numberOfDependentChildren: null,
      fatherName: null,
      motherName: null,
      spouseFirstName: null,
      spouseMiddleName: null,
      spouseFamilyName: null,
      spouseDateOfBirth: null,
      nokFirstName: null,
      nokMiddleName: null,
      nokFamilyName: null,
      nokTelephone: null,
      nokEmail: null,
      nokAddress: null,
      nokRelationship: null,
      manningAgent: null,
      vesselTypes: null,
      documents: null,
      visas: null,
      education: null,
      licenses: null,
      trainingCourses: null,
      currentCompanySeaService: null,
      externalSeaService: null,
      preJoiningMedicals: null,
      doctorVisits: null,
      children: null
    });

    this.crewMembers.set("2025-03-12", {
      id: "2025-03-12",
      firstName: "Anna",
      middleName: "Marie",
      familyName: "Johnson",
      presentRank: "Chief Engineer",
      nationality: "British",
      presentVessel: "MT Sail Ten",
      vesselType: "LPG Tanker",
      signOnDate: "01-Jan-2025",
      createdAt: null,
      updatedAt: null,
      uploadedPhoto: null,
      status: null,
      isActive: true,
      nextAvailability: null,
      empNo: null,
      dateOfBirth: null,
      age: null,
      rankAppliedFor: null,
      employeeId: null,
      lastVessel: null,
      signOffDate: null,
      contractPeriod: null,
      reliefDue: null,
      reason: null,
      availability: null,
      email: null,
      mobile: null,
      contactLandline: null,
      countryOfResidence: null,
      nearestAirport: null,
      residentialAddressLine1: null,
      residentialAddressLine2: null,
      placeOfBirthCity: null,
      placeOfBirthCountry: null,
      heightCm: null,
      weightKg: null,
      bmi: null,
      nativeLanguage: null,
      foreignLanguages: null,
      englishProficiency: null,
      maritalStatus: null,
      numberOfDependentChildren: null,
      fatherName: null,
      motherName: null,
      spouseFirstName: null,
      spouseMiddleName: null,
      spouseFamilyName: null,
      spouseDateOfBirth: null,
      nokFirstName: null,
      nokMiddleName: null,
      nokFamilyName: null,
      nokTelephone: null,
      nokEmail: null,
      nokAddress: null,
      nokRelationship: null,
      manningAgent: null,
      vesselTypes: null,
      documents: null,
      visas: null,
      education: null,
      licenses: null,
      trainingCourses: null,
      currentCompanySeaService: null,
      externalSeaService: null,
      preJoiningMedicals: null,
      doctorVisits: null,
      children: null
    });

    this.crewMembers.set("2025-02-12", {
      id: "2025-02-12",
      firstName: "David",
      middleName: "Lee",
      familyName: "Brown",
      presentRank: "Able Seaman",
      nationality: "Indian",
      presentVessel: "MT Sail Two",
      vesselType: "Container",
      signOnDate: "01-Feb-2025",
      createdAt: null,
      updatedAt: null,
      uploadedPhoto: null,
      status: null,
      isActive: true,
      nextAvailability: null,
      empNo: null,
      dateOfBirth: null,
      age: null,
      rankAppliedFor: null,
      employeeId: null,
      lastVessel: null,
      signOffDate: null,
      contractPeriod: null,
      reliefDue: null,
      reason: null,
      availability: null,
      email: null,
      mobile: null,
      contactLandline: null,
      countryOfResidence: null,
      nearestAirport: null,
      residentialAddressLine1: null,
      residentialAddressLine2: null,
      placeOfBirthCity: null,
      placeOfBirthCountry: null,
      heightCm: null,
      weightKg: null,
      bmi: null,
      nativeLanguage: null,
      foreignLanguages: null,
      englishProficiency: null,
      maritalStatus: null,
      numberOfDependentChildren: null,
      fatherName: null,
      motherName: null,
      spouseFirstName: null,
      spouseMiddleName: null,
      spouseFamilyName: null,
      spouseDateOfBirth: null,
      nokFirstName: null,
      nokMiddleName: null,
      nokFamilyName: null,
      nokTelephone: null,
      nokEmail: null,
      nokAddress: null,
      nokRelationship: null,
      manningAgent: null,
      vesselTypes: null,
      documents: null,
      visas: null,
      education: null,
      licenses: null,
      trainingCourses: null,
      currentCompanySeaService: null,
      externalSeaService: null,
      preJoiningMedicals: null,
      doctorVisits: null,
      children: null
    });

    this.crewMembers.set("2025-04-18", {
      id: "2025-04-18",
      firstName: "Carlos",
      middleName: "Miguel",
      familyName: "Santos",
      presentRank: "2nd Officer",
      nationality: "Filipino",
      presentVessel: "MT Sail Three",
      vesselType: "Container",
      signOnDate: "15-Mar-2025",
      createdAt: null,
      updatedAt: null,
      uploadedPhoto: null,
      status: null,
      isActive: true,
      nextAvailability: null,
      empNo: null,
      dateOfBirth: null,
      age: null,
      rankAppliedFor: null,
      employeeId: null,
      lastVessel: null,
      signOffDate: null,
      contractPeriod: null,
      reliefDue: null,
      reason: null,
      availability: null,
      email: null,
      mobile: null,
      contactLandline: null,
      countryOfResidence: null,
      nearestAirport: null,
      residentialAddressLine1: null,
      residentialAddressLine2: null,
      placeOfBirthCity: null,
      placeOfBirthCountry: null,
      heightCm: null,
      weightKg: null,
      bmi: null,
      nativeLanguage: null,
      foreignLanguages: null,
      englishProficiency: null,
      maritalStatus: null,
      numberOfDependentChildren: null,
      fatherName: null,
      motherName: null,
      spouseFirstName: null,
      spouseMiddleName: null,
      spouseFamilyName: null,
      spouseDateOfBirth: null,
      nokFirstName: null,
      nokMiddleName: null,
      nokFamilyName: null,
      nokTelephone: null,
      nokEmail: null,
      nokAddress: null,
      nokRelationship: null,
      manningAgent: null,
      vesselTypes: null,
      documents: null,
      visas: null,
      education: null,
      licenses: null,
      trainingCourses: null,
      currentCompanySeaService: null,
      externalSeaService: null,
      preJoiningMedicals: null,
      doctorVisits: null,
      children: null
    });

    // Initialize with sample appraisal results
    const appraisal1: AppraisalResult = {
      id: 1,
      crewMemberId: "2025-05-14",
      formId: 1,
      appraisalType: "End of Contract",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "4.9",
      behavioralRating: "4.5",
      overallRating: "4.7",
      submittedBy: "admin",
      status: "Reviewed",
      submittedAt: new Date("2025-06-06"),
      stagePayloads: null,
      stageStatuses: null
    };
    this.appraisalResults.set(1, appraisal1);

    const appraisal2: AppraisalResult = {
      id: 2,
      crewMemberId: "2025-03-12",
      formId: 1,
      appraisalType: "Mid Term",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.5",
      behavioralRating: "4.5",
      overallRating: "4.0",
      submittedBy: "admin",
      status: "Reviewed",
      submittedAt: new Date("2025-05-07"),
      stagePayloads: null,
      stageStatuses: null
    };
    this.appraisalResults.set(2, appraisal2);

    const appraisal3: AppraisalResult = {
      id: 3,
      crewMemberId: "2025-02-12",
      formId: 1,
      appraisalType: "Special",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "2.5",
      behavioralRating: "3.5",
      overallRating: "3.0",
      submittedBy: "admin",
      status: "Reviewed",
      submittedAt: new Date("2025-06-06"),
      stagePayloads: null,
      stageStatuses: null
    };
    this.appraisalResults.set(3, appraisal3);

    const appraisal4: AppraisalResult = {
      id: 4,
      crewMemberId: "2025-04-18",
      formId: 1,
      appraisalType: "Probation",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.8",
      behavioralRating: "4.2",
      overallRating: "4.0",
      submittedBy: "admin",
      status: "Reviewed",
      submittedAt: new Date("2025-05-07"),
      stagePayloads: null,
      stageStatuses: null
    };
    this.appraisalResults.set(4, appraisal4);

    this.currentAppraisalResultId = 5;

    // Initialize with sample rest hours vessel records
    const currentDate = new Date();
    // Use the 6 vessels from master data (vessel master ID: 014)
    const vessels = [
      { id: "VSL-AP-001", name: "MV Atlantic Pioneer" },
      { id: "VSL-OE-002", name: "MV Ocean Explorer" },
      { id: "VSL-NS-003", name: "MT Nordic Star" },
      { id: "VSL-PV-004", name: "MV Pacific Voyager" },
      { id: "VSL-LG-005", name: "MT Liberty Gas" },
      { id: "VSL-GT-006", name: "MV Global Trader" }
    ];

    let rhRecordId = 1;
    // Generate records for last 2 months (current month + 1 previous month)
    for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      vessels.forEach((vessel, idx) => {
        const totalCrew = 20 + Math.floor(Math.random() * 5);
        const recordingPercent = monthOffset === 0 ? Math.floor(Math.random() * 101) : 100;
        const activityConflicting = Math.random() > 0.7;
        const totalViolations = Math.floor(Math.random() * 7);
        const crewWithViolations = totalViolations > 0 ? Math.min(totalViolations, Math.floor(Math.random() * 4) + 1) : 0;
        const totalNCs = Math.floor(Math.random() * 4);
        const crewWithNCs = totalNCs > 0 ? Math.min(totalNCs, Math.floor(Math.random() * 3) + 1) : 0;
        const predictedViolations = Math.floor(Math.random() * 2);
        const predictedNCs = Math.floor(Math.random() * 2);
        const crewWithPredictedNCs = predictedNCs > 0 ? Math.min(predictedNCs, Math.floor(Math.random() * 2) + 1) : 0;
        
        let officeReviewStatus = "Completed";
        if (monthOffset === 0 && idx < 3) {
          officeReviewStatus = idx === 0 ? "Completed" : idx === 1 ? "Due" : "Overdue";
        }

        this.restHoursVesselRecords.set(rhRecordId, {
          id: rhRecordId,
          createdAt: null,
          updatedAt: null,
          vesselId: vessel.id,
          vesselName: vessel.name,
          month: monthLabel.replace(' ', '-'),
          monthValue: monthValue,
          totalCrew,
          recordingStatusPercent: recordingPercent,
          activityConflicting,
          crewWithActivityConflicts: 0,
          crewWithActivityConflictsDetails: null,
          totalViolations,
          crewWithViolations,
          crewWithViolationsDetails: null,
          totalNCs,
          crewWithNCs,
          crewWithNCsDetails: null,
          predictedViolations,
          crewWithPredictedViolations: 0,
          crewWithPredictedViolationsDetails: null,
          predictedNCs,
          crewWithPredictedNCs,
          crewWithPredictedNCsDetails: null,
          vesselReviewStatus: "Due",
          vesselReviewSubmittedDate: null,
          officeReviewStatus,
          officeReviewSubmittedDate: null
        });
        rhRecordId++;
      });
    }
    this.currentRestHoursVesselRecordId = rhRecordId;
  }

  // User methods (same as MemStorage)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(user: User): Promise<User> {
    user.id = this.currentUserId++;
    this.users.set(user.id, user);
    this.saveToFile();
    return user;
  }

  // Form methods (same as MemStorage)
  async getForms(): Promise<Form[]> {
    return Array.from(this.forms.values());
  }

  async getForm(id: number): Promise<Form | undefined> {
    return this.forms.get(id);
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const id = this.currentFormId++;
    const form: Form = {
      id,
      name: insertForm.name,
      category: insertForm.category ?? "",
      rankGroup: insertForm.rankGroup,
      versionNo: insertForm.versionNo,
      versionDate: insertForm.versionDate,
      configuration: insertForm.configuration ?? null
    };
    this.forms.set(form.id, form);
    this.saveToFile();
    return form;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    const existingForm = this.forms.get(id);
    if (!existingForm) return undefined;

    const updatedForm: Form = { ...existingForm, ...formData };
    this.forms.set(id, updatedForm);
    this.saveToFile();
    return updatedForm;
  }

  async deleteForm(id: number): Promise<boolean> {
    const result = this.forms.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // Rank Group methods (same as MemStorage)
  async getRankGroups(formId: number): Promise<RankGroup[]> {
    return Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
  }

  async createRankGroup(insertRankGroup: InsertRankGroup): Promise<RankGroup> {
    const rankGroup: RankGroup = { ...insertRankGroup, id: this.currentRankGroupId++ };
    this.rankGroups.set(rankGroup.id, rankGroup);
    
    // Sync the form's rankGroup field with all associated rank groups
    await this.syncFormRankGroup(insertRankGroup.formId);
    
    this.saveToFile();
    return rankGroup;
  }

  // Private helper to sync form's rankGroup field with associated rank groups
  private async syncFormRankGroup(formId: number): Promise<void> {
    // Get all rank groups for this form
    const formRankGroups = Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
    
    // Create display string from rank group names
    const rankGroupNames = formRankGroups.map(rg => rg.name).join(", ");
    
    // Update the form's rankGroup field
    const form = this.forms.get(formId);
    if (form) {
      form.rankGroup = rankGroupNames || "";
      this.forms.set(formId, form);
    }
  }

  async updateRankGroup(id: number, rankGroupData: Partial<InsertRankGroup>): Promise<RankGroup | undefined> {
    const existingRankGroup = this.rankGroups.get(id);
    if (!existingRankGroup) return undefined;

    const updatedRankGroup: RankGroup = { ...existingRankGroup, ...rankGroupData };
    this.rankGroups.set(id, updatedRankGroup);
    this.saveToFile();
    return updatedRankGroup;
  }

  async deleteRankGroup(id: number): Promise<boolean> {
    const rankGroup = this.rankGroups.get(id);
    if (!rankGroup) return false;
    
    const formId = rankGroup.formId;
    const result = this.rankGroups.delete(id);
    
    if (result) {
      // Sync the form's rankGroup field after deletion
      await this.syncFormRankGroup(formId);
      this.saveToFile();
    }
    
    return result;
  }

  async getFormForRank(rankLabel: string, category: string): Promise<Form | undefined> {
    for (const rankGroup of Array.from(this.rankGroups.values())) {
      try {
        const ranks = JSON.parse(rankGroup.ranks);
        if (Array.isArray(ranks) && ranks.includes(rankLabel)) {
          const form = this.forms.get(rankGroup.formId);
          // Filter by category if provided
          if (form && (!category || form.category === category)) {
            return form;
          }
        }
      } catch (e) {
        console.error(`Error parsing ranks for rank group ${rankGroup.id}:`, e);
      }
    }
    return undefined;
  }

  // Available Rank methods (same as MemStorage)
  async getAvailableRanks(): Promise<AvailableRank[]> {
    return Array.from(this.availableRanks.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    // Get the next sortOrder value
    const existingRanks = await this.getAvailableRanks();
    const maxSortOrder = existingRanks.length > 0 ? Math.max(...existingRanks.map(r => r.sortOrder || 0)) : 0;
    
    const availableRank: AvailableRank = { 
      ...insertAvailableRank, 
      id: this.currentAvailableRankId++,
      rankId: insertAvailableRank.rankId ?? null,
      label: insertAvailableRank.label ?? null,
      applicableToCompany: insertAvailableRank.applicableToCompany ?? null,
      sortOrder: insertAvailableRank.sortOrder ?? (maxSortOrder + 1)
    };
    this.availableRanks.set(availableRank.id, availableRank);
    this.saveToFile();
    return availableRank;
  }

  async updateAvailableRank(id: number, availableRankData: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined> {
    const existingAvailableRank = this.availableRanks.get(id);
    if (!existingAvailableRank) return undefined;

    const updatedAvailableRank: AvailableRank = { ...existingAvailableRank, ...availableRankData };
    this.availableRanks.set(id, updatedAvailableRank);
    this.saveToFile();
    return updatedAvailableRank;
  }

  async deleteAvailableRank(id: number): Promise<boolean> {
    const result = this.availableRanks.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async clearAllAvailableRanks(): Promise<boolean> {
    this.availableRanks.clear();
    this.saveToFile();
    return true;
  }

  async updateRankOrders(rankOrders: Array<{ id: number; sortOrder: number }>): Promise<boolean> {
    try {
      for (const { id, sortOrder } of rankOrders) {
        const existingRank = this.availableRanks.get(id);
        if (existingRank) {
          const updatedRank: AvailableRank = { 
            ...existingRank, 
            sortOrder 
          };
          this.availableRanks.set(id, updatedRank);
        }
      }
      this.saveToFile();
      return true;
    } catch (error) {
      console.error('Failed to update rank orders:', error);
      return false;
    }
  }

  // Company Rank methods - CRITICAL FOR ROLE PERSISTENCE!
  async getCompanyRanks(): Promise<CompanyRank[]> {
    return Array.from(this.companyRanks.values());
  }

  async getCompanyRank(id: string): Promise<CompanyRank | undefined> {
    return this.companyRanks.get(id);
  }

  async getCompanyRankByName(rankName: string): Promise<CompanyRank | undefined> {
    const ranks = Array.from(this.companyRanks.values());
    return ranks.find(r => r.rank?.toLowerCase() === rankName.toLowerCase());
  }

  async createCompanyRank(insertCompanyRank: InsertCompanyRank): Promise<CompanyRank> {
    const companyRank: CompanyRank = {
      id: insertCompanyRank.id,
      rankId: insertCompanyRank.rankId,
      rank: insertCompanyRank.rank,
      role: insertCompanyRank.role ?? null,
      originalRankId: insertCompanyRank.originalRankId ?? null,
      isRoleRow: insertCompanyRank.isRoleRow ?? null,
      officer: insertCompanyRank.officer ?? null,
      rating: insertCompanyRank.rating ?? null,
      seniorOfficer: insertCompanyRank.seniorOfficer ?? null,
      deckOfficer: insertCompanyRank.deckOfficer ?? null,
      engOfficer: insertCompanyRank.engOfficer ?? null,
      pettyOfficer: insertCompanyRank.pettyOfficer ?? null,
      deckRating: insertCompanyRank.deckRating ?? null,
      engineRating: insertCompanyRank.engineRating ?? null,
      generalRating: insertCompanyRank.generalRating ?? null,
      cateringRating: insertCompanyRank.cateringRating ?? null,
      safetyOfficer: insertCompanyRank.safetyOfficer ?? null,
      sso: insertCompanyRank.sso ?? null,
      medicalOfficer: insertCompanyRank.medicalOfficer ?? null,
      navigatingOfficer: insertCompanyRank.navigatingOfficer ?? null,
      emtOfficer: insertCompanyRank.emtOfficer ?? null,
      createdAt: null,
      updatedAt: null
    };
    this.companyRanks.set(companyRank.id, companyRank);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    console.log(`💾 [COMPANY-RANK] Created and saved: ${companyRank.id} - ${companyRank.rank}${companyRank.role ? ` (${companyRank.role})` : ''}`);
    return companyRank;
  }

  async updateCompanyRank(id: string, companyRankData: Partial<InsertCompanyRank>): Promise<CompanyRank | undefined> {
    const existingCompanyRank = this.companyRanks.get(id);
    if (!existingCompanyRank) return undefined;

    const updatedCompanyRank: CompanyRank = { ...existingCompanyRank, ...companyRankData };
    this.companyRanks.set(id, updatedCompanyRank);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    console.log(`💾 [COMPANY-RANK] Updated and saved: ${updatedCompanyRank.id} - ${updatedCompanyRank.rank}${updatedCompanyRank.role ? ` (${updatedCompanyRank.role})` : ''}`);
    return updatedCompanyRank;
  }

  async deleteCompanyRank(id: string): Promise<boolean> {
    const result = this.companyRanks.delete(id);
    if (result) {
      this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
      console.log(`💾 [COMPANY-RANK] Deleted and saved: ${id}`);
    }
    return result;
  }

  async clearAllCompanyRanks(): Promise<boolean> {
    this.companyRanks.clear();
    this.saveToFile(); // SAVE TO FILE AFTER CLEAR!
    console.log(`💾 [COMPANY-RANK] Cleared all company ranks and saved`);
    return true;
  }

  async saveAllCompanyRanks(ranks: InsertCompanyRank[]): Promise<CompanyRank[]> {
    // Clear existing and replace with new data
    this.companyRanks.clear();
    const savedRanks: CompanyRank[] = [];
    
    for (const rank of ranks) {
      const companyRank: CompanyRank = {
        id: rank.id,
        rankId: rank.rankId,
        rank: rank.rank,
        role: rank.role ?? null,
        originalRankId: rank.originalRankId ?? null,
        isRoleRow: rank.isRoleRow ?? null,
        officer: rank.officer ?? null,
        rating: rank.rating ?? null,
        seniorOfficer: rank.seniorOfficer ?? null,
        deckOfficer: rank.deckOfficer ?? null,
        engOfficer: rank.engOfficer ?? null,
        pettyOfficer: rank.pettyOfficer ?? null,
        deckRating: rank.deckRating ?? null,
        engineRating: rank.engineRating ?? null,
        generalRating: rank.generalRating ?? null,
        cateringRating: rank.cateringRating ?? null,
        safetyOfficer: rank.safetyOfficer ?? null,
        sso: rank.sso ?? null,
        medicalOfficer: rank.medicalOfficer ?? null,
        navigatingOfficer: rank.navigatingOfficer ?? null,
        emtOfficer: rank.emtOfficer ?? null,
        createdAt: null,
        updatedAt: null
      };
      this.companyRanks.set(companyRank.id, companyRank);
      savedRanks.push(companyRank);
    }
    
    this.saveToFile(); // SAVE TO FILE AFTER BULK SAVE!
    console.log(`💾 [COMPANY-RANK] Bulk saved ${savedRanks.length} company ranks to persistent storage`);
    return savedRanks;
  }

  // Promotion Hierarchy methods
  async getPromotionHierarchies(): Promise<PromotionHierarchy[]> {
    return Array.from(this.promotionHierarchies.values());
  }

  async getPromotionHierarchy(id: number): Promise<PromotionHierarchy | undefined> {
    return this.promotionHierarchies.get(id);
  }

  async createPromotionHierarchy(insertPromotionHierarchy: InsertPromotionHierarchy): Promise<PromotionHierarchy> {
    const id = this.currentPromotionHierarchyId++;
    const promotionHierarchy: PromotionHierarchy = {
      id,
      groupName: insertPromotionHierarchy.groupName,
      rankPath: insertPromotionHierarchy.rankPath,
      isActive: insertPromotionHierarchy.isActive ?? null,
      createdAt: null,
      updatedAt: null
    };
    this.promotionHierarchies.set(id, promotionHierarchy);
    this.saveToFile();
    return promotionHierarchy;
  }

  async updatePromotionHierarchy(id: number, promotionHierarchyData: Partial<InsertPromotionHierarchy>): Promise<PromotionHierarchy | undefined> {
    const existingPromotionHierarchy = this.promotionHierarchies.get(id);
    if (!existingPromotionHierarchy) return undefined;

    const updatedPromotionHierarchy: PromotionHierarchy = { 
      ...existingPromotionHierarchy, 
      ...promotionHierarchyData
    };
    this.promotionHierarchies.set(id, updatedPromotionHierarchy);
    this.saveToFile();
    return updatedPromotionHierarchy;
  }

  async deletePromotionHierarchy(id: number): Promise<boolean> {
    const result = this.promotionHierarchies.delete(id);
    if (result) {
      this.saveToFile();
    }
    return result;
  }

  // Company Processing methods
  async getCompanyProcessingRecords(): Promise<CompanyProcessing[]> {
    return [];
  }

  async getCompanyProcessing(id: number): Promise<CompanyProcessing | undefined> {
    return undefined;
  }

  async getCompanyProcessingByCandidateId(candidateId: string): Promise<CompanyProcessing[]> {
    return [];
  }

  async createCompanyProcessing(record: InsertCompanyProcessing): Promise<CompanyProcessing> {
    throw new Error("Company Processing not implemented in file storage");
  }

  async updateCompanyProcessing(id: number, record: Partial<InsertCompanyProcessing>): Promise<CompanyProcessing | undefined> {
    return undefined;
  }

  async deleteCompanyProcessing(id: number): Promise<boolean> {
    return false;
  }

  // Promotion Forms methods
  async getPromotionForms(): Promise<PromotionForm[]> {
    return [];
  }

  async getPromotionForm(id: number): Promise<PromotionForm | undefined> {
    return undefined;
  }

  async getPromotionFormsByCrewMember(crewMemberId: string): Promise<PromotionForm[]> {
    return [];
  }

  async createPromotionForm(form: InsertPromotionForm): Promise<PromotionForm> {
    throw new Error("Promotion Forms not implemented in file storage");
  }

  async updatePromotionForm(id: number, form: Partial<InsertPromotionForm>): Promise<PromotionForm | undefined> {
    return undefined;
  }

  async deletePromotionForm(id: number): Promise<boolean> {
    return false;
  }

  async approvePromotionForm(id: number, reviewedBy: string, comments: string, effectiveDate: string): Promise<PromotionForm | undefined> {
    return undefined;
  }

  async rejectPromotionForm(id: number, reviewedBy: string, comments: string): Promise<PromotionForm | undefined> {
    return undefined;
  }

  // Crew Member methods (same as MemStorage)
  async getCrewMembers(): Promise<CrewMember[]> {
    return Array.from(this.crewMembers.values());
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    return this.crewMembers.get(id);
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    const uniqueId = await this.getNextCrewId();
    const crewMember: CrewMember = {
      id: uniqueId,
      status: insertCrewMember.status ?? null,
      isActive: insertCrewMember.isActive ?? true,
      nextAvailability: insertCrewMember.nextAvailability ?? null,
      createdAt: null,
      updatedAt: null,
      uploadedPhoto: insertCrewMember.uploadedPhoto ?? null,
      empNo: insertCrewMember.empNo ?? null,
      firstName: insertCrewMember.firstName,
      middleName: insertCrewMember.middleName ?? null,
      familyName: insertCrewMember.familyName ?? null,
      dateOfBirth: insertCrewMember.dateOfBirth ?? null,
      age: insertCrewMember.age ?? null,
      nationality: insertCrewMember.nationality,
      presentRank: insertCrewMember.presentRank,
      rankAppliedFor: insertCrewMember.rankAppliedFor ?? null,
      employeeId: insertCrewMember.employeeId ?? null,
      presentVessel: insertCrewMember.presentVessel,
      vesselType: insertCrewMember.vesselType,
      lastVessel: insertCrewMember.lastVessel ?? null,
      signOnDate: insertCrewMember.signOnDate ?? null,
      signOffDate: insertCrewMember.signOffDate ?? null,
      contractPeriod: insertCrewMember.contractPeriod ?? null,
      reliefDue: insertCrewMember.reliefDue ?? null,
      reason: insertCrewMember.reason ?? null,
      availability: insertCrewMember.availability ?? null,
      email: insertCrewMember.email ?? null,
      mobile: insertCrewMember.mobile ?? null,
      contactLandline: insertCrewMember.contactLandline ?? null,
      countryOfResidence: insertCrewMember.countryOfResidence ?? null,
      nearestAirport: insertCrewMember.nearestAirport ?? null,
      residentialAddressLine1: insertCrewMember.residentialAddressLine1 ?? null,
      residentialAddressLine2: insertCrewMember.residentialAddressLine2 ?? null,
      placeOfBirthCity: insertCrewMember.placeOfBirthCity ?? null,
      placeOfBirthCountry: insertCrewMember.placeOfBirthCountry ?? null,
      heightCm: insertCrewMember.heightCm ?? null,
      weightKg: insertCrewMember.weightKg ?? null,
      bmi: insertCrewMember.bmi ?? null,
      nativeLanguage: insertCrewMember.nativeLanguage ?? null,
      foreignLanguages: insertCrewMember.foreignLanguages ?? null,
      englishProficiency: insertCrewMember.englishProficiency ?? null,
      maritalStatus: insertCrewMember.maritalStatus ?? null,
      numberOfDependentChildren: insertCrewMember.numberOfDependentChildren ?? null,
      fatherName: insertCrewMember.fatherName ?? null,
      motherName: insertCrewMember.motherName ?? null,
      spouseFirstName: insertCrewMember.spouseFirstName ?? null,
      spouseMiddleName: insertCrewMember.spouseMiddleName ?? null,
      spouseFamilyName: insertCrewMember.spouseFamilyName ?? null,
      spouseDateOfBirth: insertCrewMember.spouseDateOfBirth ?? null,
      nokFirstName: insertCrewMember.nokFirstName ?? null,
      nokMiddleName: insertCrewMember.nokMiddleName ?? null,
      nokFamilyName: insertCrewMember.nokFamilyName ?? null,
      nokTelephone: insertCrewMember.nokTelephone ?? null,
      nokEmail: insertCrewMember.nokEmail ?? null,
      nokAddress: insertCrewMember.nokAddress ?? null,
      nokRelationship: insertCrewMember.nokRelationship ?? null,
      manningAgent: insertCrewMember.manningAgent ?? null,
      vesselTypes: insertCrewMember.vesselTypes ?? null,
      documents: insertCrewMember.documents ?? null,
      visas: insertCrewMember.visas ?? null,
      education: insertCrewMember.education ?? null,
      licenses: insertCrewMember.licenses ?? null,
      trainingCourses: insertCrewMember.trainingCourses ?? null,
      currentCompanySeaService: insertCrewMember.currentCompanySeaService ?? null,
      externalSeaService: insertCrewMember.externalSeaService ?? null,
      preJoiningMedicals: insertCrewMember.preJoiningMedicals ?? null,
      doctorVisits: insertCrewMember.doctorVisits ?? null,
      children: insertCrewMember.children ?? null
    };
    this.crewMembers.set(uniqueId, crewMember);
    this.saveToFile();
    return crewMember;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const existingCrewMember = this.crewMembers.get(id);
    if (!existingCrewMember) return undefined;

    // Sanitize input - remove id if present since it's read-only
    const { id: _omitId, ...sanitizedData } = crewMemberData as any;
    // Set updatedAt timestamp automatically on every update for sorting by latest edited
    const updatedCrewMember: CrewMember = { 
      ...existingCrewMember, 
      ...sanitizedData,
      updatedAt: new Date()
    };
    this.crewMembers.set(id, updatedCrewMember);
    this.saveToFile();
    return updatedCrewMember;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    const result = this.crewMembers.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // Dashboard Summary Method
  async getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined> {
    const crewMember = await this.getCrewMember(crewId);
    if (!crewMember) return undefined;

    const appraisals = await this.getAppraisalResultsByCrewMember(crewId);

    // Parse sea service data for experience calculations
    let companySeaService: any[] = [];
    let externalSeaService: any[] = [];
    try {
      companySeaService = crewMember.currentCompanySeaService 
        ? JSON.parse(crewMember.currentCompanySeaService as string) 
        : [];
    } catch (e) {
      companySeaService = [];
    }
    try {
      externalSeaService = crewMember.externalSeaService 
        ? JSON.parse(crewMember.externalSeaService as string) 
        : [];
    } catch (e) {
      externalSeaService = [];
    }
    
    // Calculate experience from sea service data
    const currentRank = crewMember.presentRank || '';
    const experience = calculateExperienceFromSeaService(
      companySeaService,
      externalSeaService,
      currentRank
    );
    
    // Calculate ship type experience
    const shipTypeData = calculateShipTypeExperience(companySeaService, externalSeaService);

    // Parse licenses for endorsement calculation
    // Handle both cases: licenses can be a JSON string or already an array
    let licenses: any[] = [];
    if (crewMember.licenses) {
      if (Array.isArray(crewMember.licenses)) {
        licenses = crewMember.licenses;
      } else if (typeof crewMember.licenses === 'string') {
        try {
          licenses = JSON.parse(crewMember.licenses);
        } catch (e) {
          licenses = [];
        }
      }
    }

    // Get rank flags for endorsement derivation
    const rankFlags = await this.getCompanyRankByName(currentRank);
    const endorsementCode = deriveEndorsementCode(
      {
        seniorOfficer: rankFlags?.seniorOfficer,
        officer: rankFlags?.officer,
        rating: rankFlags?.rating
      },
      licenses
    );

    const vesselName = crewMember.presentVessel ? translateVesselCodeToName(crewMember.presentVessel) : '';
    const joinedDateFormatted = formatDateForDashboard(crewMember.signOnDate);
    const reliefDueFormatted = formatDateForDashboard(crewMember.reliefDue);

    // Build service timeline from sea service and vessel planning
    const vesselPlanningRecords = await this.getVesselPlanningByCrewMember(crewId);
    
    // Also fetch records where this crew member is assigned as a reliever (for planned blue bars)
    const relieverPlanningRecords = await this.getVesselPlanningAsReliever(crewId);
    
    // Group appraisals by vessel for badge display
    const appraisalsByVessel = new Map<string, number[]>();
    for (const appraisal of appraisals) {
      const vessel = appraisal.vesselName || '';
      if (!appraisalsByVessel.has(vessel)) {
        appraisalsByVessel.set(vessel, []);
      }
      appraisalsByVessel.get(vessel)!.push(appraisal.id);
    }
    
    // Filter out archived records for timeline display (archived records should not appear as active bars)
    const activeVesselPlanningRecords = vesselPlanningRecords.filter(p => !p.isArchived);
    
    // Build the timeline (includes both primary assignments and reliever assignments)
    const serviceTimeline = buildServiceTimeline(
      companySeaService,
      activeVesselPlanningRecords,
      appraisalsByVessel,
      new Map(), // handovers - not yet implemented
      undefined, // vesselCodeToNameMap - PersistentFileStorage uses static translation
      relieverPlanningRecords
    );

    // Compute status based on crew member data:
    // - On Board: Has a presentVessel (assigned to a vessel)
    // - On Leave: No presentVessel but isActive is true (available but not on ship)
    // - Inactive: isActive is false (manually triggered only)
    let computedStatus: 'On Board' | 'On Leave' | 'Inactive' = 'On Leave';
    if (crewMember.isActive === false) {
      computedStatus = 'Inactive';
    } else if (crewMember.presentVessel && crewMember.presentVessel.trim() !== '') {
      computedStatus = 'On Board';
    } else {
      computedStatus = 'On Leave';
    }

    // Generate dashboard data based on actual crew member data
    const summary: CrewDashboardSummary = {
      status: {
        status: computedStatus,
        vessel: vesselName,
        joinedDate: joinedDateFormatted, 
        sailingDue: reliefDueFormatted,
        presentAssignment: crewMember.presentVessel || null,
        emergencyContact: (crewMember.nokFirstName && crewMember.nokRelationship && crewMember.nokTelephone) ? {
          name: `${crewMember.nokFirstName}${crewMember.nokFamilyName ? ' ' + crewMember.nokFamilyName : ''}`.trim(),
          relation: crewMember.nokRelationship,
          phone: crewMember.nokTelephone
        } : null
      },
      experience: {
        company: experience.company,
        rank: experience.rank,
        tankers: experience.tankers, 
        ocw: experience.oow,
        endorsements: endorsementCode
      },
      shipTypes: {
        items: shipTypeData.shipTypeExperience,
        totalMonths: shipTypeData.totalMonths,
        totalYears: Math.round((shipTypeData.totalMonths / 12) * 10) / 10
      },
      serviceTimeline,
      compliance: [
        { category: "Travel Docs", status: "compliant", details: "✓" },
        { category: "Visas", status: "compliant", details: "✓" },
        { category: "License & DCE", status: "compliant", details: "✓" },
        { category: "Training", status: "issues", details: "Issues: 2" },
        { category: "Medical", status: "compliant", details: "Last: 15 Feb 2022" },
        { category: "Vaccination", status: "issues", details: "Issue: 1" }
      ],
      careerProgression: [
        {
          position: "To C/E",
          status: { recommend: false, advance: false, demote: true, approved: false }
        },
        {
          position: "To 2/E", 
          date: "22 Jan 2017",
          status: { recommend: true, advance: true, demote: false, approved: true }
        },
        {
          position: "To 3/E",
          date: "12 Dec 2014", 
          status: { recommend: true, advance: true, demote: false, approved: true }
        }
      ],
      appraisals: appraisals.map((appraisal, index) => ({
        year: 2014 + index * 2,
        score: parseFloat(appraisal.overallRating || "3.0") * 8 // Convert to chart scale
      })).concat([
        { year: 2024, score: 31 } // Add current year point
      ])
    };

    return summary;
  }

  private initializeRestHoursSampleData(): void {
    // Initialize with sample rest hours vessel records
    const currentDate = new Date();
    // Use the 6 vessels from master data (vessel master ID: 014)
    const vessels = [
      { id: "VSL-AP-001", name: "MV Atlantic Pioneer" },
      { id: "VSL-OE-002", name: "MV Ocean Explorer" },
      { id: "VSL-NS-003", name: "MT Nordic Star" },
      { id: "VSL-PV-004", name: "MV Pacific Voyager" },
      { id: "VSL-LG-005", name: "MT Liberty Gas" },
      { id: "VSL-GT-006", name: "MV Global Trader" }
    ];

    let rhRecordId = this.currentRestHoursVesselRecordId;
    // Generate records for last 2 months (current month + 1 previous month)
    for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      vessels.forEach((vessel, idx) => {
        const totalCrew = 20 + Math.floor(Math.random() * 5);
        const recordingPercent = monthOffset === 0 ? Math.floor(Math.random() * 101) : 100;
        const activityConflicting = Math.random() > 0.7;
        const totalViolations = Math.floor(Math.random() * 7);
        const crewWithViolations = totalViolations > 0 ? Math.min(totalViolations, Math.floor(Math.random() * 4) + 1) : 0;
        const totalNCs = Math.floor(Math.random() * 4);
        const crewWithNCs = totalNCs > 0 ? Math.min(totalNCs, Math.floor(Math.random() * 3) + 1) : 0;
        const predictedViolations = Math.floor(Math.random() * 2);
        const predictedNCs = Math.floor(Math.random() * 2);
        const crewWithPredictedNCs = predictedNCs > 0 ? Math.min(predictedNCs, Math.floor(Math.random() * 2) + 1) : 0;
        
        let officeReviewStatus = "Completed";
        if (monthOffset === 0 && idx < 3) {
          officeReviewStatus = idx === 0 ? "Completed" : idx === 1 ? "Due" : "Overdue";
        }

        this.restHoursVesselRecords.set(rhRecordId, {
          id: rhRecordId,
          createdAt: null,
          updatedAt: null,
          vesselId: vessel.id,
          vesselName: vessel.name,
          month: monthLabel.replace(' ', '-'),
          monthValue: monthValue,
          totalCrew,
          recordingStatusPercent: recordingPercent,
          activityConflicting,
          crewWithActivityConflicts: 0,
          crewWithActivityConflictsDetails: null,
          totalViolations,
          crewWithViolations,
          crewWithViolationsDetails: null,
          totalNCs,
          crewWithNCs,
          crewWithNCsDetails: null,
          predictedViolations,
          crewWithPredictedViolations: 0,
          crewWithPredictedViolationsDetails: null,
          predictedNCs,
          crewWithPredictedNCs,
          crewWithPredictedNCsDetails: null,
          vesselReviewStatus: "Due",
          vesselReviewSubmittedDate: null,
          officeReviewStatus,
          officeReviewSubmittedDate: null
        });
        rhRecordId++;
      });
    }
    this.currentRestHoursVesselRecordId = rhRecordId;
  }

  // ID Generation Methods
  private initializeCrewIdCounter(): number {
    let maxCounter = 0;
    
    // Scan existing crew members for A-series IDs in employeeId field
    for (const crewMember of Array.from(this.crewMembers.values())) {
      if (crewMember.employeeId) {
        const match = crewMember.employeeId.match(/^A(\d{6})$/);
        if (match) {
          const idNumber = parseInt(match[1], 10);
          maxCounter = Math.max(maxCounter, idNumber);
        }
      }
    }
    
    const startingCounter = maxCounter + 1;
    console.log(`🔢 Initialized crew ID counter to ${startingCounter} (scanned ${this.crewMembers.size} existing crew members)`);
    return startingCounter;
  }

  async getNextCrewId(): Promise<string> {
    const nextNumber = this.currentCrewIdCounter++;
    // Format: A000001, A000002, etc. (A + 6-digit padded number)
    this.saveToFile(); // Persist the updated counter
    return `A${nextNumber.toString().padStart(6, '0')}`;
  }

  // Vessel Groups Methods
  async getVesselGroups(): Promise<VesselGroup[]> {
    return Array.from(this.vesselGroups.values());
  }

  async getVesselGroup(id: number): Promise<VesselGroup | undefined> {
    return this.vesselGroups.get(id);
  }

  async createVesselGroup(insertVesselGroup: InsertVesselGroup): Promise<VesselGroup> {
    const id = this.currentVesselGroupId++;
    const vesselGroup: VesselGroup = {
      id,
      name: insertVesselGroup.name,
      vesselIds: insertVesselGroup.vesselIds,
      description: insertVesselGroup.description ?? null,
      createdAt: null,
      updatedAt: null
    };
    this.vesselGroups.set(id, vesselGroup);
    this.saveToFile(); // Persist the changes
    return vesselGroup;
  }

  async updateVesselGroup(id: number, vesselGroupData: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined> {
    const existingVesselGroup = this.vesselGroups.get(id);
    if (!existingVesselGroup) return undefined;

    const updatedVesselGroup: VesselGroup = { 
      ...existingVesselGroup, 
      ...vesselGroupData,
      updatedAt: null as any // new Date()
    };
    this.vesselGroups.set(id, updatedVesselGroup);
    this.saveToFile(); // Persist the changes
    return updatedVesselGroup;
  }

  async deleteVesselGroup(id: number): Promise<boolean> {
    const result = this.vesselGroups.delete(id);
    if (result) {
      this.saveToFile(); // Persist the changes
    }
    return result;
  }

  // Vessel Drafts methods
  async getVesselDrafts(): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values());
  }

  async getVesselDraft(id: number): Promise<VesselDraft | undefined> {
    return this.vesselDrafts.get(id);
  }

  async getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values()).filter(draft => draft.vesselId === vesselId);
  }

  async createVesselDraft(insertVesselDraft: InsertVesselDraft): Promise<VesselDraft> {
    const id = this.currentVesselDraftId++;
    const vesselDraft: VesselDraft = {
      id,
      vesselId: insertVesselDraft.vesselId,
      revision: insertVesselDraft.revision ?? "",
      draftData: insertVesselDraft.draftData,
      createdAt: null,
      updatedAt: null
    };
    this.vesselDrafts.set(id, vesselDraft);
    this.saveToFile(); // Persist the changes
    return vesselDraft;
  }

  async updateVesselDraft(id: number, vesselDraftData: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined> {
    const existingVesselDraft = this.vesselDrafts.get(id);
    if (!existingVesselDraft) return undefined;

    const updatedVesselDraft: VesselDraft = { 
      ...existingVesselDraft, 
      ...vesselDraftData,
      updatedAt: null as any // new Date()
    };
    this.vesselDrafts.set(id, updatedVesselDraft);
    this.saveToFile(); // Persist the changes
    return updatedVesselDraft;
  }

  async deleteVesselDraft(id: number): Promise<boolean> {
    const result = this.vesselDrafts.delete(id);
    if (result) {
      this.saveToFile(); // Persist the changes
    }
    return result;
  }

  // Vessel Revisions methods
  async getVesselRevisions(): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values());
  }

  async getVesselRevision(id: number): Promise<VesselRevision | undefined> {
    return this.vesselRevisions.get(id);
  }

  async getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values()).filter(revision => revision.vesselId === vesselId);
  }

  async createVesselRevision(insertVesselRevision: InsertVesselRevision): Promise<VesselRevision> {
    const id = this.currentVesselRevisionId++;
    const vesselRevision: VesselRevision = { 
      ...insertVesselRevision, 
      id,
      createdAt: null as any // new Date()
    };
    this.vesselRevisions.set(id, vesselRevision);
    this.saveToFile(); // Persist the changes
    return vesselRevision;
  }

  // Appraisal Result methods (same as MemStorage)
  async getAppraisalResults(): Promise<AppraisalResult[]> {
    // Filter out drafts - only return preliminary, submitted, reviewed
    return Array.from(this.appraisalResults.values()).filter(ar => ar.status !== 'draft');
  }

  async getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    return this.appraisalResults.get(id);
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    return Array.from(this.appraisalResults.values()).filter(ar => ar.crewMemberId === crewMemberId);
  }

  async createAppraisalResult(insertAppraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    const id = this.currentAppraisalResultId++;
    const appraisalResult: AppraisalResult = {
      id,
      formId: insertAppraisalResult.formId,
      crewMemberId: insertAppraisalResult.crewMemberId,
      appraisalType: insertAppraisalResult.appraisalType,
      appraisalDate: insertAppraisalResult.appraisalDate,
      appraisalData: insertAppraisalResult.appraisalData,
      submittedBy: insertAppraisalResult.submittedBy,
      status: insertAppraisalResult.status ?? "draft",
      competenceRating: insertAppraisalResult.competenceRating ?? null,
      behavioralRating: insertAppraisalResult.behavioralRating ?? null,
      overallRating: insertAppraisalResult.overallRating ?? null,
      submittedAt: new Date(),
      stagePayloads: insertAppraisalResult.stagePayloads ?? null,
      stageStatuses: insertAppraisalResult.stageStatuses ?? null
    };
    this.appraisalResults.set(appraisalResult.id, appraisalResult);
    this.saveToFile();
    return appraisalResult;
  }

  async updateAppraisalResult(id: number, appraisalData: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    const existingAppraisal = this.appraisalResults.get(id);
    if (!existingAppraisal) return undefined;

    const updatedAppraisal: AppraisalResult = { ...existingAppraisal, ...appraisalData };
    this.appraisalResults.set(id, updatedAppraisal);
    this.saveToFile();
    return updatedAppraisal;
  }

  async deleteAppraisalResult(id: number): Promise<boolean> {
    const result = this.appraisalResults.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async submitAppraisalStage(id: number, stage: 'stage1' | 'stage2' | 'stage3', data: any, submittedBy: string): Promise<AppraisalResult | undefined> {
    const existingAppraisal = this.appraisalResults.get(id);
    if (!existingAppraisal) return undefined;

    // Parse existing stage statuses and payloads
    const stageStatuses = existingAppraisal.stageStatuses ? JSON.parse(existingAppraisal.stageStatuses) : {};
    const stagePayloads = existingAppraisal.stagePayloads ? JSON.parse(existingAppraisal.stagePayloads) : {};
    
    // Enforce sequential stage progression
    if (stage === 'stage2' && !stageStatuses.stage1?.status) {
      throw new Error('Stage 1 must be submitted before Stage 2');
    }
    if (stage === 'stage3' && !stageStatuses.stage2?.status) {
      throw new Error('Stage 2 must be submitted before Stage 3');
    }

    // Update stage status
    stageStatuses[stage] = {
      status: 'completed',
      submittedAt: new Date().toISOString(),
      submittedBy: submittedBy
    };

    // Store stage payload separately
    stagePayloads[stage] = data;

    // Determine overall status based on completed stages
    let newStatus = existingAppraisal.status;
    if (stage === 'stage1') {
      newStatus = 'preliminary';
    } else if (stage === 'stage2') {
      newStatus = 'submitted';
    } else if (stage === 'stage3') {
      newStatus = 'reviewed';
    }

    // Parse existing appraisal data and merge all stage payloads
    const appraisalData = existingAppraisal.appraisalData ? JSON.parse(existingAppraisal.appraisalData) : {};
    const updatedData = { ...appraisalData, ...data };

    const updatedAppraisal: AppraisalResult = {
      ...existingAppraisal,
      appraisalData: JSON.stringify(updatedData),
      stageStatuses: JSON.stringify(stageStatuses),
      stagePayloads: JSON.stringify(stagePayloads),
      status: newStatus,
      submittedBy: submittedBy,
      submittedAt: new Date()
    };

    this.appraisalResults.set(id, updatedAppraisal);
    this.saveToFile();
    return updatedAppraisal;
  }

  // Recruitment Candidate methods - THE IMPORTANT ONES FOR YOUR FORM!
  async getRecruitmentCandidates(): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values());
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    return this.recruitmentCandidates.get(id);
  }

  async getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values()).filter(candidate => candidate.status === status);
  }

  async createRecruitmentCandidate(insertCandidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    const candidate: RecruitmentCandidate = { 
      ...insertCandidate,
      middleName: insertCandidate.middleName || null,
      applicationData: insertCandidate.applicationData || null,
      status: insertCandidate.status || "Applied",
      isDelete: false,
      createdAt: null,
      updatedAt: null as any // new Date()
    };
    this.recruitmentCandidates.set(candidate.id, candidate);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return candidate;
  }

  async updateRecruitmentCandidate(id: string, candidateData: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined> {
    const existingCandidate = this.recruitmentCandidates.get(id);
    if (!existingCandidate) return undefined;

    const updatedCandidate: RecruitmentCandidate = { 
      ...existingCandidate, 
      ...candidateData,
      updatedAt: null as any // new Date()
    };
    this.recruitmentCandidates.set(id, updatedCandidate);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedCandidate;
  }

  async deleteRecruitmentCandidate(id: string): Promise<boolean> {
    const result = this.recruitmentCandidates.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  async softDeleteRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    const existingCandidate = this.recruitmentCandidates.get(id);
    if (!existingCandidate) return undefined;

    const updatedCandidate: RecruitmentCandidate = { 
      ...existingCandidate, 
      isDelete: true,
      updatedAt: null as any // new Date()
    };
    this.recruitmentCandidates.set(id, updatedCandidate);
    this.saveToFile(); // SAVE TO FILE AFTER SOFT DELETE!
    return updatedCandidate;
  }

  async transferRecruitedCandidate(candidateId: string): Promise<{ crewMember: CrewMember; crewId: string }> {
    const candidate = this.recruitmentCandidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Recruitment candidate with ID ${candidateId} not found`);
    }

    if (candidate.status !== 'Recruited') {
      throw new Error(`Candidate must have status 'Recruited' to be transferred. Current status: ${candidate.status}`);
    }

    // Check if already transferred by looking for crew member with matching empNo (fileNo)
    const existingCrew = Array.from(this.crewMembers.values()).find(
      crew => crew.empNo === candidate.fileNo
    );
    
    if (existingCrew) {
      console.log(`⚠️ Candidate ${candidate.fileNo} already transferred to crew database with ID ${existingCrew.id}`);
      return { crewMember: existingCrew, crewId: existingCrew.id };
    }

    const crewId = await this.getNextCrewId();

    let applicationData: any = null;
    if (candidate.applicationData) {
      try {
        applicationData = typeof candidate.applicationData === 'string' 
          ? JSON.parse(candidate.applicationData) 
          : candidate.applicationData;
      } catch (e) {
        console.warn('Failed to parse applicationData:', e);
      }
    }

    // Create crew member from candidate data - Transfer ALL A1 section fields
    const crewMemberData: InsertCrewMember = {
      id: crewId,
      employeeId: crewId, // Set employeeId to display as Crew ID in the database view
      empNo: candidate.fileNo || '',
      
      // Photo (A1 - Crew Photo)
      uploadedPhoto: applicationData?.uploadedPhoto || null,
      
      // A1.1 General Particulars
      firstName: candidate.firstName,
      middleName: candidate.middleName || null,
      familyName: candidate.familyName,
      dateOfBirth: candidate.dob,
      nationality: candidate.nationality,
      presentRank: candidate.rankAppliedFor,
      rankAppliedFor: candidate.rankAppliedFor,
      vesselType: candidate.vesselType || 'General',
      presentVessel: 'Unassigned',
      age: applicationData?.ageInYears || null,
      placeOfBirthCity: applicationData?.placeOfBirthCity || null,
      placeOfBirthCountry: applicationData?.placeOfBirthCountry || null,
      heightCm: applicationData?.heightCm || null,
      weightKg: applicationData?.weightKg || null,
      nativeLanguage: applicationData?.nativeLanguage || null,
      foreignLanguages: applicationData?.foreignLanguages || null,
      englishProficiency: applicationData?.englishProficiency || null,
      manningAgent: applicationData?.manningAgent || null,
      
      // A1.2 Address & Contact Info
      countryOfResidence: applicationData?.countryOfResidence || null,
      nearestAirport: applicationData?.nearestAirport || null,
      residentialAddressLine1: applicationData?.residentialAddressLine1 || null,
      residentialAddressLine2: applicationData?.residentialAddressLine2 || null,
      contactLandline: applicationData?.contactLandline || null,
      mobile: applicationData?.mobile || null,
      email: applicationData?.email || null,
      
      // A1.3 Family and NOK
      maritalStatus: applicationData?.maritalStatus || null,
      numberOfDependentChildren: applicationData?.numberOfDependentChildren || null,
      fatherName: applicationData?.fatherName || null,
      motherName: applicationData?.motherName || null,
      spouseFirstName: applicationData?.spouseFirstName || null,
      spouseMiddleName: applicationData?.spouseMiddleName || null,
      spouseFamilyName: applicationData?.spouseFamilyName || null,
      spouseDateOfBirth: applicationData?.spouseDateOfBirth || null,
      children: applicationData?.children ? JSON.stringify(applicationData.children) : null,
      nokFirstName: applicationData?.nokFirstName || null,
      nokMiddleName: applicationData?.nokMiddleName || null,
      nokFamilyName: applicationData?.nokFamilyName || null,
      nokTelephone: applicationData?.nokTelephone || null,
      nokEmail: applicationData?.nokEmail || null,
      nokAddress: applicationData?.nokAddress || null,
      nokRelationship: applicationData?.nokRelationship || null,
      
      // A2 - Travel & ID Documents
      documents: applicationData?.documents ? JSON.stringify(applicationData.documents) : null,
      visas: applicationData?.visas ? JSON.stringify(applicationData.visas) : null,
      
      // A3 - Training & Certificates
      education: applicationData?.education ? JSON.stringify(applicationData.education) : null,
      licenses: applicationData?.licenses ? JSON.stringify(applicationData.licenses) : null,
      trainingCourses: applicationData?.trainingCourses ? JSON.stringify(applicationData.trainingCourses) : null,
      
      // A4 - Sea Service (recruitment seaService maps to externalSeaService in crew)
      externalSeaService: applicationData?.seaService ? JSON.stringify(applicationData.seaService) : null,
      
      status: 'Active'
    };

    const crewMember = await this.createCrewMember(crewMemberData);
    this.saveToFile(); // SAVE TO FILE AFTER TRANSFER!
    
    console.log(`✅ Transferred recruited candidate ${candidate.fileNo} to crew database with ID ${crewId}`);
    
    return { crewMember, crewId };
  }

  // Vessel Planning Methods
  async getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.vesselId === vesselId);
  }

  async getVesselPlanningByCrewMember(crewMemberId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.crewMemberId === crewMemberId);
  }

  async getVesselPlanningAsReliever(crewMemberId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.relieverCrewId === crewMemberId);
  }

  async getVesselPlanningById(id: number): Promise<VesselPlanning | undefined> {
    return this.vesselPlanning.get(id);
  }

  async getAllVesselPlanning(): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values());
  }

  async createVesselPlanning(insertPlanning: InsertVesselPlanning): Promise<VesselPlanning> {
    const id = this.currentVesselPlanningId++;
    const vesselPlanning: VesselPlanning = { 
      id,
      vesselId: insertPlanning.vesselId,
      rankId: insertPlanning.rankId,
      rank: insertPlanning.rank,
      crewMemberId: null,
      onBoardCrewId: insertPlanning.onBoardCrewId ?? null,
      onBoardCrewName: insertPlanning.onBoardCrewName ?? null,
      onBoardCrewNationality: insertPlanning.onBoardCrewNationality ?? null,
      reliefDue: insertPlanning.reliefDue ?? null,
      signOnDate: insertPlanning.signOnDate ?? null,
      signOffDate: insertPlanning.signOffDate ?? null,
      signOffPort: insertPlanning.signOffPort ?? null,
      reliefStatus: insertPlanning.reliefStatus ?? null,
      relieverCrewId: insertPlanning.relieverCrewId ?? null,
      relieverCrewName: insertPlanning.relieverCrewName ?? null,
      relieverNationality: insertPlanning.relieverNationality ?? null,
      relieverSignOnDate: insertPlanning.relieverSignOnDate ?? null,
      joiningPort: insertPlanning.joiningPort ?? null,
      joiningStatus: insertPlanning.joiningStatus ?? null,
      contractPeriodMonths: insertPlanning.contractPeriodMonths ?? null,
      contractEndRangeStartMonths: insertPlanning.contractEndRangeStartMonths ?? null,
      contractEndRangeEndMonths: insertPlanning.contractEndRangeEndMonths ?? null,
      crewStatus: insertPlanning.crewStatus ?? null,
      takeOverDate: insertPlanning.takeOverDate ?? null,
      takeOverConfirmation: insertPlanning.takeOverConfirmation ?? null,
      handOverDate: insertPlanning.handOverDate ?? null,
      deploymentChecklistCompleted: insertPlanning.deploymentChecklistCompleted ?? null,
      applicableDocsChecked: insertPlanning.applicableDocsChecked ?? null,
      isArchived: insertPlanning.isArchived ?? false,
      archivedDate: insertPlanning.archivedDate ?? null,
      signOffReason: insertPlanning.signOffReason ?? null,
      createdAt: null,
      updatedAt: null
    };
    this.vesselPlanning.set(id, vesselPlanning);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return vesselPlanning;
  }

  async updateVesselPlanning(id: number, planningData: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined> {
    const existingPlanning = this.vesselPlanning.get(id);
    if (!existingPlanning) return undefined;

    const updatedPlanning: VesselPlanning = { 
      ...existingPlanning, 
      ...planningData,
      updatedAt: null as any // new Date()
    };
    this.vesselPlanning.set(id, updatedPlanning);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedPlanning;
  }

  async deleteVesselPlanning(id: number): Promise<boolean> {
    const result = this.vesselPlanning.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rotation Plans Methods
  async getRotationPlans(): Promise<RotationPlan[]> {
    return Array.from(this.rotationPlans.values());
  }

  async getRotationPlan(id: number): Promise<RotationPlan | undefined> {
    return this.rotationPlans.get(id);
  }

  async createRotationPlan(insertPlan: InsertRotationPlan): Promise<RotationPlan> {
    const id = this.currentRotationPlanId++;
    const rotationPlan: RotationPlan = {
      id,
      createdAt: null,
      updatedAt: null,
      createdBy: insertPlan.createdBy,
      draftId: insertPlan.draftId,
      lastEdited: insertPlan.lastEdited,
      vessels: insertPlan.vessels,
      crew: insertPlan.crew,
      planFromDate: insertPlan.planFromDate,
      planToDate: insertPlan.planToDate,
      planStatus: insertPlan.planStatus ?? "In Draft",
      proposedBy: insertPlan.proposedBy ?? null,
      proposedDate: insertPlan.proposedDate ?? null,
      assignments: insertPlan.assignments ?? null
    };
    this.rotationPlans.set(id, rotationPlan);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return rotationPlan;
  }

  async updateRotationPlan(id: number, updateData: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined> {
    const existingPlan = this.rotationPlans.get(id);
    if (!existingPlan) return undefined;
    
    const updatedPlan: RotationPlan = {
      ...existingPlan,
      ...updateData,
      updatedAt: null,
    };
    this.rotationPlans.set(id, updatedPlan);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedPlan;
  }

  async deleteRotationPlan(id: number): Promise<boolean> {
    const result = this.rotationPlans.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rotation Approval Workflow Methods
  async proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(id);
    if (!plan) return undefined;

    // Reset all assignment proposal statuses to "proposed" when proposing a plan
    let assignments = plan.assignments;
    if (assignments) {
      const parsedAssignments = JSON.parse(assignments);
      const resetAssignments = parsedAssignments.map((assignment: any) => ({
        ...assignment,
        proposalStatus: "proposed", // Reset to proposed status
      }));
      assignments = JSON.stringify(resetAssignments);
    }

    const updatedPlan: RotationPlan = {
      ...plan,
      assignments,
      planStatus: "Proposed",
      proposedBy,
      proposedDate: new Date().toISOString().split('T')[0],
      updatedAt: null as any // new Date()
    };
    this.rotationPlans.set(id, updatedPlan);
    this.saveToFile(); // SAVE TO FILE!
    return updatedPlan;
  }

  async getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string; archived?: boolean }): Promise<any[]> {
    // For archived view, include completed plans as well (which have all assignments deployed/rejected)
    const proposedPlans = Array.from(this.rotationPlans.values()).filter(plan => 
      plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved" || plan.planStatus === "Completed"
    );

    const assignments: any[] = [];
    for (const plan of proposedPlans) {
      if (plan.assignments) {
        const planAssignments = JSON.parse(plan.assignments);
        for (let i = 0; i < planAssignments.length; i++) {
          const assignment = planAssignments[i];
          
          // Determine which assignments to include based on archived filter
          const isArchived = assignment.proposalStatus === "deployed" || assignment.proposalStatus === "rejected";
          const isPending = !assignment.proposalStatus || assignment.proposalStatus === "proposed";
          
          // If archived filter is set, only include archived assignments; otherwise only pending
          if (filters?.archived ? isArchived : isPending) {
            // Find current crew on board for this vessel/rank
            let currentCrew = null;
            
            // Determine vesselId for lookup
            let vesselIdToMatch: string | null = null;
            if (assignment.vesselId) {
              // Use existing vesselId and normalize it
              vesselIdToMatch = String(assignment.vesselId);
              if (/^\d+$/.test(vesselIdToMatch)) {
                // Numeric format - convert to VSL-XXX format
                vesselIdToMatch = `VSL-${vesselIdToMatch.padStart(3, '0')}`;
              }
            } else if (assignment.vessel || assignment.vesselName) {
              // Legacy assignment without vesselId
              const vesselValue = assignment.vessel || assignment.vesselName;
              
              // Check if the vessel field already contains a vessel ID (VSL-XXX format)
              if (/^VSL-\d{3}$/.test(vesselValue)) {
                // It's already a vessel ID, use it directly
                vesselIdToMatch = vesselValue;
              } else {
                // It's a vessel name, need to look it up in master data (master ID "014")
                const vesselMasterData = await this.getMasterDataEntries("014");
                const vessel = vesselMasterData?.find((v: any) => v.name === vesselValue);
                
                if (vessel && vessel.entryId) {
                  // Use the entryId which is in VSL-XXX format
                  vesselIdToMatch = vessel.entryId;
                }
              }
            }
            
            if (vesselIdToMatch && assignment.rank) {
              // Look for crew members currently on this vessel with this rank
              // Note: crew.presentVessel stores vessel ID format "VSL-003"
              const crewOnBoard = Array.from(this.crewMembers.values()).find(crew => 
                crew.presentVessel === vesselIdToMatch && crew.presentRank === assignment.rank
              );
              
              if (crewOnBoard) {
                // Get vessel planning data for this crew member to get contract dates
                // vesselPlanning.vesselId stores vessel ID
                const planning = Array.from(this.vesselPlanning.values()).find(p => 
                  p.onBoardCrewId === crewOnBoard.id && p.vesselId === vesselIdToMatch && p.rank === assignment.rank
                );
                
                if (planning && planning.reliefDue) {
                  // Calculate range dates based on contract end range settings
                  const reliefDueDate = new Date(planning.reliefDue);
                  const rangeStartMonths = planning.contractEndRangeStartMonths || 0;
                  const rangeEndMonths = planning.contractEndRangeEndMonths || 1;
                  
                  const rangeStartDate = new Date(reliefDueDate);
                  rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
                  
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.familyName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: planning.signOnDate || crewOnBoard.signOnDate || '',
                    contractEndDate: planning.reliefDue,
                    rangeStartDate: rangeStartDate.toISOString().split('T')[0],
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                } else if (crewOnBoard.signOnDate && crewOnBoard.reliefDue) {
                  // Fallback to crew member data if no planning data
                  const reliefDueDate = new Date(crewOnBoard.reliefDue);
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + 1); // Default 1 month grace period
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.familyName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: crewOnBoard.signOnDate,
                    contractEndDate: crewOnBoard.reliefDue,
                    rangeStartDate: crewOnBoard.reliefDue,
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                }
              }
            }
            
            const { assignmentIndex: _, ...assignmentWithoutIndex } = assignment;
            
            // For archived assignments, add result and archivedDate fields
            let result: string | undefined;
            let archivedDate: string | undefined;
            if (assignment.proposalStatus === "deployed") {
              result = "Deployed";
              archivedDate = assignment.deployedDate;
            } else if (assignment.proposalStatus === "rejected") {
              result = "Rejected";
              archivedDate = assignment.rejectedDate;
            }
            
            assignments.push({
              ...assignmentWithoutIndex,
              planId: plan.id,
              draftId: plan.draftId,
              proposedBy: plan.proposedBy,
              proposedDate: plan.proposedDate,
              assignmentIndex: i,
              currentCrew, // Add current crew timeline data
              ...(result && { result }),
              ...(archivedDate && { archivedDate }),
            });
          }
        }
      }
    }

    // Sort archived assignments by archivedDate (latest first)
    if (filters?.archived) {
      assignments.sort((a, b) => {
        const dateA = new Date(a.archivedDate || '1970-01-01');
        const dateB = new Date(b.archivedDate || '1970-01-01');
        return dateB.getTime() - dateA.getTime();
      });
    }

    return assignments;
  }

  async deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[]; vesselPlanningId?: number; vesselCode?: string }> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return { success: false };

    const assignments = JSON.parse(plan.assignments);
    const assignment = assignments[assignmentIndex];
    if (!assignment) return { success: false };

    // Check for conflicts, excluding this assignment to avoid self-conflict
    const conflicts = await this.checkAssignmentConflicts(
      assignment.crewId,
      assignment.joiningDate,
      assignment.contractPeriod,
      planId,
      assignmentIndex
    );

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    // Mark assignment as deployed
    assignments[assignmentIndex] = {
      ...assignment,
      proposalStatus: "deployed",
      deployedDate: new Date().toISOString().split('T')[0],
      deployedBy
    };

    // Update rotation plan
    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      updatedAt: null as any // new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);
    this.saveToFile(); // SAVE TO FILE!

    // Update vessel planning entry for the deployed crew
    // Require proper IDs - fail if not available
    if (!assignment.vesselId || !assignment.rankId) {
      console.error('Missing vesselId or rankId in assignment:', assignment);
      return { success: false };
    }

    // PersistentFileStorage doesn't have master data - use static vessel mapping for testing
    const vesselCode = translateVesselNameToCode(assignment.vesselId);
    console.log(`🔄 Vessel translation (PersistentFileStorage):`, { 
      vesselName: assignment.vesselId, 
      vesselCode
    });

    // Find existing vessel planning record for this vessel + rank
    let existingPlanningId: number | null = null;
    for (const [id, planning] of Array.from(this.vesselPlanning.entries())) {
      if (planning.vesselId === vesselCode && planning.rankId === assignment.rankId) {
        existingPlanningId = id;
        break;
      }
    }

    if (existingPlanningId !== null) {
      // Update existing record with reliever information
      await this.updateVesselPlanning(existingPlanningId, {
        relieverCrewId: assignment.crewId,
        relieverCrewName: assignment.crewName,
        relieverSignOnDate: assignment.signOnDate || assignment.joiningDate,
        joiningStatus: "Planned",
        contractPeriodMonths: assignment.contractPeriod,
        deploymentChecklistCompleted: false,
        applicableDocsChecked: false,
      });
    } else {
      // Create new vessel planning entry if none exists
      const vesselPlanningEntry = {
        vesselId: vesselCode,
        rankId: assignment.rankId,
        rank: assignment.rank,
        relieverCrewId: assignment.crewId,
        relieverCrewName: assignment.crewName,
        relieverSignOnDate: assignment.signOnDate || assignment.joiningDate,
        joiningStatus: "Planned",
        contractPeriodMonths: assignment.contractPeriod,
        deploymentChecklistCompleted: false,
        applicableDocsChecked: false,
      };
      await this.createVesselPlanning(vesselPlanningEntry);
    }

    // Create independent archive entry for this deployment with full snapshot
    // Preserve exact source values - use null if not available (no synthetic defaults)
    const archivedDate = new Date().toISOString().split('T')[0];
    await this.createArchiveEntry({
      originalPlanId: planId,
      originalDraftId: plan.draftId || null,
      originalAssignmentIndex: assignmentIndex,
      vesselId: vesselCode,
      vesselName: assignment.vessel || assignment.vesselName || null,
      rankId: assignment.rankId || null,
      rank: assignment.rank,
      crewId: assignment.crewId,
      crewName: assignment.crewName,
      crewMemberId: assignment.crewMemberId || null,
      signOnDate: assignment.signOnDate || assignment.joiningDate,
      joiningPort: assignment.joiningPort || null,
      contractPeriod: assignment.contractPeriod,
      signOffDate: assignment.signOffDate || null,
      proposedBy: plan.proposedBy || null,
      proposedDate: plan.proposedDate || null,
      result: 'Deployed',
      archivedDate,
      archivedBy: deployedBy || null,
      vesselPlanningId: existingPlanningId || null,
      currentCrewInfo: assignment.currentCrew ? JSON.stringify(assignment.currentCrew) : null,
      fullAssignmentSnapshot: JSON.stringify(assignment),
    });

    return { success: true, vesselPlanningId: existingPlanningId || undefined, vesselCode };
  }

  async rejectAssignment(planId: number, assignmentIndex: number, rejectedBy?: string): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return undefined;

    const assignments = JSON.parse(plan.assignments);
    if (!assignments[assignmentIndex]) return undefined;

    const assignment = assignments[assignmentIndex];

    // Mark assignment as rejected (instead of removing it, so it can be archived)
    // Preserve exact rejectedBy value - use null if not available
    assignments[assignmentIndex] = {
      ...assignment,
      proposalStatus: "rejected",
      rejectedDate: new Date().toISOString().split('T')[0],
      rejectedBy: rejectedBy || null
    };

    // Check if all assignments are now processed (deployed or rejected)
    const pendingAssignments = assignments.filter((a: any) => 
      !a.proposalStatus || a.proposalStatus === "proposed"
    );
    const planStatus = pendingAssignments.length === 0 ? "Completed" : plan.planStatus;

    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      planStatus,
      updatedAt: null as any // new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);

    // Create independent archive entry for this rejection with full snapshot
    // Preserve exact source values - use null if not available (no synthetic defaults)
    const archivedDate = new Date().toISOString().split('T')[0];
    // Use original vesselId without translation - preserve exact source value
    const vesselCode = assignment.vesselId || assignment.vessel || null;
    
    await this.createArchiveEntry({
      originalPlanId: planId,
      originalDraftId: plan.draftId || null,
      originalAssignmentIndex: assignmentIndex,
      vesselId: vesselCode,
      vesselName: assignment.vessel || assignment.vesselName || null,
      rankId: assignment.rankId || null,
      rank: assignment.rank,
      crewId: assignment.crewId,
      crewName: assignment.crewName,
      crewMemberId: assignment.crewMemberId || null,
      signOnDate: assignment.signOnDate || assignment.joiningDate,
      joiningPort: assignment.joiningPort || null,
      contractPeriod: assignment.contractPeriod,
      signOffDate: assignment.signOffDate || null,
      proposedBy: plan.proposedBy || null,
      proposedDate: plan.proposedDate || null,
      result: 'Rejected',
      archivedDate,
      archivedBy: rejectedBy || null,
      vesselPlanningId: null,
      currentCrewInfo: assignment.currentCrew ? JSON.stringify(assignment.currentCrew) : null,
      fullAssignmentSnapshot: JSON.stringify(assignment),
    });

    this.saveToFile();
    return updatedPlan;
  }

  async checkAssignmentConflicts(
    crewId: string, 
    signOnDate: string, 
    contractPeriod: number,
    excludePlanId?: number,
    excludeAssignmentIndex?: number
  ): Promise<any[]> {
    const conflicts: any[] = [];
    const signOnDateObj = new Date(signOnDate);
    const contractEndDate = new Date(signOnDateObj);
    contractEndDate.setMonth(contractEndDate.getMonth() + contractPeriod);

    // Check all proposed assignments
    for (const plan of Array.from(this.rotationPlans.values())) {
      if (plan.assignments) {
        const assignments = JSON.parse(plan.assignments);
        for (let i = 0; i < assignments.length; i++) {
          const assignment = assignments[i];
          
          // Skip the assignment being deployed to avoid self-conflict
          if (excludePlanId !== undefined && excludeAssignmentIndex !== undefined) {
            if (plan.id === excludePlanId && i === excludeAssignmentIndex) {
              continue;
            }
          }
          
          if (assignment.crewId === crewId && assignment.proposalStatus === "proposed") {
            const assignmentSignOnDate = new Date(assignment.signOnDate || assignment.joiningDate);
            const assignmentEndDate = new Date(assignmentSignOnDate);
            assignmentEndDate.setMonth(assignmentEndDate.getMonth() + assignment.contractPeriod);

            // Check for overlap
            if (
              (signOnDateObj <= assignmentEndDate && contractEndDate >= assignmentSignOnDate)
            ) {
              conflicts.push({
                planId: plan.id,
                draftId: plan.draftId,
                vessel: assignment.vesselName,
                rank: assignment.rank,
                signOnDate: assignment.signOnDate || assignment.joiningDate,
                contractPeriod: assignment.contractPeriod
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  // Rotation Archive Methods - Independent historical records
  async getArchivedAssignments(filters?: { vessels?: string[]; ranks?: string[]; dateFrom?: string; dateTo?: string }): Promise<RotationArchiveEntry[]> {
    let entries = Array.from(this.rotationArchive.values());
    
    // Apply filters if provided
    if (filters?.vessels && filters.vessels.length > 0) {
      entries = entries.filter(e => e.vesselName && filters.vessels!.includes(e.vesselName));
    }
    if (filters?.ranks && filters.ranks.length > 0) {
      entries = entries.filter(e => filters.ranks!.includes(e.rank));
    }
    if (filters?.dateFrom) {
      entries = entries.filter(e => e.archivedDate >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      entries = entries.filter(e => e.archivedDate <= filters.dateTo!);
    }
    
    // Sort by archived date, latest first
    entries.sort((a, b) => new Date(b.archivedDate).getTime() - new Date(a.archivedDate).getTime());
    
    return entries;
  }

  async createArchiveEntry(entry: InsertRotationArchive): Promise<RotationArchiveEntry> {
    const id = this.currentRotationArchiveId++;
    const archiveEntry: RotationArchiveEntry = {
      id,
      originalPlanId: entry.originalPlanId ?? null,
      originalDraftId: entry.originalDraftId ?? null,
      originalAssignmentIndex: entry.originalAssignmentIndex ?? null,
      vesselId: entry.vesselId ?? null,
      vesselName: entry.vesselName ?? null,
      rankId: entry.rankId ?? null,
      rank: entry.rank,
      crewId: entry.crewId,
      crewName: entry.crewName,
      crewMemberId: entry.crewMemberId ?? null,
      signOnDate: entry.signOnDate,
      joiningPort: entry.joiningPort ?? null,
      contractPeriod: entry.contractPeriod ?? null,
      signOffDate: entry.signOffDate ?? null,
      proposedBy: entry.proposedBy ?? null,
      proposedDate: entry.proposedDate ?? null,
      result: entry.result,
      archivedDate: entry.archivedDate,
      archivedBy: entry.archivedBy ?? null,
      vesselPlanningId: entry.vesselPlanningId ?? null,
      currentCrewInfo: entry.currentCrewInfo ?? null,
      fullAssignmentSnapshot: entry.fullAssignmentSnapshot ?? null,
      createdAt: new Date(),
    };
    this.rotationArchive.set(id, archiveEntry);
    this.saveToFile();
    return archiveEntry;
  }

  // Drug/Alcohol Test Records Methods
  async getDrugAlcoholTestRecords(): Promise<DrugAlcoholTestRecord[]> {
    return Array.from(this.drugAlcoholTestRecords.values());
  }

  async getDrugAlcoholTestRecord(id: number): Promise<DrugAlcoholTestRecord | undefined> {
    return this.drugAlcoholTestRecords.get(id);
  }

  async getDrugAlcoholTestRecordsByVessel(vesselId: string, testType?: string): Promise<DrugAlcoholTestRecord[]> {
    const records = Array.from(this.drugAlcoholTestRecords.values()).filter(
      record => record.vesselId === vesselId
    );
    
    if (testType) {
      return records.filter(record => record.testType === testType);
    }
    
    return records;
  }

  async createDrugAlcoholTestRecord(insertRecord: InsertDrugAlcoholTestRecord): Promise<DrugAlcoholTestRecord> {
    const id = this.currentDrugAlcoholTestRecordId++;
    const record: DrugAlcoholTestRecord = {
      id,
      vesselId: insertRecord.vesselId,
      testType: insertRecord.testType,
      alcoholDrugType: insertRecord.alcoholDrugType ?? null,
      placeLocation: insertRecord.placeLocation ?? null,
      dateTimeTestCompleted: insertRecord.dateTimeTestCompleted ?? null,
      externalTestResultsDate: insertRecord.externalTestResultsDate ?? null,
      incidentId: insertRecord.incidentId ?? null,
      testingEquipment: insertRecord.testingEquipment ?? null,
      equipmentNotApplicable: insertRecord.equipmentNotApplicable ?? false,
      testHistory: insertRecord.testHistory ?? null,
      frequencyMonths: insertRecord.frequencyMonths ?? 12,
      plannedPort: insertRecord.plannedPort ?? null,
      plannedDate: insertRecord.plannedDate ?? null,
      plannedComments: insertRecord.plannedComments ?? null,
      incidentTitle: insertRecord.incidentTitle ?? null,
      incidentDateTime: insertRecord.incidentDateTime ?? null,
      alcoholTestDateTime: insertRecord.alcoholTestDateTime ?? null,
      drugTestDateTime: insertRecord.drugTestDateTime ?? null,
      violations: insertRecord.violations ?? 0,
      testDateTime: insertRecord.testDateTime ?? null,
      otherTestType: insertRecord.otherTestType ?? null,
      reasonForTesting: insertRecord.reasonForTesting ?? null,
      description: insertRecord.description ?? null,
      initiatedBy: insertRecord.initiatedBy ?? null,
      personnelTested: insertRecord.personnelTested ?? null,
      comments: insertRecord.comments ?? null,
      masterDeputySignature: insertRecord.masterDeputySignature ?? null,
      attachmentFile: insertRecord.attachmentFile ?? null,
      createdAt: null,
      updatedAt: null
    };
    this.drugAlcoholTestRecords.set(id, record);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return record;
  }

  async updateDrugAlcoholTestRecord(id: number, updateData: Partial<InsertDrugAlcoholTestRecord>): Promise<DrugAlcoholTestRecord | undefined> {
    const existingRecord = this.drugAlcoholTestRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: DrugAlcoholTestRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.drugAlcoholTestRecords.set(id, updatedRecord);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedRecord;
  }

  async deleteDrugAlcoholTestRecord(id: number): Promise<boolean> {
    const result = this.drugAlcoholTestRecords.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rest Hours Vessel Records Methods
  async getRestHoursVesselRecords(): Promise<RestHoursVesselRecord[]> {
    return Array.from(this.restHoursVesselRecords.values());
  }

  async getRestHoursVesselRecord(id: number): Promise<RestHoursVesselRecord | undefined> {
    return this.restHoursVesselRecords.get(id);
  }

  async getRestHoursVesselRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string }): Promise<RestHoursVesselRecord[]> {
    let records = Array.from(this.restHoursVesselRecords.values());
    
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      records = records.filter(record => filters.vesselIds!.includes(record.vesselId));
    }
    
    if (filters.monthValue) {
      records = records.filter(record => record.monthValue === filters.monthValue);
    }
    
    return records;
  }

  async createRestHoursVesselRecord(insertRecord: InsertRestHoursVesselRecord): Promise<RestHoursVesselRecord> {
    const id = this.currentRestHoursVesselRecordId++;
    const record: RestHoursVesselRecord = {
      id,
      createdAt: null,
      updatedAt: null,
      vesselId: insertRecord.vesselId,
      vesselName: insertRecord.vesselName,
      month: insertRecord.month,
      monthValue: insertRecord.monthValue,
      totalCrew: insertRecord.totalCrew ?? 0,
      recordingStatusPercent: insertRecord.recordingStatusPercent ?? 0,
      activityConflicting: insertRecord.activityConflicting ?? false,
      crewWithActivityConflicts: insertRecord.crewWithActivityConflicts ?? 0,
      crewWithActivityConflictsDetails: insertRecord.crewWithActivityConflictsDetails ?? null,
      totalViolations: insertRecord.totalViolations ?? 0,
      crewWithViolations: insertRecord.crewWithViolations ?? 0,
      crewWithViolationsDetails: insertRecord.crewWithViolationsDetails ?? null,
      totalNCs: insertRecord.totalNCs ?? 0,
      crewWithNCs: insertRecord.crewWithNCs ?? 0,
      crewWithNCsDetails: insertRecord.crewWithNCsDetails ?? null,
      predictedViolations: insertRecord.predictedViolations ?? 0,
      crewWithPredictedViolations: insertRecord.crewWithPredictedViolations ?? 0,
      crewWithPredictedViolationsDetails: insertRecord.crewWithPredictedViolationsDetails ?? null,
      predictedNCs: insertRecord.predictedNCs ?? 0,
      crewWithPredictedNCs: insertRecord.crewWithPredictedNCs ?? 0,
      crewWithPredictedNCsDetails: insertRecord.crewWithPredictedNCsDetails ?? null,
      vesselReviewStatus: insertRecord.vesselReviewStatus ?? "Due",
      vesselReviewSubmittedDate: insertRecord.vesselReviewSubmittedDate ?? null,
      officeReviewStatus: insertRecord.officeReviewStatus ?? "Due",
      officeReviewSubmittedDate: insertRecord.officeReviewSubmittedDate ?? null
    };
    this.restHoursVesselRecords.set(id, record);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return record;
  }

  async updateRestHoursVesselRecord(id: number, updateData: Partial<InsertRestHoursVesselRecord>): Promise<RestHoursVesselRecord | undefined> {
    const existingRecord = this.restHoursVesselRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: RestHoursVesselRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.restHoursVesselRecords.set(id, updatedRecord);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedRecord;
  }

  async deleteRestHoursVesselRecord(id: number): Promise<boolean> {
    const result = this.restHoursVesselRecords.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rest Hours Crew Records Methods
  async getRestHoursCrewRecords(): Promise<RestHoursCrewRecord[]> {
    return Array.from(this.restHoursCrewRecords.values());
  }

  async getRestHoursCrewRecord(id: number): Promise<RestHoursCrewRecord | undefined> {
    return this.restHoursCrewRecords.get(id);
  }

  async getRestHoursCrewRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string; ranks?: string[]; search?: string }): Promise<RestHoursCrewRecord[]> {
    let records = Array.from(this.restHoursCrewRecords.values());
    
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      records = records.filter(record => filters.vesselIds!.includes(record.vesselId));
    }
    
    if (filters.monthValue) {
      records = records.filter(record => record.monthValue === filters.monthValue);
    }
    
    if (filters.ranks && filters.ranks.length > 0) {
      records = records.filter(record => filters.ranks!.includes(record.rank));
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      records = records.filter(record => 
        record.name.toLowerCase().includes(searchLower) ||
        record.crewMemberId.toLowerCase().includes(searchLower)
      );
    }
    
    return records;
  }

  async createRestHoursCrewRecord(insertRecord: InsertRestHoursCrewRecord): Promise<RestHoursCrewRecord> {
    const id = this.currentRestHoursCrewRecordId++;
    const record: RestHoursCrewRecord = {
      id,
      vesselId: insertRecord.vesselId,
      vesselName: insertRecord.vesselName,
      crewMemberId: insertRecord.crewMemberId,
      rank: insertRecord.rank,
      name: insertRecord.name,
      month: insertRecord.month,
      monthValue: insertRecord.monthValue,
      signOnOffInfo: insertRecord.signOnOffInfo ?? null,
      recordingStatusPercent: insertRecord.recordingStatusPercent ?? 0,
      activityConflicting: insertRecord.activityConflicting ?? false,
      totalViolations: insertRecord.totalViolations ?? 0,
      totalNCs: insertRecord.totalNCs ?? 0,
      predictedViolations: insertRecord.predictedViolations ?? 0,
      predictedNCs: insertRecord.predictedNCs ?? 0,
      createdAt: null,
      updatedAt: null
    };
    this.restHoursCrewRecords.set(id, record);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return record;
  }

  async updateRestHoursCrewRecord(id: number, updateData: Partial<InsertRestHoursCrewRecord>): Promise<RestHoursCrewRecord | undefined> {
    const existingRecord = this.restHoursCrewRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: RestHoursCrewRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.restHoursCrewRecords.set(id, updatedRecord);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedRecord;
  }

  async deleteRestHoursCrewRecord(id: number): Promise<boolean> {
    const result = this.restHoursCrewRecords.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rest Hours Daily Records Methods
  async getRestHoursDailyRecords(): Promise<RestHoursDailyRecord[]> {
    return Array.from(this.restHoursDailyRecords.values());
  }

  async getRestHoursDailyRecord(id: number): Promise<RestHoursDailyRecord | undefined> {
    return this.restHoursDailyRecords.get(id);
  }

  async getRestHoursDailyRecordByKey(crewMemberId: string, vesselId: string, monthYear: string): Promise<RestHoursDailyRecord | undefined> {
    const records = Array.from(this.restHoursDailyRecords.values());
    const matches = records.filter(record => 
      record.crewMemberId === crewMemberId && 
      record.vesselId === vesselId && 
      record.monthYear === monthYear
    );
    
    // If duplicates exist, return the one with the highest ID (most recent)
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];
    
    return matches.reduce((latest, current) => {
      const latestId = Number(latest.id);
      const currentId = Number(current.id);
      return currentId > latestId ? current : latest;
    });
  }

  async createRestHoursDailyRecord(insertRecord: InsertRestHoursDailyRecord): Promise<RestHoursDailyRecord> {
    // Check if a record already exists for this crew/vessel/month (upsert logic)
    const existing = await this.getRestHoursDailyRecordByKey(
      insertRecord.crewMemberId,
      insertRecord.vesselId,
      insertRecord.monthYear
    );
    
    if (existing) {
      // Update existing record instead of creating duplicate
      const updatedRecord: RestHoursDailyRecord = {
        ...existing,
        ...insertRecord,
        id: existing.id, // Keep the original ID
        createdAt: existing.createdAt, // Keep the original creation date
        updatedAt: null,
      };
      this.restHoursDailyRecords.set(existing.id, updatedRecord);
      this.saveToFile(); // SAVE TO FILE AFTER UPDATE!
      return updatedRecord;
    }
    
    // Create new record if none exists
    const id = this.currentRestHoursDailyRecordId++;
    const record: RestHoursDailyRecord = {
      id,
      crewMemberId: insertRecord.crewMemberId,
      vesselId: insertRecord.vesselId,
      rank: insertRecord.rank,
      name: insertRecord.name,
      monthYear: insertRecord.monthYear,
      dailyRecords: insertRecord.dailyRecords,
      showPlanning: insertRecord.showPlanning ?? null,
      opaMode: insertRecord.opaMode ?? null,
      createdAt: null,
      updatedAt: null
    };
    this.restHoursDailyRecords.set(id, record);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return record;
  }

  async updateRestHoursDailyRecord(id: number, updateData: Partial<InsertRestHoursDailyRecord>): Promise<RestHoursDailyRecord | undefined> {
    const existingRecord = this.restHoursDailyRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: RestHoursDailyRecord = {
      ...existingRecord,
      ...updateData,
      updatedAt: null,
    };
    this.restHoursDailyRecords.set(id, updatedRecord);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedRecord;
  }

  async deleteRestHoursDailyRecord(id: number): Promise<boolean> {
    const result = this.restHoursDailyRecords.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Variable Tasks methods
  async getVariableTasks(): Promise<VariableTask[]> {
    return Array.from(this.variableTasks.values());
  }

  async getVariableTask(id: number): Promise<VariableTask | undefined> {
    return this.variableTasks.get(id);
  }

  async getVariableTasksByFilters(filters: { vesselId?: string; periodValue?: string }): Promise<VariableTask[]> {
    let tasks = Array.from(this.variableTasks.values());
    
    if (filters.vesselId) {
      tasks = tasks.filter(task => task.vesselId === filters.vesselId);
    }
    
    if (filters.periodValue) {
      tasks = tasks.filter(task => task.periodValue === filters.periodValue);
    }
    
    return tasks;
  }

  async createVariableTask(insertTask: InsertVariableTask): Promise<VariableTask> {
    const id = this.currentVariableTaskId++;
    const task: VariableTask = {
      id,
      startDateTime: insertTask.startDateTime,
      finishDateTime: insertTask.finishDateTime,
      startDateTimeSort: insertTask.startDateTimeSort,
      finishDateTimeSort: insertTask.finishDateTimeSort,
      task: insertTask.task,
      status: insertTask.status,
      crewInvolved: insertTask.crewInvolved,
      remarks: insertTask.remarks ?? null,
      periodValue: insertTask.periodValue ?? null,
      vesselId: insertTask.vesselId ?? null,
      isDraft: insertTask.isDraft ?? true,
      recordType: insertTask.recordType,
      statusType: insertTask.statusType,
      selectedTasks: insertTask.selectedTasks ?? null,
      otherTask: insertTask.otherTask ?? null,
      crewInvolvedDetails: insertTask.crewInvolvedDetails ?? null,
      comments: insertTask.comments ?? null
    };
    this.variableTasks.set(id, task);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return task;
  }

  async updateVariableTask(id: number, updateData: Partial<InsertVariableTask>): Promise<VariableTask | undefined> {
    const existingTask = this.variableTasks.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask: VariableTask = {
      ...existingTask,
      ...updateData,
    };
    this.variableTasks.set(id, updatedTask);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedTask;
  }

  async deleteVariableTask(id: number): Promise<boolean> {
    const result = this.variableTasks.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Helper to parse fixed task JSON fields
  private parseFixedTaskData(task: FixedTask): FixedTask {
    return {
      ...task,
      seaHours: typeof task.seaHours === 'string' ? JSON.parse(task.seaHours) : task.seaHours,
      portHours: typeof task.portHours === 'string' ? JSON.parse(task.portHours) : task.portHours,
    };
  }

  // Fixed Tasks
  async getFixedTasks(): Promise<FixedTask[]> {
    return Array.from(this.fixedTasks.values()).map(task => this.parseFixedTaskData(task));
  }

  async getFixedTask(id: number): Promise<FixedTask | undefined> {
    const task = this.fixedTasks.get(id);
    return task ? this.parseFixedTaskData(task) : undefined;
  }

  async getFixedTasksByVesselAndMonth(vesselId: string, monthYear: string): Promise<FixedTask[]> {
    const allTasks = Array.from(this.fixedTasks.values());
    return allTasks
      .filter(task => task.vesselId === vesselId && task.monthYear === monthYear)
      .map(task => this.parseFixedTaskData(task));
  }

  async getFixedTaskByKey(crewMemberId: string, vesselId: string, monthYear: string): Promise<FixedTask | undefined> {
    const tasks = Array.from(this.fixedTasks.values());
    const task = tasks.find(task => 
      task.crewMemberId === crewMemberId && 
      task.vesselId === vesselId && 
      task.monthYear === monthYear
    );
    return task ? this.parseFixedTaskData(task) : undefined;
  }

  async createFixedTask(insertTask: InsertFixedTask): Promise<FixedTask> {
    const id = this.currentFixedTaskId++;
    const task: FixedTask = {
      id,
      name: insertTask.name,
      rank: insertTask.rank,
      crewMemberId: insertTask.crewMemberId,
      vesselId: insertTask.vesselId,
      monthYear: insertTask.monthYear,
      seaHours: insertTask.seaHours,
      portHours: insertTask.portHours,
      createdAt: null,
      updatedAt: null
    };
    this.fixedTasks.set(id, task);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return this.parseFixedTaskData(task);
  }

  async updateFixedTask(id: number, updateData: Partial<InsertFixedTask>): Promise<FixedTask | undefined> {
    const existingTask = this.fixedTasks.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask: FixedTask = {
      ...existingTask,
      ...updateData,
    };
    this.fixedTasks.set(id, updatedTask);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return this.parseFixedTaskData(updatedTask);
  }

  async deleteFixedTask(id: number): Promise<boolean> {
    const result = this.fixedTasks.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Data Masters methods (return empty array for frontend compatibility)
  async getDataMasters(): Promise<any[]> {
    // PersistentFileStorage doesn't have data masters - return empty array for frontend compatibility
    // Individual masters work via getMasterDataEntries() instead
    return [];
  }

  async getDataMaster(id: string): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async createDataMaster(masterData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async updateDataMaster(id: string, masterData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  // Master Data Entries methods (not supported - same as MemStorage)  
  async getMasterDataEntries(masterId: string): Promise<any[]> {
    try {
      // Filter entries by masterId
      const filteredEntries: any[] = [];
      for (const [key, entry] of Array.from(this.masterDataEntries)) {
        if (entry.masterId === masterId) {
          filteredEntries.push(entry);
        }
      }
      
      // Only log in development mode for performance
      if (process.env.NODE_ENV === 'development') {
        console.log(`📄 [PERSISTENT] getMasterDataEntries(${masterId}): Found ${filteredEntries.length} entries`);
      }
      return filteredEntries;
    } catch (error) {
      console.error(`❌ [PERSISTENT] Error getting master data entries for ${masterId}:`, error);
      return [];
    }
  }

  async getMasterDataEntry(id: number): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async createMasterDataEntry(entryData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async updateMasterDataEntry(id: number, entryData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }
}

// DatabaseStorage - PostgreSQL backend (Phase 4: ENABLED!)
import { DatabaseStorage } from "./database";
import * as fs from 'fs';
import * as path from 'path';

// Get DATABASE_URL with proper priority
function constructDatabaseUrl(): string | null {
  // PRIORITY 1: Use DATABASE_URL if set directly (Replit PostgreSQL)
  if (process.env.DATABASE_URL) {
    console.log("🔗 Using DATABASE_URL from environment (Replit PostgreSQL)");
    return process.env.DATABASE_URL;
  }

  // PRIORITY 2: Construct from DB_HOST/DB_PORT (legacy MySQL RDS)
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST && DB_PORT && DB_USER && DB_PASSWORD) {
    console.log("🔗 Constructing DATABASE_URL from DB_HOST/DB_PORT (legacy setup)");
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    return `postgresql://${DB_USER}:${encodedPassword}@${DB_HOST}:${DB_PORT}/crew_database`;
  }

  return null;
}

// Initialize PostgreSQL storage with improved error handling
let storage: IStorage;
let isConnected = false;
let connectionError: Error | null = null;

const databaseUrl = constructDatabaseUrl();

// Phase 4: PostgreSQL Backend ENABLED!
// Switch from PersistentFileStorage to DatabaseStorage
const databaseUrlForceDisabled: string | undefined = true ? (databaseUrl || undefined) : undefined;
if (databaseUrlForceDisabled) {
  try {
    // Set the constructed DATABASE_URL for DatabaseStorage to use
    process.env.DATABASE_URL = databaseUrlForceDisabled;
    // Phase 4: DatabaseStorage ENABLED!
    storage = new DatabaseStorage();

    console.log("🔌 Attempting to connect to PostgreSQL...");
    console.log("🎯 Target Database: PostgreSQL 'crew_database'");

    // Database connection test only - seeding completely disabled per user request
    (async () => {
      try {
        console.log("⏳ Testing database connection...");
        console.log("ℹ️ Automatic data seeding is disabled - users manage their own entries");
        // await (storage as DatabaseStorage).seedDatabase(); // DISABLED PER USER REQUEST
        isConnected = true;
        connectionError = null;
        console.log("✅ SUCCESS: PostgreSQL database connected successfully!");
        console.log("✅ DatabaseStorage (PostgreSQL) initialized successfully!");
        console.log("🚀 Application is ready to serve requests with persistent PostgreSQL storage");
      } catch (error) {
        isConnected = false;
        connectionError = error as Error;
        console.error("⚠️  WARNING: Failed to connect to PostgreSQL database:", error);
        console.error("🔍 Connection Details:");
        console.error(`   • DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
        console.error("📊 This could be due to:");
        console.error("   • PostgreSQL database not accessible");
        console.error("   • Network connectivity issues");
        console.error("   • Incorrect credentials");
        console.error("🚑 Server will start anyway. Use /api/health to test connectivity.");
      }
    })();
  } catch (error) {
    isConnected = false;
    connectionError = error as Error;
    console.error("❌ ERROR: Failed to initialize PostgreSQL database:", error);
    console.error("🚑 Server will start anyway. Use /api/health to test connectivity.");
    // Create a stub storage that will throw meaningful errors
    storage = new (class {
      private throwConnectionError(): never {
        throw new Error(`PostgreSQL connection failed: ${connectionError?.message || 'Unknown error'}. Check /api/health for details.`);
      }
      async getUser(): Promise<any> { this.throwConnectionError(); }
      async getUserByUsername(): Promise<any> { this.throwConnectionError(); }
      async createUser(): Promise<any> { this.throwConnectionError(); }
      async getForms(): Promise<any> { this.throwConnectionError(); }
      async getForm(): Promise<any> { this.throwConnectionError(); }
      async createForm(): Promise<any> { this.throwConnectionError(); }
      async updateForm(): Promise<any> { this.throwConnectionError(); }
      async deleteForm(): Promise<any> { this.throwConnectionError(); }
      async getRankGroups(): Promise<any> { this.throwConnectionError(); }
      async createRankGroup(): Promise<any> { this.throwConnectionError(); }
      async updateRankGroup(): Promise<any> { this.throwConnectionError(); }
      async deleteRankGroup(): Promise<any> { this.throwConnectionError(); }
      async getAvailableRanks(): Promise<any> { this.throwConnectionError(); }
      async createAvailableRank(): Promise<any> { this.throwConnectionError(); }
      async updateAvailableRank(): Promise<any> { this.throwConnectionError(); }
      async deleteAvailableRank(): Promise<any> { this.throwConnectionError(); }
      async clearAllAvailableRanks(): Promise<any> { this.throwConnectionError(); }
      async getCrewMembers(): Promise<any> { this.throwConnectionError(); }
      async getCrewMember(): Promise<any> { this.throwConnectionError(); }
      async createCrewMember(): Promise<any> { this.throwConnectionError(); }
      async updateCrewMember(): Promise<any> { this.throwConnectionError(); }
      async deleteCrewMember(): Promise<any> { this.throwConnectionError(); }
      async getAppraisalResults(): Promise<any> { this.throwConnectionError(); }
      async getAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async getAppraisalResultsByCrewMember(): Promise<any> { this.throwConnectionError(); }
      async createAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async updateAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async deleteAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async submitAppraisalStage(): Promise<any> { this.throwConnectionError(); }
      async getRecruitmentCandidates(): Promise<any> { this.throwConnectionError(); }
      async getRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      async getRecruitmentCandidatesByStatus(): Promise<any> { this.throwConnectionError(); }
      async createRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      async updateRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      async deleteRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      // Data Masters - MISSING METHODS CAUSING 404 ERRORS
      async getDataMasters(): Promise<any> { this.throwConnectionError(); }
      async getDataMaster(): Promise<any> { this.throwConnectionError(); }
      async createDataMaster(): Promise<any> { this.throwConnectionError(); }
      async updateDataMaster(): Promise<any> { this.throwConnectionError(); }
      async deleteDataMaster(): Promise<any> { this.throwConnectionError(); }
      // Master Data Entries - MISSING METHODS CAUSING 404 ERRORS  
      async getMasterDataEntries(): Promise<any> { this.throwConnectionError(); }
      async getMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
      async createMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
      async updateMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
      async deleteMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
    })() as any as IStorage;
  }
} else {
  isConnected = false;
  connectionError = null;
  console.log("📄 PERSISTENT FILE STORAGE MODE: Using file-based storage (PersistentFileStorage)");
  console.log("🚀 Application will use persistent JSON storage for development");
  console.log("💾 All data will be saved to test-data.json and persist across restarts");

  // Use PersistentFileStorage for persistent development storage
  storage = new PersistentFileStorage();
  console.log("✅ PersistentFileStorage initialized successfully - data will persist across restarts!");
}

// Export connection status for health checks
export { isConnected, connectionError };

export { storage };