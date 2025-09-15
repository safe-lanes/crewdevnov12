// Safe field mapping for Vessel Master (ID 014) to avoid "Unknown column" errors
// Maps vessel-specific fields to existing database columns until schema migration is complete

import { InsertMasterDataEntry } from "@shared/schema";

// List of safe fields that exist in the current database schema
const SAFE_FIELDS: (keyof InsertMasterDataEntry)[] = [
  'masterId',
  'entryId', 
  'name',          // Required field - always populate this
  'description',   // Use as temporary storage for imoNumber
  'nuid',
  'countryName',
  'country',
  'cid', 
  'countryCode',
  'nationality',
  'countryRefId',
  'vtuid',
  'vesselType',
  'tanker',
  'oilTanker',
  'gasTanker', 
  'chemicalTanker',
  'bulk',
  'isActive',
  'isDeleted',
  'createdBy',
  'domain',
  'orderBy'
];

// Vessel field mappings to existing safe fields
const VESSEL_FIELD_MAPPINGS = {
  // Map vessel name to required 'name' field
  vessel: 'name',
  // Temporarily map IMO number to description field
  imoNumber: 'description',
  // These fields will be ignored until database migration
  vuid: null,
  lengthOverall: null,
  extremeBreadth: null,
  netRegisterTonnage: null,
  grossTonnage: null,
  deadWeightSummer: null,
  draftSummer: null,
  masterEmail: null,
  secondaryEmail: null,
  deliveryDate: null,
  portId: null,
  fleetId: null,
  vesselTypeId: null,
  vesselOwnerId: null,
  file: null,
  yearBuilt: null,
  hullType: null,
  vesselImage: null
} as const;

export interface VesselMasterEntry {
  id?: number;
  entryId: string;
  vessel: string;        // Vessel name
  imoNumber?: string;    // IMO Number
  yearBuilt?: string;    // Year built
  hullType?: string;     // Hull type
  vesselImage?: string;  // Vessel image path
  lengthOverall?: string;
  extremeBreadth?: string;
  netRegisterTonnage?: string;
  grossTonnage?: string;
  deadWeightSummer?: string;
  draftSummer?: string;
  masterEmail?: string;
  secondaryEmail?: string;
  deliveryDate?: string;
  portId?: string;
  fleetId?: string;
  vesselTypeId?: string;
  vesselOwnerId?: string;
  file?: string;
  vuid?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: string;
}

/**
 * Safely maps vessel master data to existing database schema
 * @param vesselData - Raw vessel data from the UI
 * @param masterId - Master ID (should be "014" for vessel master)
 * @returns Mapped data that only includes safe database fields
 */
export function mapVesselDataToSafeFields(
  vesselData: Partial<VesselMasterEntry>, 
  masterId: string = "014"
): Partial<InsertMasterDataEntry> {
  const safeData: Partial<InsertMasterDataEntry> = {
    masterId,
    entryId: vesselData.entryId || '',
  };

  // Always populate the required 'name' field with vessel name
  if (vesselData.vessel) {
    safeData.name = vesselData.vessel;
  }

  // Map IMO number to description field temporarily
  if (vesselData.imoNumber) {
    safeData.description = vesselData.imoNumber;
  }

  // Include other safe fields if present
  if (vesselData.isActive !== undefined) {
    safeData.isActive = vesselData.isActive;
  }
  
  if (vesselData.isDeleted !== undefined) {
    safeData.isDeleted = vesselData.isDeleted;
  }
  
  if (vesselData.createdBy) {
    safeData.createdBy = vesselData.createdBy;
  }

  return safeData;
}

/**
 * Maps database entry back to vessel display format
 * @param dbEntry - Database entry from master_data_entries
 * @returns Vessel data in UI format
 */
export function mapSafeFieldsToVesselData(dbEntry: any): VesselMasterEntry {
  return {
    id: dbEntry.id,
    entryId: dbEntry.entryId || '',
    vessel: dbEntry.name || '',           // Map name back to vessel
    imoNumber: dbEntry.description || '', // Map description back to imoNumber
    isActive: dbEntry.isActive ?? true,
    isDeleted: dbEntry.isDeleted ?? false,
    createdBy: dbEntry.createdBy || '',
    // Set empty defaults for unsupported fields to avoid UI errors
    yearBuilt: '',
    hullType: '',
    vesselImage: '',
    lengthOverall: '',
    extremeBreadth: '',
    netRegisterTonnage: '',
    grossTonnage: '',
    deadWeightSummer: '',
    draftSummer: '',
    masterEmail: '',
    secondaryEmail: '',
    deliveryDate: '',
    portId: '',
    fleetId: '',
    vesselTypeId: '',
    vesselOwnerId: '',
    file: '',
    vuid: ''
  };
}

/**
 * Validates if a field is safe to send to the database
 * @param fieldName - Field name to check
 * @returns true if field is safe to send
 */
export function isSafeField(fieldName: string): boolean {
  return SAFE_FIELDS.includes(fieldName as keyof InsertMasterDataEntry);
}

/**
 * Filters an object to only include safe database fields
 * @param data - Data object to filter
 * @returns Filtered object with only safe fields
 */
export function filterToSafeFields(data: any): Partial<InsertMasterDataEntry> {
  const safeData: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (isSafeField(key)) {
      safeData[key] = value;
    }
  }
  
  return safeData;
}

/**
 * Gets a user-friendly error message for vessel master operations
 */
export function getVesselMasterErrorMessage(): string {
  return "Vessel Master is operating in safe mode. Some advanced fields are temporarily unavailable due to database migration. Basic vessel information (name, IMO number) can still be managed.";
}

/**
 * Checks if we're dealing with vessel master data
 * @param masterId - Master ID to check
 * @returns true if this is vessel master (014)
 */
export function isVesselMaster(masterId: string): boolean {
  return masterId === "014";
}