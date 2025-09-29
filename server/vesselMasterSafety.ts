// Server-side field filtering and transformation for special masters
// Handles Vessel Master (ID 014), Additional Groups Master (ID 016), and Vessel Owners Master (ID 017)
// Prevents sending unknown columns to database and handles data transformations

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
  'orderBy',
  'aguid',         // Additional Groups Master fields
  'userId',
  'vesselIds'      // Important: vesselIds field for master 016
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

// Performance cache for master type checks
const masterTypeCache = new Map<string, { isVessel: boolean; isGroups: boolean; isOwners: boolean }>();

/**
 * Checks if a master ID is for vessel master (with caching for performance)
 */
export function isVesselMaster(masterId: string): boolean {
  // Check cache first
  let cached = masterTypeCache.get(masterId);
  if (!cached) {
    // Calculate once and cache
    const isVessel = masterId === "014";
    const isGroups = masterId === "016"; 
    const isOwners = masterId === "017";
    cached = { isVessel, isGroups, isOwners };
    masterTypeCache.set(masterId, cached);
    // Only log cache creation in development mode for performance
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 [MASTER CACHE] Cached types for masterId "${masterId}": vessel=${isVessel}, groups=${isGroups}, owners=${isOwners}`);
    }
  }
  return cached.isVessel;
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

  // Create safe object with only fields that are being updated (partial updates)
  const safeData: any = {};
  
  // Always include masterId for identification
  if (masterId) {
    safeData.masterId = masterId;
  }

  // Apply vessel-specific field mappings ONLY for fields that are provided
  if (data.vessel !== undefined) {
    safeData.name = data.vessel;
    console.log(`🚢 [SERVER FILTER] Mapping vessel "${data.vessel}" to name field`);
  } else if (data.name !== undefined) {
    safeData.name = data.name;
  }

  if (data.imoNumber !== undefined) {
    safeData.description = data.imoNumber;
    console.log(`🚢 [SERVER FILTER] Mapping imoNumber "${data.imoNumber}" to description field`);
  } else if (data.description !== undefined) {
    safeData.description = data.description;
  }
  
  // Include vesselType if provided (safe field)
  if (data.vesselType !== undefined) {
    safeData.vesselType = data.vesselType;
  }

  // Include other safe fields only if they are provided
  if (data.entryId !== undefined) {
    safeData.entryId = data.entryId;
  }
  
  if (data.isActive !== undefined) {
    safeData.isActive = data.isActive;
  }
  
  if (data.isDeleted !== undefined) {
    safeData.isDeleted = data.isDeleted;
  }

  console.log(`🚢 [SERVER FILTER] Filtered safe data (partial update):`, safeData);
  return safeData;
}

/**
 * Maps database entry back to vessel display format for API responses
 */
export function mapDatabaseToVesselDisplay(dbEntry: any): any {
  if (!dbEntry) return dbEntry;

  // First apply basic field transformation (snake_case to camelCase)
  const basicTransformed = { ...dbEntry };
  
  // Convert snake_case database fields to camelCase frontend fields
  if (dbEntry.entry_id !== undefined) {
    basicTransformed.entryId = dbEntry.entry_id;
    delete basicTransformed.entry_id;
  }
  
  if (dbEntry.master_id !== undefined) {
    basicTransformed.masterId = dbEntry.master_id;
    delete basicTransformed.master_id;
  }
  
  if (dbEntry.created_at !== undefined) {
    basicTransformed.createdAt = dbEntry.created_at;
    delete basicTransformed.created_at;
  }
  
  if (dbEntry.updated_at !== undefined) {
    basicTransformed.updatedAt = dbEntry.updated_at;
    delete basicTransformed.updated_at;
  }

  return {
    ...basicTransformed,
    // Map safe fields back to vessel fields for frontend consumption
    vessel: basicTransformed.name || '',
    imoNumber: basicTransformed.description || '',
    // Include other safe fields as-is
    name: basicTransformed.name || '',
    description: basicTransformed.description || ''
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

// ======================= ADDITIONAL GROUPS MASTER (ID 016) FUNCTIONS =======================

/**
 * Checks if a master ID is for additional groups master (with caching for performance)
 */
export function isAdditionalGroupsMaster(masterId: string): boolean {
  // Use cached result
  let cached = masterTypeCache.get(masterId);
  if (!cached) {
    // This should be called after isVesselMaster in most cases, but handle edge case
    const isVessel = masterId === "014";
    const isGroups = masterId === "016"; 
    const isOwners = masterId === "017";
    cached = { isVessel, isGroups, isOwners };
    masterTypeCache.set(masterId, cached);
    // Only log cache creation in development mode for performance
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 [MASTER CACHE] Cached types for masterId "${masterId}": vessel=${isVessel}, groups=${isGroups}, owners=${isOwners}`);
    }
  }
  return cached.isGroups;
}

/**
 * Transforms vesselIds field between array (UI) and JSON string (database) formats
 */
export function transformVesselIds(data: any, direction: 'toDatabase' | 'fromDatabase'): any {
  if (!data) return data;

  if (direction === 'toDatabase') {
    // Convert array to JSON string for database storage
    // Handle both "VesselIDs" and "vesselIds" field naming variants
    const vesselIdsArray = data.vesselIds || data.VesselIDs;
    
    if (Array.isArray(vesselIdsArray)) {
      console.log(`🎯 [VESSEL_IDS] Converting array to JSON string:`, vesselIdsArray);
      const result = {
        ...data,
        vesselIds: JSON.stringify(vesselIdsArray)
      };
      // Remove the alternative casing to avoid duplication
      delete result.VesselIDs;
      return result;
    } else if (typeof vesselIdsArray === 'string') {
      console.log(`🎯 [VESSEL_IDS] VesselIds already string, keeping as-is:`, vesselIdsArray);
      const result = {
        ...data,
        vesselIds: vesselIdsArray
      };
      // Remove the alternative casing to avoid duplication
      delete result.VesselIDs;
      return result;
    }
  } else if (direction === 'fromDatabase') {
    // Convert JSON string back to array for API response
    if (data.vesselIds && typeof data.vesselIds === 'string') {
      try {
        const parsed = JSON.parse(data.vesselIds);
        console.log(`🎯 [VESSEL_IDS] Converting JSON string to array:`, parsed);
        return {
          ...data,
          vesselIds: Array.isArray(parsed) ? parsed : []
        };
      } catch (error) {
        console.warn(`🎯 [VESSEL_IDS] Failed to parse vesselIds JSON:`, data.vesselIds, error);
        return {
          ...data,
          vesselIds: []
        };
      }
    }
  }

  return data;
}

/**
 * Filters and transforms additional groups master data for database storage
 */
export function filterAdditionalGroupsData(data: any, masterId: string): Partial<InsertMasterDataEntry> {
  if (!isAdditionalGroupsMaster(masterId)) {
    return data; // No filtering needed for non-additional-groups masters
  }

  console.log(`🎯 [GROUPS FILTER] Filtering additional groups data for masterId: ${masterId}`);
  console.log(`🎯 [GROUPS FILTER] Original data:`, data);

  // Apply vesselIds transformation first
  const transformedData = transformVesselIds(data, 'toDatabase');
  console.log(`🎯 [GROUPS FILTER] After vesselIds transformation:`, transformedData);

  // Handle field naming consistency - accept both "VesselIDs" and "vesselIds"  
  const normalizedData = { ...transformedData };
  
  // Only include vesselIds in the result if it was actually provided in the original input data
  const originalHasVesselIds = ('vesselIds' in data) || ('VesselIDs' in data);
  const transformedHasVesselIds = ('vesselIds' in transformedData) || ('VesselIDs' in transformedData);
  
  if (originalHasVesselIds || transformedHasVesselIds) {
    // If vesselIds was provided, ensure it's the canonical field name and handle undefined->null conversion
    const vesselIdsValue = transformedData.vesselIds || transformedData.VesselIDs;
    normalizedData.vesselIds = vesselIdsValue !== undefined ? vesselIdsValue : null;
  } else {
    // If vesselIds was not provided, completely remove it from the result to avoid undefined values
    delete normalizedData.vesselIds;
  }
  
  // Remove alternative casing to avoid duplication
  delete normalizedData.VesselIDs;

  console.log(`🎯 [GROUPS FILTER] After field normalization:`, normalizedData);
  return normalizedData;
}

/**
 * Maps database entry back to additional groups display format for API responses
 */
export function mapDatabaseToGroupsDisplay(dbEntry: any): any {
  if (!dbEntry) return dbEntry;

  console.log(`🎯 [GROUPS MAP] Mapping database entry to display format:`, dbEntry);
  
  // First apply basic field transformation (snake_case to camelCase)
  const basicTransformed = { ...dbEntry };
  
  // Convert snake_case database fields to camelCase frontend fields
  if (dbEntry.entry_id !== undefined) {
    basicTransformed.entryId = dbEntry.entry_id;
    delete basicTransformed.entry_id;
  }
  
  if (dbEntry.master_id !== undefined) {
    basicTransformed.masterId = dbEntry.master_id;
    delete basicTransformed.master_id;
  }
  
  if (dbEntry.created_at !== undefined) {
    basicTransformed.createdAt = dbEntry.created_at;
    delete basicTransformed.created_at;
  }
  
  if (dbEntry.updated_at !== undefined) {
    basicTransformed.updatedAt = dbEntry.updated_at;
    delete basicTransformed.updated_at;
  }
  
  // Apply vesselIds transformation from database
  const transformedEntry = transformVesselIds(basicTransformed, 'fromDatabase');
  console.log(`🎯 [GROUPS MAP] After vesselIds transformation:`, transformedEntry);

  return transformedEntry;
}

/**
 * Validates additional groups entry has required fields
 */
export function validateAdditionalGroupsEntry(data: any): { isValid: boolean; error?: string } {
  // Basic validation - name is required
  if (!data.name) {
    return {
      isValid: false,
      error: "Additional Groups entry must have 'name' field populated"
    };
  }

  // Validate vesselIds if present
  if (data.vesselIds) {
    // If it's a string, try to parse it to validate JSON format
    if (typeof data.vesselIds === 'string') {
      try {
        const parsed = JSON.parse(data.vesselIds);
        if (!Array.isArray(parsed)) {
          return {
            isValid: false,
            error: "vesselIds must be a JSON array string or an array"
          };
        }
      } catch (error) {
        return {
          isValid: false,
          error: "vesselIds must be valid JSON array string"
        };
      }
    } else if (!Array.isArray(data.vesselIds)) {
      return {
        isValid: false,
        error: "vesselIds must be an array or JSON array string"
      };
    }
  }

  return { isValid: true };
}

// ======================= VESSEL OWNERS MASTER (ID 017) FUNCTIONS =======================

/**
 * Checks if a master ID is for vessel owners master (with caching for performance)
 */
export function isVesselOwnersMaster(masterId: string): boolean {
  // Use cached result
  let cached = masterTypeCache.get(masterId);
  if (!cached) {
    // This should be called after isVesselMaster in most cases, but handle edge case
    const isVessel = masterId === "014";
    const isGroups = masterId === "016"; 
    const isOwners = masterId === "017";
    cached = { isVessel, isGroups, isOwners };
    masterTypeCache.set(masterId, cached);
    // Only log cache creation in development mode for performance
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 [MASTER CACHE] Cached types for masterId "${masterId}": vessel=${isVessel}, groups=${isGroups}, owners=${isOwners}`);
    }
  }
  return cached.isOwners;
}

/**
 * Filters and transforms vessel owners master data for database storage
 * Handles vouid→entryId normalization and vesselIds transformation
 */
export function filterVesselOwnersData(data: any, masterId: string): Partial<InsertMasterDataEntry> {
  if (!isVesselOwnersMaster(masterId)) {
    return data; // No filtering needed for non-vessel-owners masters
  }

  console.log(`🏢 [OWNERS FILTER] Filtering vessel owners data for masterId: ${masterId}`);
  console.log(`🏢 [OWNERS FILTER] Original data:`, data);

  // Apply vouid→entryId normalization first
  let preprocessedData = { ...data };
  if (data.vouid && !data.entryId) {
    preprocessedData.entryId = data.vouid;
    console.log(`🏢 [OWNERS FILTER] Normalized vouid "${data.vouid}" to entryId field`);
  }

  // Apply vesselIds transformation (reusing Additional Groups logic)
  const transformedData = transformVesselIds(preprocessedData, 'toDatabase');
  console.log(`🏢 [OWNERS FILTER] After vesselIds transformation:`, transformedData);

  // Handle field naming consistency - accept both "VesselIDs" and "vesselIds"
  const normalizedData = {
    ...transformedData,
    // Ensure vesselIds is the canonical field name
    vesselIds: transformedData.vesselIds || transformedData.VesselIDs,
    // Remove alternative casing to avoid duplication
    VesselIDs: undefined
  };

  console.log(`🏢 [OWNERS FILTER] After field normalization:`, normalizedData);
  return normalizedData;
}

/**
 * Maps database entry back to vessel owners display format for API responses
 * Reuses the same vesselIds transformation logic as Additional Groups Master
 */
export function mapDatabaseToOwnersDisplay(dbEntry: any): any {
  if (!dbEntry) return dbEntry;

  console.log(`🏢 [OWNERS MAP] Mapping database entry to display format:`, dbEntry);
  
  // First apply basic field transformation (snake_case to camelCase)
  const basicTransformed = { ...dbEntry };
  
  // Convert snake_case database fields to camelCase frontend fields
  if (dbEntry.entry_id !== undefined) {
    basicTransformed.entryId = dbEntry.entry_id;
    delete basicTransformed.entry_id;
  }
  
  if (dbEntry.master_id !== undefined) {
    basicTransformed.masterId = dbEntry.master_id;
    delete basicTransformed.master_id;
  }
  
  if (dbEntry.created_at !== undefined) {
    basicTransformed.createdAt = dbEntry.created_at;
    delete basicTransformed.created_at;
  }
  
  if (dbEntry.updated_at !== undefined) {
    basicTransformed.updatedAt = dbEntry.updated_at;
    delete basicTransformed.updated_at;
  }
  
  // Apply vesselIds transformation from database (reusing Additional Groups logic)
  const transformedEntry = transformVesselIds(basicTransformed, 'fromDatabase');
  console.log(`🏢 [OWNERS MAP] After vesselIds transformation:`, transformedEntry);

  return transformedEntry;
}

/**
 * Validates vessel owners entry has required fields
 */
export function validateVesselOwnersEntry(data: any): { isValid: boolean; error?: string } {
  console.log('🏢 [OWNERS VALIDATION] Validating vessel owners entry:', data);
  
  // Allow empty names for initial entry creation (consistent with other masters)
  // Only validate name format if provided and not empty
  if (data.name && typeof data.name !== 'string') {
    console.log('🏢 [OWNERS VALIDATION] Name validation failed - not a string:', data.name);
    return {
      isValid: false,
      error: "Vessel Owners name must be a string"
    };
  }
  
  console.log('🏢 [OWNERS VALIDATION] Name validation passed:', data.name);

  // Validate vesselIds if present (reusing Additional Groups validation logic)
  console.log('🏢 [OWNERS VALIDATION] Checking vesselIds:', data.vesselIds);
  if (data.vesselIds) {
    console.log('🏢 [OWNERS VALIDATION] vesselIds is present, validating format...');
    // If it's a string, try to parse it to validate JSON format
    if (typeof data.vesselIds === 'string') {
      console.log('🏢 [OWNERS VALIDATION] vesselIds is a string, parsing JSON...');
      try {
        const parsed = JSON.parse(data.vesselIds);
        if (!Array.isArray(parsed)) {
          console.log('🏢 [OWNERS VALIDATION] vesselIds JSON is not an array:', parsed);
          return {
            isValid: false,
            error: "vesselIds must be a JSON array string or an array"
          };
        }
      } catch (error) {
        console.log('🏢 [OWNERS VALIDATION] vesselIds JSON parse failed:', error);
        return {
          isValid: false,
          error: "vesselIds must be valid JSON array string"
        };
      }
    } else if (!Array.isArray(data.vesselIds)) {
      console.log('🏢 [OWNERS VALIDATION] vesselIds is not an array:', data.vesselIds);
      return {
        isValid: false,
        error: "vesselIds must be an array or JSON array string"
      };
    }
  }

  console.log('🏢 [OWNERS VALIDATION] All validation passed - returning success');
  return { isValid: true };
}

// ======================= UNIFIED HELPER FUNCTIONS =======================

/**
 * Determines if a master needs special transformation handling
 */
export function needsSpecialHandling(masterId: string): boolean {
  return isVesselMaster(masterId) || isAdditionalGroupsMaster(masterId) || isVesselOwnersMaster(masterId);
}

/**
 * Applies appropriate filtering/transformation based on master type
 */
export function applyMasterSpecificFiltering(data: any, masterId: string): any {
  if (isVesselMaster(masterId)) {
    return filterVesselMasterData(data, masterId);
  } else if (isAdditionalGroupsMaster(masterId)) {
    return filterAdditionalGroupsData(data, masterId);
  } else if (isVesselOwnersMaster(masterId)) {
    return filterVesselOwnersData(data, masterId);
  }
  return data;
}

/**
 * Applies appropriate response mapping based on master type
 */
export function applyMasterSpecificMapping(dbEntry: any, masterId: string): any {
  if (isVesselMaster(masterId)) {
    return mapDatabaseToVesselDisplay(dbEntry);
  } else if (isAdditionalGroupsMaster(masterId)) {
    return mapDatabaseToGroupsDisplay(dbEntry);
  } else if (isVesselOwnersMaster(masterId)) {
    return mapDatabaseToOwnersDisplay(dbEntry);
  }
  return dbEntry;
}

/**
 * Validates entry based on master type
 */
export function validateMasterSpecificEntry(data: any, masterId: string): { isValid: boolean; error?: string } {
  if (isVesselMaster(masterId)) {
    return validateVesselMasterEntry(data);
  } else if (isAdditionalGroupsMaster(masterId)) {
    return validateAdditionalGroupsEntry(data);
  } else if (isVesselOwnersMaster(masterId)) {
    return validateVesselOwnersEntry(data);
  }
  return { isValid: true };
}