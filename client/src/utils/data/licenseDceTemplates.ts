export interface LicenseTemplate {
  id: string;
  name: string;        // Certificate/Document
  abbr: string;        // Abbreviation
  requirement: string; // STCW Requirement
}

// Static fallback data that mirrors Master 016 in database
// This is used when API is not available or for immediate local lookups
export const LICENSE_DCE_TEMPLATES: LicenseTemplate[] = [
  // DCE Certificates
  { id: 'L001', name: 'DCE_Oil_Operation', abbr: 'DC_O_O', requirement: 'STCW A-V1-1-1' },
  { id: 'L002', name: 'DCE_Oil_Management', abbr: 'DC_O_M', requirement: 'STCW A-V1-1-2' },
  { id: 'L003', name: 'DCE_Chem_Operation', abbr: 'DC_C_O', requirement: 'STCW A-V1-1-1' },
  { id: 'L004', name: 'DCE_Chem_Management', abbr: 'DC_C_M', requirement: 'STCW A-V1-1-3' },
  { id: 'L005', name: 'DCE_Gas_Operation', abbr: 'DC_G_O', requirement: 'STCW A-V1-2-1' },
  { id: 'L006', name: 'DCE_Gas_Management', abbr: 'DC_G_M', requirement: 'STCW A-V1-2-2' },
  
  // COC Certificates
  { id: 'L007', name: 'COC Master', abbr: 'COC_DM', requirement: 'STCW II/2' },
  { id: 'L008', name: 'COC Chief Mate', abbr: 'COC_DC', requirement: 'STCW II/2' },
  { id: 'L009', name: 'COC OIC Nav Watch', abbr: 'COC_DW', requirement: 'STCW II/1' },
  { id: 'L010', name: 'COC Chief Engineer', abbr: 'COC_EC', requirement: 'STCW III/2' },
  { id: 'L011', name: 'COC 2nd Engineer', abbr: 'COC_ES', requirement: 'STCW III/2' },
  { id: 'L012', name: 'COC OIC Eng Watch', abbr: 'COC_EW', requirement: 'STCW III/1' },
  { id: 'L013', name: 'COC ETO', abbr: 'COC_EO', requirement: 'STCW III/6' },
  
  // COP Certificates
  { id: 'L014', name: 'COP Deck Rating (AB)', abbr: 'COP_DRA', requirement: 'STCW II/5' },
  { id: 'L015', name: 'COP Deck Rating (OS)', abbr: 'COP_DRB', requirement: 'STCW II/4' },
  { id: 'L016', name: 'COP Engine Rating (ABE)', abbr: 'COP_ERA', requirement: 'STCW III/5' },
  { id: 'L017', name: 'COP Engine Rating', abbr: 'COP_ERB', requirement: 'STCW III/4' },
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
}>): LicenseTemplate[] {
  return apiData.map(entry => ({
    id: entry.entryId,
    name: entry.name,
    abbr: entry.shortCode || '',
    requirement: entry.description || '',
  }));
}

// Pre-exported list of all templates
export const DEFAULT_LICENSE_TEMPLATES = LICENSE_DCE_TEMPLATES;
