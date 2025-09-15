// Server-side safe field filtering for Vessel Master (ID 014)
// Prevents sending unknown columns to database until schema migration is complete

import { InsertMasterDataEntry } from "@shared/schema";

// Safe fields that exist in the current database schema for master_data_entries
const SAFE_MASTER_DATA_FIELDS: (keyof InsertMasterDataEntry)[] = [
  'masterId',
  'entryId', 
  'name',          // Required field - always include
  'description',   // Use as temporary storage for vessel fields
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

// Known vessel-specific fields that should be filtered out until schema migration
const VESSEL_UNSAFE_FIELDS = [
  'vuid',
  'vessel', // Maps to 'name' field instead
  'lengthOverall',
  'extremeBreadth', 
  'netRegisterTonnage',
  'grossTonnage',
  'deadWeightSummer',
  'draftSummer',
  'masterEmail',
  'secondaryEmail',
  'deliveryDate',
  'portId',
  'fleetId',
  'vesselTypeId',
  'vesselOwnerId',
  'file',
  'imoNumber', // Maps to 'description' field instead
  'yearBuilt',
  'hullType',
  'vesselImage'
];

/**
 * Checks if a master ID is for vessel master
 */
export function isVesselMaster(masterId: string): boolean {
  console.log(`🚢 [VESSEL CHECK] Checking if masterId "${masterId}" is vessel master`);
  const isVessel = masterId === "014";
  console.log(`🚢 [VESSEL CHECK] Result: ${isVessel}`);
  return isVessel;
}

/**
 * Safely filters vessel master data to only include database-safe fields
 * and creates a minimal safe object that won't trigger unknown column errors
 */
export function filterVesselMasterData(data: any, masterId: string): Partial<InsertMasterDataEntry> {
  if (!isVesselMaster(masterId)) {
    return data; // No filtering needed for non-vessel masters
  }

  console.log(`🚢 [SERVER FILTER] Filtering vessel master data for masterId: ${masterId}`);
  console.log(`🚢 [SERVER FILTER] Original data:`, data);

  // Create minimal safe object with only guaranteed-to-exist fields
  const safeData: any = {
    masterId: masterId,
    entryId: data.entryId || '',
    name: '', // Required field
    description: '', // Safe field
    isActive: true,
    isDeleted: false
  };

  // Apply vessel-specific field mappings to safe fields only
  if (data.vessel) {
    safeData.name = data.vessel;
    console.log(`🚢 [SERVER FILTER] Mapping vessel "${data.vessel}" to name field`);
  } else if (data.name) {
    safeData.name = data.name;
  }

  if (data.imoNumber) {
    safeData.description = data.imoNumber;
    console.log(`🚢 [SERVER FILTER] Mapping imoNumber "${data.imoNumber}" to description field`);
  } else if (data.description) {
    safeData.description = data.description;
  }

  // Ensure required name field is populated
  if (!safeData.name && safeData.entryId) {
    safeData.name = `Vessel ${safeData.entryId}`;
    console.log(`🚢 [SERVER FILTER] Auto-generating name: "${safeData.name}"`);
  }

  // Only include explicitly safe fields to avoid unknown column errors
  const filteredSafeData = {
    masterId: safeData.masterId,
    entryId: safeData.entryId, 
    name: safeData.name,
    description: safeData.description,
    isActive: safeData.isActive,
    isDeleted: safeData.isDeleted
  };

  console.log(`🚢 [SERVER FILTER] Filtered safe data:`, filteredSafeData);
  return filteredSafeData;
}

/**
 * Maps database entry back to vessel display format for API responses
 */
export function mapDatabaseToVesselDisplay(dbEntry: any): any {
  if (!dbEntry) return dbEntry;

  return {
    ...dbEntry,
    // Map safe fields back to vessel fields for frontend consumption
    vessel: dbEntry.name || '',
    imoNumber: dbEntry.description || '',
    // Include other safe fields as-is
    name: dbEntry.name || '',
    description: dbEntry.description || ''
  };
}

/**
 * Validates vessel master entry has required fields
 */
export function validateVesselMasterEntry(data: any): { isValid: boolean; error?: string } {
  if (!data.name && !data.vessel) {
    return {
      isValid: false,
      error: "Vessel master entry must have either 'name' or 'vessel' field populated"
    };
  }

  return { isValid: true };
}

/**
 * Gets vessel master safety info for debugging
 */
export function getVesselMasterInfo() {
  return {
    safeFields: SAFE_MASTER_DATA_FIELDS,
    unsafeFields: VESSEL_UNSAFE_FIELDS,
    isEnabled: true,
    message: "Vessel Master operating in safe mode - advanced fields temporarily unavailable"
  };
}