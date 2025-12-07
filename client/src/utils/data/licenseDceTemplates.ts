export interface LicenseTemplate {
  id: string;
  name: string;        // Certificate/Document
  abbr: string;        // Abbreviation
  requirement: string; // STCW Requirement
  officerMatrixLabel?: string; // Officer Matrix Label (for COC certificates)
}

// Static fallback data that mirrors Master 016 in database
// This is used when API is not available or for immediate local lookups
// Ordered by type group: DCE (Oil, Chem, Gas each with Op/Mgt/Support), then COC, then COP
export const LICENSE_DCE_TEMPLATES: LicenseTemplate[] = [
  // DCE Oil Certificates (Operation → Management → Support)
  { id: 'LIC001', name: 'DCE_Oil_Operation', abbr: 'DC_O_O', requirement: 'STCW A-V1-1-1', officerMatrixLabel: '' },
  { id: 'LIC002', name: 'DCE_Oil_Management', abbr: 'DC_O_M', requirement: 'STCW A-V1-1-2', officerMatrixLabel: '' },
  { id: 'LIC018', name: 'DCE_Oil_Support', abbr: 'DC_O_S', requirement: 'STCW A-V1-1', officerMatrixLabel: '' },
  
  // DCE Chem Certificates (Operation → Management → Support)
  { id: 'LIC003', name: 'DCE_Chem_Operation', abbr: 'DC_C_O', requirement: 'STCW A-V1-1-1', officerMatrixLabel: '' },
  { id: 'LIC004', name: 'DCE_Chem_Management', abbr: 'DC_C_M', requirement: 'STCW A-V1-1-3', officerMatrixLabel: '' },
  { id: 'LIC019', name: 'DCE_Chem_Support', abbr: 'DC_C_S', requirement: 'STCW A-V1-1', officerMatrixLabel: '' },
  
  // DCE Gas Certificates (Operation → Management → Support)
  { id: 'LIC005', name: 'DCE_Gas_Operation', abbr: 'DC_G_O', requirement: 'STCW A-V1-2-1', officerMatrixLabel: '' },
  { id: 'LIC006', name: 'DCE_Gas_Management', abbr: 'DC_G_M', requirement: 'STCW A-V1-2-2', officerMatrixLabel: '' },
  { id: 'LIC020', name: 'DCE_Gas_Support', abbr: 'DC_G_S', requirement: 'STCW A-V1-2', officerMatrixLabel: '' },
  
  // COC Certificates (with Officer Matrix Labels)
  { id: 'LIC007', name: 'COC Master', abbr: 'COC_DM', requirement: 'STCW II/2', officerMatrixLabel: 'Master II/2' },
  { id: 'LIC008', name: 'COC Chief Mate', abbr: 'COC_DC', requirement: 'STCW II/2', officerMatrixLabel: 'Chief Mate II/2' },
  { id: 'LIC009', name: 'COC OIC Nav Watch', abbr: 'COC_DW', requirement: 'STCW II/1', officerMatrixLabel: 'OOW Deck II/1' },
  { id: 'LIC010', name: 'COC Chief Engineer', abbr: 'COC_EC', requirement: 'STCW III/2', officerMatrixLabel: 'Chief Eng III/2' },
  { id: 'LIC011', name: 'COC 2nd Engineer', abbr: 'COC_ES', requirement: 'STCW III/2', officerMatrixLabel: 'Second Eng III/2' },
  { id: 'LIC012', name: 'COC OIC Eng Watch', abbr: 'COC_EW', requirement: 'STCW III/1', officerMatrixLabel: 'OOW Eng III/1' },
  { id: 'LIC013', name: 'COC ETO', abbr: 'COC_EO', requirement: 'STCW III/6', officerMatrixLabel: 'ETO III/6' },
  
  // COP Certificates
  { id: 'LIC014', name: 'COP Deck Rating (AB)', abbr: 'COP_DRA', requirement: 'STCW II/5', officerMatrixLabel: '' },
  { id: 'LIC015', name: 'COP Deck Rating (OS)', abbr: 'COP_DRB', requirement: 'STCW II/4', officerMatrixLabel: '' },
  { id: 'LIC016', name: 'COP Engine Rating (ABE)', abbr: 'COP_ERA', requirement: 'STCW III/5', officerMatrixLabel: '' },
  { id: 'LIC017', name: 'COP Engine Rating', abbr: 'COP_ERB', requirement: 'STCW III/4', officerMatrixLabel: '' },
  
  // GMDSS Certificate
  { id: 'LIC021', name: 'GMDSS', abbr: 'GMDSS', requirement: 'STCW IV/2', officerMatrixLabel: '' },
];

// Master ID for License & DCE templates in the database
export const LICENSE_DCE_MASTER_ID = '016';

export function getLicenseTemplateById(id: string): LicenseTemplate | undefined {
  return LICENSE_DCE_TEMPLATES.find(t => t.id === id);
}

export function getLicenseTemplateByName(name: string): LicenseTemplate | undefined {
  return LICENSE_DCE_TEMPLATES.find(t => t.name.toLowerCase() === name.toLowerCase());
}

export function searchLicenseTemplates(searchTerm: string): LicenseTemplate[] {
  const term = searchTerm.toLowerCase();
  return LICENSE_DCE_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(term) ||
    t.abbr.toLowerCase().includes(term) ||
    t.requirement.toLowerCase().includes(term)
  );
}

/**
 * Convert API response to LicenseTemplate array
 * Use this when fetching from /api/masters/016/data
 */
export function mapApiResponseToLicenseTemplates(apiData: Array<{
  entryId: string;
  name: string;
  shortCode?: string;
  description?: string;
  officerMatrixLabel?: string;
}>): LicenseTemplate[] {
  return apiData.map(entry => ({
    id: entry.entryId,
    name: entry.name,
    abbr: entry.shortCode || '',
    requirement: entry.description || '',
    officerMatrixLabel: entry.officerMatrixLabel || '',
  }));
}

// Pre-exported list of all templates
export const DEFAULT_LICENSE_TEMPLATES = LICENSE_DCE_TEMPLATES;

// ============================================================================
// COC HIERARCHY CONFIGURATION
// ============================================================================
// Defines the progression hierarchy for Certificates of Competency (COC)
// An officer can only hold ONE COC at a time within their department.
// When upgrading, the old COC is archived.

export type CocDepartment = 'deck' | 'engine' | 'eto';

export interface CocHierarchyEntry {
  id: string;           // License ID (e.g., 'L007')
  department: CocDepartment;
  level: number;        // Higher number = higher rank (1=entry, 2=mid, 3=senior)
  name: string;         // Human-readable name
  officerMatrixLabel: string;
}

// COC hierarchy: Defines which licenses are COCs and their rank order
// Level 3 = highest (Master, Chief Engineer)
// Level 2 = middle (Chief Mate, 2nd Engineer)  
// Level 1 = entry (OOW Deck, OOW Engine)
// ETO has single level as it's standalone
export const COC_HIERARCHY: CocHierarchyEntry[] = [
  // Deck Department - progression: OOW → Chief Mate → Master
  { id: 'LIC009', department: 'deck', level: 1, name: 'COC OIC Nav Watch', officerMatrixLabel: 'OOW Deck II/1' },
  { id: 'LIC008', department: 'deck', level: 2, name: 'COC Chief Mate', officerMatrixLabel: 'Chief Mate II/2' },
  { id: 'LIC007', department: 'deck', level: 3, name: 'COC Master', officerMatrixLabel: 'Master II/2' },
  
  // Engine Department - progression: OOW → 2nd Engineer → Chief Engineer
  { id: 'LIC012', department: 'engine', level: 1, name: 'COC OIC Eng Watch', officerMatrixLabel: 'OOW Eng III/1' },
  { id: 'LIC011', department: 'engine', level: 2, name: 'COC 2nd Engineer', officerMatrixLabel: 'Second Eng III/2' },
  { id: 'LIC010', department: 'engine', level: 3, name: 'COC Chief Engineer', officerMatrixLabel: 'Chief Eng III/2' },
  
  // ETO - standalone (no progression within ETO)
  { id: 'LIC013', department: 'eto', level: 1, name: 'COC ETO', officerMatrixLabel: 'ETO III/6' },
];

// Set of all COC license IDs for quick lookup
export const COC_LICENSE_IDS = new Set(COC_HIERARCHY.map(c => c.id));

/**
 * Check if a license ID is a COC (Certificate of Competency)
 */
export function isCocLicense(licenseId: string): boolean {
  return COC_LICENSE_IDS.has(licenseId);
}

/**
 * Get COC hierarchy entry by license ID
 */
export function getCocHierarchyEntry(licenseId: string): CocHierarchyEntry | undefined {
  return COC_HIERARCHY.find(c => c.id === licenseId);
}

/**
 * Get all COC entries for a specific department
 */
export function getCocsByDepartment(department: CocDepartment): CocHierarchyEntry[] {
  return COC_HIERARCHY.filter(c => c.department === department).sort((a, b) => a.level - b.level);
}

/**
 * Find existing COC in crew's licenses that belongs to the same department as the new COC
 * Returns undefined if no conflicting COC found
 */
export function findExistingCocInDepartment(
  existingLicenseIds: string[],
  newCocId: string
): CocHierarchyEntry | undefined {
  const newCoc = getCocHierarchyEntry(newCocId);
  if (!newCoc) return undefined;
  
  for (const licenseId of existingLicenseIds) {
    const existingCoc = getCocHierarchyEntry(licenseId);
    if (existingCoc && existingCoc.department === newCoc.department) {
      return existingCoc;
    }
  }
  return undefined;
}

/**
 * Validate COC selection against existing licenses
 * Returns validation result with action needed
 */
export type CocValidationResult = 
  | { valid: true; action: 'allow' }
  | { valid: true; action: 'upgrade'; existingCoc: CocHierarchyEntry; newCoc: CocHierarchyEntry }
  | { valid: false; action: 'block_same_or_lower'; existingCoc: CocHierarchyEntry; newCoc: CocHierarchyEntry };

export function validateCocSelection(
  existingLicenseIds: string[],
  newLicenseId: string
): CocValidationResult {
  // If new license is not a COC, always allow
  if (!isCocLicense(newLicenseId)) {
    return { valid: true, action: 'allow' };
  }
  
  const newCoc = getCocHierarchyEntry(newLicenseId)!;
  const existingCoc = findExistingCocInDepartment(existingLicenseIds, newLicenseId);
  
  // No existing COC in same department - allow
  if (!existingCoc) {
    return { valid: true, action: 'allow' };
  }
  
  // New COC is higher level - allow with upgrade prompt
  if (newCoc.level > existingCoc.level) {
    return { valid: true, action: 'upgrade', existingCoc, newCoc };
  }
  
  // New COC is same or lower level - block
  return { valid: false, action: 'block_same_or_lower', existingCoc, newCoc };
}

/**
 * Get human-readable department name
 */
export function getDepartmentDisplayName(department: CocDepartment): string {
  switch (department) {
    case 'deck': return 'Deck';
    case 'engine': return 'Engine';
    case 'eto': return 'ETO';
  }
}

/**
 * License record structure (from crew member licenses array)
 */
export interface LicenseRecord {
  id: string;
  licenseId: string;
  certificateDocument: string;
  abbr?: string;
  requirement?: string;
  certificateNo?: string;
  issuingAuthority?: string;
  issued?: string;
  expiry?: string;
  archivedAt?: string;
  archivedReason?: string;
}

/**
 * Result of finding the highest COC
 */
export interface HighestCocResult {
  cocEntry: CocHierarchyEntry;
  license: LicenseRecord;
  officerMatrixLabel: string;
  issuingCountry: string;
}

/**
 * Find the highest active (non-archived) COC from a crew member's licenses.
 * If targetDepartment is specified, prioritizes COCs from that department.
 * Falls back to highest COC across all departments if no match in target department.
 * 
 * @param licenses - Array of crew member's licenses
 * @param targetDepartment - Optional department to prioritize ('deck', 'engine', 'eto')
 */
export function findHighestActiveCoc(
  licenses: LicenseRecord[], 
  targetDepartment?: CocDepartment | null
): HighestCocResult | null {
  if (!licenses || licenses.length === 0) return null;
  
  // Filter to active (non-archived) licenses that are COCs
  const activeCocs: Array<{ license: LicenseRecord; cocEntry: CocHierarchyEntry }> = [];
  
  for (const license of licenses) {
    // Skip archived licenses
    if (license.archivedAt) continue;
    
    const cocEntry = getCocHierarchyEntry(license.licenseId);
    if (cocEntry) {
      activeCocs.push({ license, cocEntry });
    }
  }
  
  if (activeCocs.length === 0) return null;
  
  // If target department specified, try to find COC in that department first
  if (targetDepartment) {
    const deptCocs = activeCocs.filter(c => c.cocEntry.department === targetDepartment);
    if (deptCocs.length > 0) {
      // Sort by level (highest first)
      deptCocs.sort((a, b) => b.cocEntry.level - a.cocEntry.level);
      const highest = deptCocs[0];
      return {
        cocEntry: highest.cocEntry,
        license: highest.license,
        officerMatrixLabel: highest.cocEntry.officerMatrixLabel,
        issuingCountry: highest.license.issuingAuthority || '',
      };
    }
  }
  
  // Fallback: sort by level (highest first), then by department priority (deck > engine > eto)
  activeCocs.sort((a, b) => {
    // First by level (higher is better)
    if (b.cocEntry.level !== a.cocEntry.level) {
      return b.cocEntry.level - a.cocEntry.level;
    }
    // Then by department priority
    const deptPriority: Record<CocDepartment, number> = { deck: 3, engine: 2, eto: 1 };
    return deptPriority[b.cocEntry.department] - deptPriority[a.cocEntry.department];
  });
  
  const highest = activeCocs[0];
  return {
    cocEntry: highest.cocEntry,
    license: highest.license,
    officerMatrixLabel: highest.cocEntry.officerMatrixLabel,
    issuingCountry: highest.license.issuingAuthority || '',
  };
}

/**
 * Infer department from a rank name based on common maritime rank patterns.
 * Returns 'deck', 'engine', 'eto', or null if cannot be determined.
 * 
 * Note: Engine department checks run BEFORE deck checks to handle cases like
 * "Engine Cadet" which contains both "engine" and "cadet".
 */
export function inferDepartmentFromRank(rankName: string): CocDepartment | null {
  if (!rankName) return null;
  
  const lowerRank = rankName.toLowerCase();
  
  // ETO patterns - check first as it's most specific
  if (
    lowerRank.includes('eto') ||
    lowerRank.includes('electro-technical') ||
    lowerRank.includes('electrician')
  ) {
    return 'eto';
  }
  
  // Engine department patterns - check BEFORE deck to handle "Engine Cadet" etc.
  if (
    lowerRank.includes('engineer') ||
    lowerRank.includes('engine') ||       // Catches "Engine Cadet", "Engine Room"
    lowerRank.includes('eng ') ||          // Catches "Eng Cadet", "Eng Rating"
    lowerRank.startsWith('eng') ||         // Catches "Eng" at start
    lowerRank.includes('motorman') ||
    lowerRank.includes('fitter') ||
    lowerRank.includes('oiler') ||
    lowerRank.includes('wiper') ||
    lowerRank.includes('greaser') ||
    lowerRank.includes('pumpman') ||
    lowerRank.includes('donkeyman')
  ) {
    return 'engine';
  }
  
  // Deck department patterns (Master, Officers, Ratings)
  if (
    lowerRank.includes('master') ||
    lowerRank.includes('officer') ||
    lowerRank.includes('mate') ||
    lowerRank.includes('bosun') ||
    lowerRank.includes('boatswain') ||
    lowerRank.includes('able seaman') ||
    lowerRank.includes('ordinary seaman') ||
    lowerRank.includes('cadet') ||         // Only reaches here if not "Engine Cadet"
    lowerRank.includes('deck') ||
    lowerRank.includes('helmsman') ||
    lowerRank.includes('quartermaster') ||
    lowerRank.includes('lookout')
  ) {
    return 'deck';
  }
  
  return null;
}
