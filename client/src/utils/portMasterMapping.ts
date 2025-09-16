// Safe field mapping for Port Master (ID 018) to avoid "Unknown column" errors
// Maps port-specific fields to existing database columns until schema migration is complete

import { InsertMasterDataEntry } from "@shared/schema";

// List of safe fields that exist in the current database schema
const PORT_SAFE_FIELDS: (keyof InsertMasterDataEntry)[] = [
  'masterId',
  'entryId', 
  'name',          // Required field - port name
  'description',   // Use as temporary storage for coordinates
  'nuid',          // Map to puid (Port Unique ID)
  'countryName',   // Port's country name
  'country',       // Port's country
  'countryCode',   // Port's country code
  'cid',           // Can use for port code temporarily
  'isActive',
  'isDeleted',
  'createdBy',
  'domain',
  'orderBy'
];

// Port field mappings to existing safe fields
const PORT_FIELD_MAPPINGS = {
  // Map port name to required 'name' field
  portName: 'name',
  // Map puid to nuid field
  puid: 'nuid',
  // Temporarily map coordinates to description field (JSON string)
  latitude: 'description', // Will store as JSON: {"lat": "...", "lng": "..."}
  longitude: 'description',
  // Map port code to cid field temporarily
  portcode: 'cid',
  // Country fields map directly
  country: 'country',
  countryName: 'countryName',
  countryCode: 'countryCode',
  // These fields will be ignored until database migration
  timezone: null,
  region: null,
  subRegion: null,
  continentCode: null,
  portType: null,
  facilities: null,
  maxVesselSize: null,
  harborMaster: null,
  contactInfo: null,
  operatingHours: null
} as const;

export interface PortMasterEntry {
  id?: number;
  entryId: string;
  portName: string;       // Port name
  puid?: string;          // Port Unique ID
  latitude?: string;      // Latitude coordinate
  longitude?: string;     // Longitude coordinate
  country?: string;       // Country
  countryName?: string;   // Country name
  countryCode?: string;   // Country code
  portcode?: string;      // Port code
  timezone?: string;      // Port timezone
  region?: string;        // Geographic region
  subRegion?: string;     // Geographic sub-region
  continentCode?: string; // Continent code
  portType?: string;      // Type of port (Commercial, Naval, etc.)
  facilities?: string;    // Available facilities
  maxVesselSize?: string; // Maximum vessel size
  harborMaster?: string;  // Harbor master contact
  contactInfo?: string;   // General contact information
  operatingHours?: string; // Operating hours
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: string;
}

/**
 * Safely maps port master data to existing database schema
 * @param portData - Raw port data from the UI
 * @param masterId - Master ID (should be "018" for port master)
 * @returns Mapped data that only includes safe database fields
 */
export function mapPortDataToSafeFields(
  portData: Partial<PortMasterEntry>, 
  masterId: string = "018"
): Partial<InsertMasterDataEntry> {
  const safeData: Partial<InsertMasterDataEntry> = {
    masterId,
    entryId: portData.entryId || '',
  };

  // Always populate the required 'name' field with port name
  if (portData.portName) {
    safeData.name = portData.portName;
  }

  // Map puid to nuid field
  if (portData.puid) {
    safeData.nuid = portData.puid;
  }

  // Map coordinates to description field as JSON string
  if (portData.latitude || portData.longitude) {
    const coordinates = {
      lat: portData.latitude || '',
      lng: portData.longitude || ''
    };
    safeData.description = JSON.stringify(coordinates);
  }

  // Map port code to cid field temporarily
  if (portData.portcode) {
    safeData.cid = portData.portcode;
  }

  // Include country fields (safe fields that exist in database)
  if (portData.country) {
    safeData.country = portData.country;
  }
  
  if (portData.countryName) {
    safeData.countryName = portData.countryName;
  }
  
  if (portData.countryCode) {
    safeData.countryCode = portData.countryCode;
  }

  // Include other safe fields if present
  if (portData.isActive !== undefined) {
    safeData.isActive = portData.isActive;
  }
  
  if (portData.isDeleted !== undefined) {
    safeData.isDeleted = portData.isDeleted;
  }
  
  if (portData.createdBy) {
    safeData.createdBy = portData.createdBy;
  }

  return safeData;
}

/**
 * Maps database entry back to port display format
 * @param dbEntry - Database entry from master_data_entries
 * @returns Port data in UI format
 */
export function mapSafeFieldsToPortData(dbEntry: any): PortMasterEntry {
  // Parse coordinates from description field
  let latitude = '';
  let longitude = '';
  
  if (dbEntry.description) {
    try {
      const coords = JSON.parse(dbEntry.description);
      latitude = coords.lat || '';
      longitude = coords.lng || '';
    } catch {
      // If not valid JSON, treat as regular description
      // Could be legacy data
    }
  }

  return {
    id: dbEntry.id,
    entryId: dbEntry.entry_id || dbEntry.entryId || '',      // Handle snake_case from DB
    portName: dbEntry.name || '',                            // Map name back to portName
    puid: dbEntry.nuid || '',                                // Map nuid back to puid
    latitude: latitude,                                      // Extract from description JSON
    longitude: longitude,                                    // Extract from description JSON
    portcode: dbEntry.cid || '',                            // Map cid back to portcode
    country: dbEntry.country || '',
    countryName: dbEntry.countryName || '',
    countryCode: dbEntry.countryCode || '',
    isActive: dbEntry.isActive ?? true,
    isDeleted: dbEntry.isDeleted ?? false,
    createdBy: dbEntry.createdBy || '',
    // Set empty defaults for unsupported fields to avoid UI errors
    timezone: '',
    region: '',
    subRegion: '',
    continentCode: '',
    portType: '',
    facilities: '',
    maxVesselSize: '',
    harborMaster: '',
    contactInfo: '',
    operatingHours: ''
  };
}

/**
 * Validates if a field is safe to send to the database for port master
 * @param fieldName - Field name to check
 * @returns true if field is safe to send
 */
export function isPortSafeField(fieldName: string): boolean {
  return PORT_SAFE_FIELDS.includes(fieldName as keyof InsertMasterDataEntry);
}

/**
 * Filters an object to only include safe database fields for port master
 * @param data - Data object to filter
 * @returns Filtered object with only safe fields
 */
export function filterToPortSafeFields(data: any): Partial<InsertMasterDataEntry> {
  const safeData: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (isPortSafeField(key)) {
      safeData[key] = value;
    }
  }
  
  return safeData;
}

/**
 * Gets a user-friendly error message for port master operations
 */
export function getPortMasterErrorMessage(): string {
  return "Port Master is operating in safe mode. Some advanced fields are temporarily unavailable due to database migration. Basic port information (name, coordinates, country) can still be managed.";
}

/**
 * Checks if we're dealing with port master data
 * @param masterId - Master ID to check
 * @returns true if this is port master (018)
 */
export function isPortMaster(masterId: string): boolean {
  return masterId === "018";
}

/**
 * Creates port-specific column definitions for AG Grid
 */
export function getPortMasterColumnDefs() {
  return [
    {
      headerName: "Entry ID",
      field: "entryId",
      width: 120,
      cellEditor: "agTextCellEditor",
      editable: true
    },
    {
      headerName: "Port Name",
      field: "portName",
      width: 200,
      cellEditor: "agTextCellEditor", 
      editable: true,
      cellClass: "required-field"
    },
    {
      headerName: "PUID",
      field: "puid",
      width: 120,
      cellEditor: "agTextCellEditor",
      editable: true
    },
    {
      headerName: "Latitude",
      field: "latitude",
      width: 120,
      cellEditor: "agTextCellEditor",
      editable: true,
      type: "numericColumn"
    },
    {
      headerName: "Longitude", 
      field: "longitude",
      width: 120,
      cellEditor: "agTextCellEditor",
      editable: true,
      type: "numericColumn"
    },
    {
      headerName: "Country",
      field: "country",
      width: 150,
      cellEditor: "agTextCellEditor",
      editable: true
    },
    {
      headerName: "Port Code",
      field: "portcode", 
      width: 120,
      cellEditor: "agTextCellEditor",
      editable: true
    },
    {
      headerName: "Active",
      field: "isActive",
      width: 80,
      cellEditor: "agCheckboxCellEditor",
      editable: true,
      cellRenderer: "agCheckboxCellRenderer"
    },
    {
      headerName: "Created By",
      field: "createdBy",
      width: 120,
      cellEditor: "agTextCellEditor",
      editable: true
    }
  ];
}

/**
 * Validates port master data before saving
 * @param portData - Port data to validate
 * @returns Validation result with success flag and error messages
 */
export function validatePortMasterData(portData: Partial<PortMasterEntry>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check required fields
  if (!portData.portName?.trim()) {
    errors.push("Port name is required");
  }
  
  // Validate coordinates if provided
  if (portData.latitude && isNaN(Number(portData.latitude))) {
    errors.push("Latitude must be a valid number");
  }
  
  if (portData.longitude && isNaN(Number(portData.longitude))) {
    errors.push("Longitude must be a valid number");
  }
  
  // Validate latitude range
  if (portData.latitude && (Number(portData.latitude) < -90 || Number(portData.latitude) > 90)) {
    errors.push("Latitude must be between -90 and 90 degrees");
  }
  
  // Validate longitude range
  if (portData.longitude && (Number(portData.longitude) < -180 || Number(portData.longitude) > 180)) {
    errors.push("Longitude must be between -180 and 180 degrees");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}